-- Жалобы на объявления (Маркет / Жильё / Работа)

create table if not exists listing_reports (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in ('market', 'housing', 'jobs')),
  listing_id uuid not null,
  reporter_user_id uuid not null references users(id) on delete cascade,
  owner_user_id uuid not null references users(id) on delete cascade,
  reason text not null,
  comment text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references users(id) on delete set null,
  moderator_note text
);

create index if not exists idx_listing_reports_section_listing on listing_reports(section, listing_id);
create index if not exists idx_listing_reports_owner on listing_reports(owner_user_id);
create index if not exists idx_listing_reports_reporter on listing_reports(reporter_user_id);

create unique index if not exists uniq_listing_report_per_user
  on listing_reports(section, listing_id, reporter_user_id);
