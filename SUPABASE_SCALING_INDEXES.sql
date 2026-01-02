-- ==========================================================
-- UnityCredit Scaling Indexes + Tables (50k+ concurrent users)
-- Run in Supabase SQL Editor
-- ==========================================================

-- 1) Master Category List / Catalog
-- Stored in public.optimization (see SUPABASE_OPTIMIZATION_TABLE.sql)
-- Existing index:
--   optimization_kind_created_at_idx on (kind, created_at desc)
-- Add a JSONB GIN index for fast payload queries (optional).
create index if not exists optimization_payload_gin
  on public.optimization using gin (payload);

-- 2) Plaid transactions (optional: for true per-user scale)
-- Today the app uses snapshots; for millions of rows, persist transactions per-user.
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

-- Enforce dedupe per user + Plaid transaction id
create unique index if not exists plaid_transactions_user_txid_uq
  on public.plaid_transactions (user_id, plaid_transaction_id);

-- Critical query patterns:
-- - “latest N transactions for a user”
create index if not exists plaid_transactions_user_date_idx
  on public.plaid_transactions (user_id, occurred_on desc);

-- - “aggregate spend by category for a user over a window”
create index if not exists plaid_transactions_user_cat_date_idx
  on public.plaid_transactions (user_id, category_primary, occurred_on desc);

-- - “merchant-based rollups”
create index if not exists plaid_transactions_user_merchant_date_idx
  on public.plaid_transactions (user_id, merchant_name, occurred_on desc);

-- RLS: only the user can read their own transactions
alter table public.plaid_transactions enable row level security;
drop policy if exists "Users can view own plaid transactions" on public.plaid_transactions;
create policy "Users can view own plaid transactions"
  on public.plaid_transactions for select
  using (auth.uid() = user_id);

-- Optional: inserts are typically service-role only (sync job). Do not create insert policy here.


