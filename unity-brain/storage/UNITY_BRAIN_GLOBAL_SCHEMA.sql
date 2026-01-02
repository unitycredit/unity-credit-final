-- Moved to /unity-brain/storage per architecture.
-- This is the shared Supabase schema used across multiple domains.

-- ==========================================================
-- Unity Brain: Global shared schema (multi-domain)
-- Run in Supabase SQL Editor.
-- ==========================================================

create schema if not exists unity_brain;

create table if not exists unity_brain.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_id text not null,
  domain text not null,
  kind text not null default 'chat',
  request_id text null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists unity_brain_interactions_user_created_idx
  on unity_brain.interactions (user_id, created_at desc);

create index if not exists unity_brain_interactions_kind_created_idx
  on unity_brain.interactions (kind, created_at desc);

alter table unity_brain.interactions enable row level security;
drop policy if exists "Users read own interactions" on unity_brain.interactions;
create policy "Users read own interactions"
  on unity_brain.interactions for select
  using (auth.uid() = user_id);

drop policy if exists "Users insert interactions" on unity_brain.interactions;
create policy "Users insert interactions"
  on unity_brain.interactions for insert
  with check (false);

create table if not exists unity_brain.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  app_id text not null,
  domain text not null,
  insight_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists unity_brain_insights_user_key_uq
  on unity_brain.insights (user_id, insight_key);

create index if not exists unity_brain_insights_user_updated_idx
  on unity_brain.insights (user_id, updated_at desc);

alter table unity_brain.insights enable row level security;
drop policy if exists "Users read own insights" on unity_brain.insights;
create policy "Users read own insights"
  on unity_brain.insights for select
  using (auth.uid() = user_id);

drop policy if exists "Users write insights" on unity_brain.insights;
create policy "Users write insights"
  on unity_brain.insights for insert
  with check (false);

create table if not exists unity_brain.rulesets (
  id uuid primary key default gen_random_uuid(),
  ruleset_key text not null unique,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table unity_brain.rulesets enable row level security;
drop policy if exists "No direct access rulesets" on unity_brain.rulesets;
create policy "No direct access rulesets"
  on unity_brain.rulesets for select
  using (false);


