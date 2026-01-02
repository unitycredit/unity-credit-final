-- ==========================================================
-- UnityCredit: Support messages (admin-only read)
-- Run in Supabase SQL Editor.
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade not null,
  email text null,
  subject text null,
  message text not null,
  forwarded_ok boolean not null default false,
  forwarded_status int null,
  forwarded_error text null
);

create index if not exists support_messages_user_created_idx
  on public.support_messages (user_id, created_at desc);

create index if not exists support_messages_created_idx
  on public.support_messages (created_at desc);

alter table public.support_messages enable row level security;

-- Users should NOT read/write this table directly.
-- Admin-only access is via service-role / admin endpoints.
drop policy if exists "No direct writes (support_messages)" on public.support_messages;
create policy "No direct writes (support_messages)"
  on public.support_messages for all
  using (false)
  with check (false);


