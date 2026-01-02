-- ==========================================================
-- UnityCredit User Savings Storage (500k+ scale) — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create extension if not exists pgcrypto;

-- Snapshot of a user's latest Unity Credit savings recommendations (no raw transactions).
create table if not exists public.user_savings_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  kind text not null default 'savings_finder',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists user_savings_snapshots_user_created_idx
  on public.user_savings_snapshots (user_id, created_at desc);

create index if not exists user_savings_snapshots_kind_created_idx
  on public.user_savings_snapshots (kind, created_at desc);

alter table public.user_savings_snapshots enable row level security;
drop policy if exists "Users can read own savings snapshots" on public.user_savings_snapshots;
create policy "Users can read own savings snapshots"
  on public.user_savings_snapshots for select
  using (auth.uid() = user_id);

-- Inserts should be server-driven; you can enable user insert later if desired.
drop policy if exists "Service role writes savings snapshots" on public.user_savings_snapshots;
create policy "Service role writes savings snapshots"
  on public.user_savings_snapshots for insert
  with check (false);

-- Track when a user clicks "apply" on a recommendation (savings attribution).
create table if not exists public.user_savings_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_kind text not null default 'apply',
  monthly_savings int not null,
  title_yi text not null,
  category text null,
  target_budget_key text null,
  created_at timestamptz not null default now()
);

create index if not exists user_savings_events_user_created_idx
  on public.user_savings_events (user_id, created_at desc);

create index if not exists user_savings_events_created_idx
  on public.user_savings_events (created_at desc);

alter table public.user_savings_events enable row level security;
drop policy if exists "Users can insert own savings events" on public.user_savings_events;
create policy "Users can insert own savings events"
  on public.user_savings_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own savings events" on public.user_savings_events;
create policy "Users can read own savings events"
  on public.user_savings_events for select
  using (auth.uid() = user_id);


