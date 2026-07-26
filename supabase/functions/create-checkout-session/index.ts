// Creates a Stripe Checkout Session for a premium category and returns its
// URL for the client to redirect to. Hosted checkout only — this function
// never touches raw card data.
//
// Trust boundary: the caller sends only a categoryId. The price, the label,
// and the buyer's identity are all resolved SERVER-SIDE here — never trust
// a client-supplied price or user_id. Identity comes from the caller's own
// Supabase JWT (the Authorization header), verified via auth.getUser();
// there is no way for a client to buy a category "as" someone else.
//
// Secrets (STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY) are Edge Function
// secrets, injected at runtime, never shipped to the browser. Deploy with:
//   supabase functions deploy create-checkout-session
// and set STRIPE_SECRET_KEY via:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are already
// auto-injected into every Edge Function by Supabase — no need to set them.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  // Loosened for now since the Vercel preview domain changes per deploy.
  // Worth tightening to the final production domain once that's stable.
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header — sign in first.");

    const { categoryId, successUrl, cancelUrl } = await req.json();
    if (!categoryId || !successUrl || !cancelUrl) {
      throw new Error("categoryId, successUrl, and cancelUrl are required.");
    }

    // Identifies the caller from their own JWT — this is the ONLY source of
    // truth for who's buying, never a client-supplied field.
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("Not signed in.");

    // Service-role client to read the authoritative price and write nothing
    // here (the webhook does the granting) — bypasses RLS only to read
    // categories, which is public data anyway.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: category, error: catError } = await admin
      .from("categories")
      .select("id, label, price_cents, is_premium, active")
      .eq("id", categoryId)
      .maybeSingle();
    if (catError || !category) throw new Error("Category not found.");
    if (!category.active) throw new Error("Category is not available.");
    if (!category.is_premium || !category.price_cents) {
      throw new Error("Category is not purchasable.");
    }

    const { data: existing } = await admin
      .from("entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("category_id", category.id)
      .maybeSingle();
    if (existing) throw new Error("You already own this category.");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: category.label },
            unit_amount: category.price_cents,
          },
          quantity: 1,
        },
      ],
      // Both set: client_reference_id is Stripe's own convention for this,
      // metadata is what the webhook actually reads (belt and suspenders —
      // metadata is guaranteed to round-trip on the session object).
      client_reference_id: user.id,
      metadata: { user_id: user.id, category_id: category.id },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not start checkout.";
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
