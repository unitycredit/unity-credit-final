-- ==========================================================
-- UnityCredit: Plaid transactions (per-user, scalable)
-- Run in Supabase SQL Editor.
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists public.plaid_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plaid_transaction_id text not null,
  amount numeric not null,
  currency text not null default 'usd',
  name text null,
  merchant_name text null,
  category_primary text null,
  category_detailed text null,
  occurred_on date not null,
  created_at timestamptz not null default now()
);

-- Dedupe per user + Plaid transaction id
create unique index if not exists plaid_transactions_user_txid_uq
  on public.plaid_transactions (user_id, plaid_transaction_id);

-- Hot-path query patterns
create index if not exists plaid_transactions_user_date_idx
  on public.plaid_transactions (user_id, occurred_on desc);

create index if not exists plaid_transactions_user_cat_date_idx
  on public.plaid_transactions (user_id, category_primary, occurred_on desc);

create index if not exists plaid_transactions_user_merchant_date_idx
  on public.plaid_transactions (user_id, merchant_name, occurred_on desc);

alter table public.plaid_transactions enable row level security;

drop policy if exists "Users can view own plaid transactions" on public.plaid_transactions;
create policy "Users can view own plaid transactions"
  on public.plaid_transactions for select
  using (auth.uid() = user_id);

-- Inserts should be service-role only (sync job). Do NOT add an insert policy.


