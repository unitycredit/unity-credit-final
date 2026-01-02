-- UnityCredit: Users + Profiles setup (Supabase)
-- Run this in Supabase Dashboard -> SQL Editor
--
-- Notes:
-- - Supabase Auth users live in `auth.users`
-- - This app stores the user profile in `public.users` (linked by id)
-- - `public.profiles` is provided as a compatibility VIEW (same data as `public.users`)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- public.users (profile table)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  -- Governance
  account_type TEXT NOT NULL DEFAULT 'personal', -- personal | institution | business_overhead
  -- Market selector (controls Local/Jewish vs General/National datasets)
  market_mode TEXT NOT NULL DEFAULT 'jewish_local', -- jewish_local | general_national
  blocked_at TIMESTAMP WITH TIME ZONE,
  blocked_reason TEXT,
  blocked_kind TEXT, -- e.g. "usage_business_inventory"
  blocked_source TEXT, -- e.g. "usage_audit"
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Safe backfill for existing installs (if table already existed without the column)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS market_mode TEXT NOT NULL DEFAULT 'jewish_local';

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- public.profiles (compatibility)
-- ============================================
CREATE OR REPLACE VIEW public.profiles AS
SELECT id, account_type, market_mode, blocked_at, blocked_reason, blocked_kind, blocked_source, first_name, last_name, phone, created_at, updated_at
FROM public.users;

-- ============================================
-- Auto-create profile row on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, account_type, market_mode, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'account_type',''), 'personal'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'market_mode',''), 'jewish_local'),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO UPDATE SET
    account_type = COALESCE(NULLIF(NEW.raw_user_meta_data->>'account_type',''), public.users.account_type),
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);


