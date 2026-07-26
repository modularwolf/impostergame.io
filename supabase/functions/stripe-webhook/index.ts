// Grants an entitlement ONLY when Stripe's signed webhook confirms payment
// — this is the payment analog of round_secrets / the host-authorization
// checks already in the RPCs. Never trust a client saying "I paid."
//
// Signature verification needs the exact raw request body, which is why
// this reads req.text() directly rather than req.json() — any
// reserialization (even whitespace changes) would break the signature
// check. Uses Stripe's SubtleCrypto provider because Deno doesn't have
// Node's `crypto` module that the default verifier expects.
//
// Deploy with:
//   supabase functions deploy stripe-webhook
// Then in the Stripe Dashboard (test mode first): Developers → Webhooks →
// Add endpoint → URL = https://<project-ref>.supabase.co/functions/v1/stripe-webhook
// → listen to checkout.session.completed → copy the signing secret and set:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// (STRIPE_SECRET_KEY should already be set from create-checkout-session;
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    const message = err instanceof Error ? err.message : "signature verification failed";
    console.error("Webhook signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
    const categoryId = session.metadata?.category_id ?? undefined;

    if (!userId || !categoryId) {
      console.error("checkout.session.completed missing user_id/category_id metadata", session.id);
      // Acknowledge anyway — retrying won't fix missing metadata, and Stripe
      // will keep retrying a non-2xx response indefinitely.
      return new Response(JSON.stringify({ received: true, warning: "missing metadata" }), { status: 200 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { error } = await admin.from("entitlements").insert({
      user_id: userId,
      category_id: categoryId,
      source: "stripe",
    });

    // 23505 = unique_violation on (user_id, category_id) — Stripe retries
    // webhooks on any non-2xx or timeout, so a duplicate delivery for an
    // already-granted purchase is expected, not an error.
    if (error && error.code !== "23505") {
      console.error("Failed to grant entitlement:", error);
      return new Response("Failed to grant entitlement", { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
