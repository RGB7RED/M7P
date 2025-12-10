'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Section = 'market' | 'housing' | 'jobs';

type ListingReport = {
  id: string;
  section: Section;
  reason: string;
  comment: string | null;
  status: 'new' | 'in_review' | 'resolved';
  created_at: string;
  resolved_at: string | null;
  moderator_note: string | null;
  listing_id: string;
  listing: { id: string; title: string; city: string | null; priceLabel: string | null; status: string } | null;
  reporter: { id: string; telegram_username: string } | null;
  owner: { id: string; telegram_username: string; status: string } | null;
  totalReports: number;
};

type ModerationStats = {
  newBySection: Record<Section, number>;
  listingsWithReports: { active: number; archived: number };
};

type FetchResponse = {
  ok: boolean;
  reports: ListingReport[];
  stats: ModerationStats;
  error?: string;
};

const SECTION_LABELS: Record<Section, string> = {
  market: 'Маркет',
  housing: 'Жильё',
  jobs: 'Работа',
};

const FILTER_SECTION_OPTIONS: { value: '' | Section; label: string }[] = [
  { value: '', label: 'Все разделы' },
  { value: 'market', label: 'Маркет' },
  { value: 'housing', label: 'Жильё' },
  { value: 'jobs', label: 'Работа' },
];

