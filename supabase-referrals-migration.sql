-- UnityCredit: Referrals (Supabase)
-- Run this in Supabase Dashboard -> SQL Editor
--
-- Adds:
-- - public.users.referral_code (stable code for each user)
-- - public.users.referred_by   (the code used at signup, if any)
--
-- Notes:
-- - The app will still work without this migration, but referral attribution won't persist in `public.users`.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Generate a stable short code from user UUID (uppercase hex).
CREATE OR REPLACE FUNCTION public.uc_referral_code(uid UUID)
RETURNS TEXT AS $$
  SELECT upper(substr(encode(digest(uid::text, 'sha256'), 'hex'), 1, 10));
$$ LANGUAGE sql IMMUTABLE;

-- Backfill existing users
UPDATE public.users
SET referral_code = public.uc_referral_code(id)
WHERE referral_code IS NULL OR referral_code = '';

-- Ensure new users get referral_code + referred_by from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, first_name, last_name, phone, referral_code, referred_by)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'phone',
    public.uc_referral_code(NEW.id),
    NEW.raw_user_meta_data->>'referred_by'
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    referral_code = COALESCE(NULLIF(public.users.referral_code, ''), EXCLUDED.referral_code),
    referred_by = COALESCE(public.users.referred_by, EXCLUDED.referred_by),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


