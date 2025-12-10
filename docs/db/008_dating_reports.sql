-- Жалобы на анкеты знакомств
create table if not exists dating_reports (
  id uuid primary key default gen_random_uuid(),
  reported_user_id uuid not null references users (id) on delete cascade,
  reporter_user_id uuid not null references users (id) on delete cascade,
  reason text not null,
  comment text,
  created_at timestamptz not null default now(),
  status text not null default 'new',
  resolved_at timestamptz,
  resolved_by_user_id uuid references users (id) on delete set null,
  moderator_note text
);

create index if not exists idx_dating_reports_reported_user
  on dating_reports (reported_user_id);

create index if not exists idx_dating_reports_reporter_user
  on dating_reports (reporter_user_id);

-- Приводим старые статусы к единому виду
update dating_reports set status = 'new' where status = 'pending';
