-- Monetization phase 3 (auth + entitlements) per the monetization brief.
--
-- Adds the ownership ledger for paid categories. Ownership is tied to a
-- Supabase Auth account (auth.uid()), not a device/browser -- purchases must
-- survive new phones, cleared cookies, and work across web + iOS, and Apple
-- requires a working "Restore Purchases" that a device-only model can't
-- satisfy. `source` distinguishes which payment rail granted it; only
-- 'stripe' is used today, 'apple' and 'manual' are here so this table never
-- needs reshaping when iOS IAP and admin/test grants show up later.
--
-- No packs/pack_words table -- that got absorbed into the categories /
-- category_words tables already added in 002_categories_database.sql. A
-- "pack" is just a category with is_premium = true; this table is the only
-- new piece needed.
--
-- RLS: a user may read only their own rows. No insert/update/delete grants
-- to anon or authenticated at all -- entitlements are only ever written by
-- a trusted server-side path (the Stripe webhook, once that exists). A
-- client claiming "I paid" can never grant itself a row.
--
-- Also seeds ONE throwaway premium category (original content, not
-- trademarked -- see the brief's copyright note) purely so the RLS boundary
-- and the client's entitlement-gating UI can be tested end-to-end before
-- Stripe exists: confirm category_words really does hide premium words from
-- anon, confirm the picker shows it locked, confirm signing in and (once
-- manually granted) owning it changes the UI state.
--
-- Fully additive. Safe to run multiple times.

create table if not exists public.entitlements (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null references public.categories(id) on delete cascade,
  source text not null check (source in ('stripe', 'apple', 'manual')),
  granted_at timestamptz not null default now(),
  unique (user_id, category_id)
);

alter table public.entitlements enable row level security;

drop policy if exists "entitlements_owner_read" on public.entitlements;
create policy "entitlements_owner_read" on public.entitlements
  for select
  using (auth.uid() = user_id);

grant select on public.entitlements to authenticated;

-- ---------------------------------------------------------------------
-- Test premium category. Original theme (not trademarked IP) per the
-- brief's section 9 flag. $1.99, arbitrary for now -- pricing isn't final.
-- ---------------------------------------------------------------------

insert into public.categories (id, label, is_premium, price_cents, active, sort_order)
values ('office_life', 'Office Life', true, 199, true, 12)
on conflict (id) do nothing;

insert into public.category_words (category_id, word) values
  ('office_life', 'stapler'),
  ('office_life', 'cubicle'),
  ('office_life', 'water cooler'),
  ('office_life', 'coffee break'),
  ('office_life', 'deadline'),
  ('office_life', 'spreadsheet'),
  ('office_life', 'conference call'),
  ('office_life', 'sticky note'),
  ('office_life', 'paperclip'),
  ('office_life', 'break room'),
  ('office_life', 'casual Friday'),
  ('office_life', 'performance review'),
  ('office_life', 'out of office'),
  ('office_life', 'reply all'),
  ('office_life', 'standing desk'),
  ('office_life', 'whiteboard'),
  ('office_life', 'lanyard'),
  ('office_life', 'parking spot'),
  ('office_life', 'fire drill'),
  ('office_life', 'team building'),
  ('office_life', 'happy hour'),
  ('office_life', 'Zoom background'),
  ('office_life', 'mute button'),
  ('office_life', 'calendar invite'),
  ('office_life', 'expense report'),
  ('office_life', 'headset'),
  ('office_life', 'hot desk'),
  ('office_life', 'onboarding'),
  ('office_life', 'exit interview'),
  ('office_life', 'vending machine'),
  ('office_life', 'printer jam'),
  ('office_life', 'meeting that could have been an email')
on conflict do nothing;
