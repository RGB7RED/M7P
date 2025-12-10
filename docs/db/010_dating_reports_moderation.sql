-- Добавляет поля и индексы для модерации жалоб в dating_reports
alter table dating_reports
  add column if not exists status text not null default 'new',
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid references users(id) on delete set null,
  add column if not exists moderator_note text;

update dating_reports
set status = 'new'
where status = 'pending';

create index if not exists idx_dating_reports_status
  on dating_reports(status);

create index if not exists idx_dating_reports_created_at
  on dating_reports(created_at desc);

create index if not exists idx_dating_reports_reported_user
  on dating_reports (reported_user_id);

create index if not exists idx_dating_reports_reporter_user
  on dating_reports (reporter_user_id);
