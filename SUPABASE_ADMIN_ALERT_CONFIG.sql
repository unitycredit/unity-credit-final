-- ==========================================================
-- Admin Alert Config (Owner Email + Phone) — Supabase Postgres
-- Run in Supabase SQL Editor
-- ==========================================================

create table if not exists public.admin_alert_config (
  key text primary key,
  owner_email text null,
  owner_phone text null,
  updated_at timestamptz not null default now()
);

alter table public.admin_alert_config disable row level security;

insert into public.admin_alert_config (key, owner_email, owner_phone)
values ('owner', null, null)
on conflict (key) do nothing;


