-- ==========================================================
-- UnityCredit: Plaid accounts (per-user, scalable)
-- Run in Supabase SQL Editor.
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists public.plaid_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  item_id text null,
  plaid_account_id text not null,
  name text null,
  mask text null,
  official_name text null,
  type text null,
  subtype text null,
  current_balance numeric null,
  available_balance numeric null,
  iso_currency_code text not null default 'usd',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Dedupe per user + account
create unique index if not exists plaid_accounts_user_account_uq
  on public.plaid_accounts (user_id, plaid_account_id);

create index if not exists plaid_accounts_user_updated_idx
  on public.plaid_accounts (user_id, updated_at desc);

alter table public.plaid_accounts enable row level security;

drop policy if exists "Users can view own plaid accounts" on public.plaid_accounts;
create policy "Users can view own plaid accounts"
  on public.plaid_accounts for select
  using (auth.uid() = user_id);

-- Inserts/updates should be service-role only (sync job). Do NOT add insert/update policies.


