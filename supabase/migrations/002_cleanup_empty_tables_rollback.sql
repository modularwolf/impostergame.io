-- Recreates rooms_backup / rooms_duplicate_v2 with their original (empty)
-- shape. Does NOT restore data — there was none; both tables were
-- confirmed empty before 002_cleanup_empty_tables.sql dropped them.

create table if not exists public.rooms_backup (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz
);

create table if not exists public.rooms_duplicate_v2 (
  code text primary key,
  state jsonb not null,
  updated_at timestamptz
);
