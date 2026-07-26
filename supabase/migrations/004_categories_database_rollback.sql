-- Drops the categories/category_words tables added in
-- 002_categories_database.sql, including all seeded word data.
--
-- Only safe to run if both clients have already been rolled back to reading
-- from their hardcoded src/data/categories.ts / App.tsx defaultCategories
-- arrays -- otherwise both apps will show zero categories immediately.

drop table if exists public.category_words;
drop table if exists public.categories;