export function ModerationListingsClient() {
  const [filters, setFilters] = useState<{ status: 'all' | 'new' | 'in_review' | 'resolved'; section: '' | Section }>({
    status: 'all',
    section: '',
  });
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statsCards = useMemo(() => {
    return [
      { label: 'Новые жалобы — Маркет', value: stats?.newBySection.market ?? 0 },
      { label: 'Новые жалобы — Жильё', value: stats?.newBySection.housing ?? 0 },
      { label: 'Новые жалобы — Работа', value: stats?.newBySection.jobs ?? 0 },
      { label: 'Активных объявлений с жалобами', value: stats?.listingsWithReports.active ?? 0 },
      { label: 'Архивных объявлений с жалобами', value: stats?.listingsWithReports.archived ?? 0 },
    ];
  }, [stats]);

  const loadData = async (appliedFilters: typeof filters) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (appliedFilters.status !== 'all') params.set('status', appliedFilters.status);
    if (appliedFilters.section) params.set('section', appliedFilters.section);

    try {
      const response = await fetch(`/api/moderation/listings?${params.toString()}`);
      const data = (await response.json()) as FetchResponse;
      if (!data.ok) {
        setError(data.error ?? 'Не удалось загрузить жалобы.');
        setReports([]);
        return;
      }

      setReports(data.reports ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить данные.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    loadData(filters);
  };

  const performAction = async (
    action: 'resolveReport' | 'archiveListing' | 'unarchiveListing' | 'banUser' | 'unbanUser',
    report: ListingReport,
  ) => {
    const note = window.prompt('Комментарий модератора (опционально):', report.moderator_note ?? '') ?? '';
    setActionLoading(report.id);

    const payload: any = {
      action,
      reportId: report.id,
      section: report.section,
      listingId: report.listing_id,
      ownerUserId: report.owner?.id,
      moderatorNote: note.trim() || undefined,
    };

    try {
      const response = await fetch('/api/moderation/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? 'Не удалось выполнить действие.');
      } else {
        await loadData(filters);
      }
    } catch (err) {
      console.error(err);
      setError('Не удалось выполнить действие.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="grid" style={{ gap: '16px' }}>
      <div className="card">
        <h1 className="hero-title">Модерация объявлений</h1>
        <p className="hero-text">
          Жалобы на объявления в Маркете, Жилье и Работе. Здесь можно просматривать обращения пользователей, скрывать или
          возвращать объявления и управлять статусами владельцев.
        </p>
      </div>

      <div className="card">
        <h3>Статистика</h3>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {statsCards.map((item) => (
            <div key={item.label} className="profile-card-compact" style={{ background: 'rgba(255,255,255,0.02)', padding: 12 }}>
              <div className="profile-title">{item.value}</div>
              <div className="profile-subtitle">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Фильтры</h3>
        <form onSubmit={handleSubmit} className="grid" style={{ gap: 12 }}>
          <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <label className="input-label" style={{ display: 'grid', gap: 6 }}>
              Статус жалобы
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as typeof prev.status }))}
              >
                <option value="all">Все</option>
                <option value="new">Новые</option>
                <option value="in_review">В работе</option>
                <option value="resolved">Обработанные</option>
              </select>
            </label>

            <label className="input-label" style={{ display: 'grid', gap: 6 }}>
              Раздел
              <select
                className="input"
                value={filters.section}
                onChange={(e) => setFilters((prev) => ({ ...prev, section: e.target.value as typeof prev.section }))}
              >
                {FILTER_SECTION_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="ghost-btn" type="button" onClick={() => setFilters({ status: 'all', section: '' })}>
              Сбросить
            </button>
            <button className="primary-btn" type="submit" disabled={loading}>
              {loading ? 'Загружаем...' : 'Показать'}
            </button>
          </div>
        </form>
      </div>

      {error ? (
        <div className="hint error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid" style={{ gap: 12 }}>
        {reports.length === 0 && !loading ? (
          <div className="card">
            <p className="subtitle">Жалобы по выбранным фильтрам не найдены.</p>
          </div>
        ) : null}

        {reports.map((report) => (
          <div key={report.id} className="profile-card">
            <div className="profile-card-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="profile-title">{SECTION_LABELS[report.section]}</div>
                <div className="profile-subtitle">Всего жалоб: {report.totalReports}</div>
                <div className="profile-subtitle">Статус объявления: {report.listing?.status ?? 'не найдено'}</div>
              </div>
              <span
                className={`status-badge ${
                  report.status === 'resolved'
                    ? 'status-resolved'
                    : report.status === 'in_review'
                      ? 'status-review'
                      : 'status-new'
                }`}
              >
                {report.status === 'resolved'
                  ? 'Обработано'
                  : report.status === 'in_review'
                    ? 'В работе'
                    : 'Новое'}
              </span>
            </div>

            <div className="links-grid" style={{ alignItems: 'center' }}>
              {report.listing ? <span className="pill">{report.listing.title}</span> : <span className="pill pill-muted">Объявление не найдено</span>}
              {report.listing?.city ? <span className="pill pill-muted">{report.listing.city}</span> : null}
              {report.listing?.priceLabel ? <span className="pill">{report.listing.priceLabel}</span> : null}
              <span className="pill pill-muted">Создано: {new Date(report.created_at).toLocaleString()}</span>
            </div>

            <div className="links-grid" style={{ alignItems: 'center' }}>
              {report.reporter ? (
                <span className="pill">Автор жалобы: @{report.reporter.telegram_username}</span>
              ) : (
                <span className="pill pill-muted">Отправитель не найден</span>
              )}
              {report.owner ? (
                <span className="pill">Владелец: @{report.owner.telegram_username}</span>
              ) : (
                <span className="pill pill-muted">Владелец не найден</span>
              )}
              {report.owner ? (
                <span className={`pill ${report.owner.status === 'banned' ? '' : 'pill-muted'}`}>
                  Статус владельца: {report.owner.status}
                </span>
              ) : null}
            </div>

            <p className="subtitle">Причина: {report.reason}</p>
            {report.comment ? <p className="subtitle">Комментарий: {report.comment}</p> : null}
            {report.moderator_note ? <p className="subtitle">Заметка модератора: {report.moderator_note}</p> : null}
            {report.resolved_at ? (
              <p className="subtitle">Обработано: {new Date(report.resolved_at).toLocaleString()}</p>
            ) : null}

            <div className="card-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
              {report.status !== 'resolved' ? (
                <button
                  className="primary-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('resolveReport', report)}
                >
                  {actionLoading === report.id ? 'Сохраняем...' : 'Пометить как обработанную'}
                </button>
              ) : null}

              {report.listing?.status !== 'archived' ? (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('archiveListing', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : 'Скрыть объявление'}
                </button>
              ) : (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('unarchiveListing', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : 'Вернуть объявление'}
                </button>
              )}

              {report.owner?.status === 'banned' ? (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('unbanUser', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : '🔓 Снять бан'}
                </button>
              ) : (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('banUser', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : '🚫 Забанить владельца'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
