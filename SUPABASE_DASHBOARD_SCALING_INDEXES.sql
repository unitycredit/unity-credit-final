-- ==========================================================
-- UnityCredit: Dashboard hot-path indexes (scale + latency)
-- Run in Supabase SQL Editor (safe to re-run).
-- ==========================================================

-- Credit cards: dashboard frequently filters by user_id and orders by created_at.
create index if not exists credit_cards_user_created_at_idx
  on public.credit_cards (user_id, created_at desc);

-- Savings events: monthly summary filters by (user_id, event_kind) with a created_at window.
create index if not exists user_savings_events_user_kind_created_at_idx
  on public.user_savings_events (user_id, event_kind, created_at desc);

-- Savings snapshots: monthly summary filters by (user_id, kind) and orders by created_at.
create index if not exists user_savings_snapshots_user_kind_created_at_idx
  on public.user_savings_snapshots (user_id, kind, created_at desc);


