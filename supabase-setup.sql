-- ============================================
-- UnityCredit Database Schema
-- Enterprise-level financial data management
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Users Table (extends Supabase auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- Credit Cards Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  last4 TEXT NOT NULL,
  name TEXT NOT NULL,
  apr NUMERIC(5, 2) CHECK (apr >= 0 AND apr <= 60),
  limit DECIMAL(10, 2) NOT NULL CHECK (limit >= 0),
  balance DECIMAL(10, 2) NOT NULL CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT balance_not_exceed_limit CHECK (balance <= limit)
);

-- Enable Row Level Security
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can insert own cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can update own cards" ON public.credit_cards;
DROP POLICY IF EXISTS "Users can delete own cards" ON public.credit_cards;

-- Create policies for credit cards
CREATE POLICY "Users can view own cards"
  ON public.credit_cards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cards"
  ON public.credit_cards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cards"
  ON public.credit_cards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own cards"
  ON public.credit_cards FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_created_at ON public.credit_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_id ON public.users(id);
-- Fast lookups for 500k users (case-insensitive email)
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON public.users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_lower ON public.users (lower(email)) WHERE email IS NOT NULL;

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for credit_cards updated_at
DROP TRIGGER IF EXISTS update_credit_cards_updated_at ON public.credit_cards;
CREATE TRIGGER update_credit_cards_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for users updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, phone)
  VALUES (
    NEW.id,
    lower(NEW.email),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Audit Logs Table (Optional - for enterprise)
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can view audit logs
CREATE POLICY "Service role can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (false); -- Only accessible via service role

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
