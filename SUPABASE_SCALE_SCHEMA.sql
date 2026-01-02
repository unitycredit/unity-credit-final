-- ============================================
-- UnityCredit Scale Schema (50k concurrent users)
-- Adds: plaid token store, user transactions, category catalog + indexes
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================

-- Enable extensions commonly used for indexing/search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- Plaid Tokens (server-only access via service role)
-- ============================================
CREATE TABLE IF NOT EXISTS public.plaid_tokens (
  item_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token_enc TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.plaid_tokens ENABLE ROW LEVEL SECURITY;

-- No public RLS policies; this table should be accessed only with service role.
DROP POLICY IF EXISTS "Service role only" ON public.plaid_tokens;
CREATE POLICY "Service role only"
  ON public.plaid_tokens FOR SELECT
  USING (false);

CREATE INDEX IF NOT EXISTS idx_plaid_tokens_user_id ON public.plaid_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_tokens_updated_at ON public.plaid_tokens(updated_at DESC);

-- ============================================
-- User Transactions (millions+ rows)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  posted_date DATE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  merchant_name TEXT,
  name TEXT,
  category_primary TEXT,
  category_detailed TEXT,
  raw JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_transactions ENABLE ROW LEVEL SECURITY;

-- Users can read their own transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.user_transactions;
CREATE POLICY "Users can view own transactions"
  ON public.user_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update (useful for Plaid refresh workers)
DROP POLICY IF EXISTS "Service role can write transactions" ON public.user_transactions;
CREATE POLICY "Service role can write transactions"
  ON public.user_transactions FOR INSERT
  WITH CHECK (false);

-- Uniqueness: prevent duplicates per user/item/transaction
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_tx_unique ON public.user_transactions(user_id, item_id, transaction_id);

-- Hot-path indexes for sub-second queries
CREATE INDEX IF NOT EXISTS idx_user_tx_user_date ON public.user_transactions(user_id, posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_tx_user_amount ON public.user_transactions(user_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_user_tx_item ON public.user_transactions(item_id);

-- Optional text search acceleration (merchant/name)
CREATE INDEX IF NOT EXISTS idx_user_tx_merchant_trgm ON public.user_transactions USING gin (merchant_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_tx_name_trgm ON public.user_transactions USING gin (name gin_trgm_ops);

-- ============================================
-- Master Category Catalog (Category List)
-- ============================================
CREATE TABLE IF NOT EXISTS public.category_catalog_entries (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payload JSONB NOT NULL
);

ALTER TABLE public.category_catalog_entries ENABLE ROW LEVEL SECURITY;

-- Readable publicly only if you want; default is locked down.
DROP POLICY IF EXISTS "Service role only" ON public.category_catalog_entries;
CREATE POLICY "Service role only"
  ON public.category_catalog_entries FOR SELECT
  USING (false);

CREATE INDEX IF NOT EXISTS idx_cat_catalog_kind ON public.category_catalog_entries(kind);
CREATE INDEX IF NOT EXISTS idx_cat_catalog_updated_at ON public.category_catalog_entries(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cat_catalog_label_trgm ON public.category_catalog_entries USING gin (label gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cat_catalog_payload_gin ON public.category_catalog_entries USING gin (payload);


