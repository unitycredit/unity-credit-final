-- ==========================================================
-- UnityCredit: Backfill + index email in public.users (500k scale)
-- Run in Supabase SQL Editor (safe to run multiple times)
-- ==========================================================

-- Add column if missing
alter table public.users add column if not exists email text;

-- Backfill from auth.users (only where missing)
update public.users u
set email = lower(a.email)
from auth.users a
where a.id = u.id
  and (u.email is null or u.email = '');

-- Indexes (case-insensitive)
create index if not exists idx_users_email_lower on public.users (lower(email));
create unique index if not exists ux_users_email_lower on public.users (lower(email)) where email is not null;


