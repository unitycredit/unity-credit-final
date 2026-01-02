-- ==========================================================
-- UnityCredit: Bank Sync State (per-user) — Supabase Postgres
-- Tracks last sync time + connection status for clear dashboard messaging.
-- Run in Supabase SQL Editor.
-- ==========================================================

create extension if not exists pgcrypto;

create table if not exists public.bank_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'plaid',
  status text not null default 'never_connected',
  last_sync_at timestamptz null,
  last_success_at timestamptz null,
  last_error_code text null,
  last_error_message text null,
  updated_at timestamptz not null default now(),
  constraint bank_sync_state_status_chk check (status in ('never_connected','active','reconnect_required','error'))
);

create index if not exists bank_sync_state_status_updated_idx
  on public.bank_sync_state (status, updated_at desc);

alter table public.bank_sync_state enable row level security;

drop policy if exists "Users can read own bank sync state" on public.bank_sync_state;
create policy "Users can read own bank sync state"
  on public.bank_sync_state for select
  using (auth.uid() = user_id);

-- Inserts/updates should be server-driven only. Do NOT allow anon/auth writes.
drop policy if exists "No direct writes (bank_sync_state)" on public.bank_sync_state;
create policy "No direct writes (bank_sync_state)"
  on public.bank_sync_state for all
  using (false)
  with check (false);

-- Maintain updated_at automatically (shared helper may already exist)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_bank_sync_state_updated_at on public.bank_sync_state;
create trigger set_bank_sync_state_updated_at
  before update on public.bank_sync_state
  for each row execute function public.set_updated_at();


