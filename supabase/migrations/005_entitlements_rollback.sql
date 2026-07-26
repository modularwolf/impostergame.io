-- Drops the entitlements table and the test "Office Life" premium category
-- added in 004_entitlements.sql. Safe as long as no real purchase has
-- granted anyone an entitlement row yet -- once Stripe is live and real
-- customers own real entitlements, dropping this table destroys their
-- purchase records. Check row count before running this against production
-- past that point.

delete from public.category_words where category_id = 'office_life';
delete from public.categories where id = 'office_life';
drop table if exists public.entitlements;
