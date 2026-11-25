-- ============================================================
-- Velfrok: Courier Companies Table + Seed
-- Run this once in your Supabase SQL Editor
-- ============================================================

-- 1. Create the table (if not already created)
create table if not exists courier_companies (
  id     text primary key,
  name   text not null,
  active boolean not null default true
);

-- 2. Seed the 5 default courier companies
-- (uses INSERT ... ON CONFLICT DO NOTHING so it's safe to run again)
insert into courier_companies (id, name, active) values
  ('valmo',       'Valmo',        true),
  ('bluedart',    'Blue Dart',    true),
  ('ecom',        'Ecom Express', true),
  ('swa',         'SWA',          true),
  ('elasticrun',  'ElasticRun',   true)
on conflict (id) do nothing;

-- 3. (Optional) Enable Row Level Security — admin API uses service_role key
--    so it bypasses RLS. This is just good practice.
alter table courier_companies enable row level security;

-- Allow service_role full access (your admin API uses this)
create policy "service_role_all" on courier_companies
  for all
  using (true)
  with check (true);
