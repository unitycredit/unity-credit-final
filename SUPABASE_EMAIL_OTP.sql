-- ==========================================================
-- UnityCredit Email OTP (Resend-backed) — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

-- Crypto helpers (for digest / gen_random_uuid)
create extension if not exists pgcrypto;

-- Stores short-lived 6-digit OTPs for email verification.
create table if not exists public.uc_email_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text not null,
  email_hash text not null,
  purpose text not null default 'signup',
  salt text not null,
  code_hash text not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz null
);

-- Core access patterns:
-- - fetch latest active OTP by email_hash + purpose
create index if not exists uc_email_otps_lookup_idx
  on public.uc_email_otps (email_hash, purpose, created_at desc);

-- - cleanup scans / monitoring
create index if not exists uc_email_otps_expires_idx
  on public.uc_email_otps (expires_at desc);

-- - user-based lookups (rare but useful)
create index if not exists uc_email_otps_user_idx
  on public.uc_email_otps (user_id, created_at desc);

-- Security: keep this service-role only (no RLS policies).
alter table public.uc_email_otps enable row level security;
drop policy if exists "No direct access (otp)" on public.uc_email_otps;
create policy "No direct access (otp)"
  on public.uc_email_otps for all
  using (false)
  with check (false);

-- Issue a new OTP:
-- - consumes any previous active OTPs for this (email_hash,purpose)
-- - inserts new OTP row
create or replace function public.uc_issue_email_otp(
  p_user_id uuid,
  p_email text,
  p_email_hash text,
  p_purpose text,
  p_salt text,
  p_code_hash text,
  p_ttl_seconds int
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  update public.uc_email_otps
    set consumed_at = now()
    where email_hash = p_email_hash
      and purpose = p_purpose
      and consumed_at is null;

  insert into public.uc_email_otps (user_id, email, email_hash, purpose, salt, code_hash, expires_at)
    values (p_user_id, p_email, p_email_hash, p_purpose, p_salt, p_code_hash, now() + make_interval(secs => greatest(p_ttl_seconds, 60)))
    returning id into v_id;

  return v_id;
end;
$$;

-- Verify/consume an OTP atomically:
-- - finds latest active OTP for (email_hash,purpose)
-- - increments attempts if incorrect (and blocks after max attempts)
-- - consumes OTP if correct
create or replace function public.uc_verify_email_otp(
  p_email_hash text,
  p_purpose text,
  p_code text,
  p_max_attempts int
)
returns table(ok boolean, user_id uuid)
language plpgsql
security definer
as $$
declare
  rec record;
  computed text;
begin
  select *
    into rec
    from public.uc_email_otps
    where email_hash = p_email_hash
      and purpose = p_purpose
      and consumed_at is null
      and expires_at > now()
    order by created_at desc
    limit 1;

  if rec is null then
    ok := false;
    user_id := null;
    return;
  end if;

  if coalesce(rec.attempts, 0) >= greatest(p_max_attempts, 1) then
    ok := false;
    user_id := null;
    return;
  end if;

  computed := encode(digest(rec.salt || '|' || p_code, 'sha256'), 'hex');

  if computed = rec.code_hash then
    update public.uc_email_otps
      set consumed_at = now()
      where id = rec.id;
    ok := true;
    user_id := rec.user_id;
    return;
  end if;

  update public.uc_email_otps
    set attempts = attempts + 1
    where id = rec.id;

  ok := false;
  user_id := null;
  return;
end;
$$;


