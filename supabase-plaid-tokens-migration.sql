-- UnityCredit: Plaid token storage (Supabase)
-- Run this in Supabase Dashboard -> SQL Editor
--
-- SECURITY:
-- - RLS enabled and NO policies are added.
-- - This means only service-role (server) can read/write.
-- - Tokens are stored encrypted-at-rest at the app layer when PLAID_TOKEN_ENC_KEY (or AUDIT_LOG_ENC_KEY) is set.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.plaid_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  item_id TEXT NOT NULL UNIQUE,
  access_token_enc TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.plaid_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plaid_tokens_item_id ON public.plaid_tokens(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_tokens_user_id ON public.plaid_tokens(user_id);


