'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { ListingReportReason } from '../../api/listings/_helpers/reports';
import type { ListingSection } from '../../api/listings/_helpers/sections';
import type { ListingModerationStats } from '../../api/moderation/listings/_helpers/stats';

export type ListingModerationReport = {
  id: string;
  section: ListingSection;
  listingId: string;
  reason: ListingReportReason;
  comment: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  moderator_note: string | null;
  reporter: { id: string; telegram_username: string } | null;
  owner: { id: string; telegram_username: string; status: string; isBanned: boolean } | null;
  listing: { title: string | null; city: string | null; priceLabel: string | null; status: string | null } | null;
  totalReports: number;
};

const SECTION_LABELS: Record<ListingSection, string> = {
  market: 'Маркет',
  housing: 'Жильё',
  jobs: 'Работа',
};

const REASON_LABELS: Record<ListingReportReason, string> = {
  spam: 'Спам / нерелевантное',
  scam: 'Мошенничество / скам',
  escort: 'Эскорт / интим услуги',
  drugs: 'Наркотики',
  weapons: 'Оружие / опасные товары',
  other: 'Другое',
};

type Filters = {
  status: 'all' | 'new' | 'resolved';
  section: 'all' | ListingSection;
};

type FetchResponse = {
  ok: boolean;
  reports: ListingModerationReport[];
  stats: ListingModerationStats;
  reasons: ListingReportReason[];
  error?: string;
};

export function ModerationListingsClient() {
  const [filters, setFilters] = useState<Filters>({ status: 'all', section: 'all' });
  const [reports, setReports] = useState<ListingModerationReport[]>([]);
  const [stats, setStats] = useState<ListingModerationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const statsCards = useMemo(
    () => [
      { label: 'Новых жалоб (Маркет)', value: stats?.newReports.market ?? 0 },
      { label: 'Новых жалоб (Жильё)', value: stats?.newReports.housing ?? 0 },
      { label: 'Новых жалоб (Работа)', value: stats?.newReports.jobs ?? 0 },
      { label: 'Активных объявлений с жалобами', value: stats?.listingsWithReports.active ?? 0 },
      { label: 'Архивных объявлений с жалобами', value: stats?.listingsWithReports.archived ?? 0 },
    ],
    [stats],
  );

  const loadData = async (appliedFilters: Filters) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const params = new URLSearchParams();
    if (appliedFilters.status !== 'all') params.set('status', appliedFilters.status);
    if (appliedFilters.section !== 'all') params.set('section', appliedFilters.section);

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
    report: ListingModerationReport,
  ) => {
    const note = window.prompt('Комментарий модератора (опционально):', report.moderator_note ?? '') ?? '';
    setActionLoading(report.id);
    setError(null);

    try {
      const response = await fetch('/api/moderation/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reportId: report.id,
          section: report.section,
          listingId: report.listingId,
          ownerUserId: report.owner?.id,
          moderatorNote: note.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? 'Не удалось выполнить действие.');
      } else {
        setSuccessMessage('Действие выполнено.');
        await loadData(filters);
      }
    } catch (err) {
      console.error(err);
      setError('Произошла ошибка при выполнении действия.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="grid" style={{ gap: '16px' }}>
      <div className="card">
        <h2>Модерация объявлений</h2>
        <p className="subtitle">Жалобы по Маркету, Жилью и Работе. Скрывайте объявления и управляйте банами.</p>
      </div>

      <div className="card">
        <h3>Статистика</h3>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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
        <form onSubmit={handleSubmit} className="grid" style={{ gap: '12px' }}>
          <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <label className="input-label" style={{ display: 'grid', gap: 6 }}>
              Статус жалобы
              <select
                className="input"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as Filters['status'] }))}
              >
                <option value="all">Все</option>
                <option value="new">Новые</option>
                <option value="resolved">Обработанные</option>
              </select>
            </label>

            <label className="input-label" style={{ display: 'grid', gap: 6 }}>
              Раздел
              <select
                className="input"
                value={filters.section}
                onChange={(e) => setFilters((prev) => ({ ...prev, section: e.target.value as Filters['section'] }))}
              >
                <option value="all">Все разделы</option>
                <option value="market">Маркет</option>
                <option value="housing">Жильё</option>
                <option value="jobs">Работа</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="ghost-btn" type="button" onClick={() => setFilters({ status: 'all', section: 'all' })}>
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

      {successMessage ? (
        <div className="hint success" role="status">
          {successMessage}
        </div>
      ) : null}

      <div className="grid" style={{ gap: '12px' }}>
        {reports.length === 0 && !loading ? (
          <div className="card">
            <p className="subtitle">Жалобы по выбранным фильтрам не найдены.</p>
          </div>
        ) : null}

        {reports.map((report) => (
          <div key={report.id} className="profile-card">
            <div className="profile-card-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="profile-title">{report.listing?.title ?? 'Без названия'}</div>
                <div className="profile-subtitle">Раздел: {SECTION_LABELS[report.section]}</div>
                <div className="profile-subtitle">Всего жалоб: {report.totalReports}</div>
                <div className="profile-subtitle">Статус объявления: {report.listing?.status ?? 'unknown'}</div>
                <div className="profile-subtitle">
                  Владелец: {report.owner ? `@${report.owner.telegram_username}` : 'не найден'} ({
                    report.owner?.isBanned ? 'забанен' : 'активен'
                  })
                </div>
                <div className="profile-subtitle">
                  Автор жалобы: {report.reporter ? `@${report.reporter.telegram_username}` : 'не найден'}
                </div>
              </div>
              <span className={`pill ${report.status === 'resolved' ? 'pill-muted' : ''}`}>
                {report.status === 'resolved' ? 'Обработано' : 'Новое'}
              </span>
            </div>

            <div className="links-grid" style={{ alignItems: 'center' }}>
              <span className="pill">Причина: {REASON_LABELS[report.reason] ?? report.reason}</span>
              {report.listing?.city ? <span className="pill">{report.listing.city}</span> : null}
              {report.listing?.priceLabel ? <span className="pill pill-muted">{report.listing.priceLabel}</span> : null}
              <span className="pill pill-muted">Создано: {new Date(report.created_at).toLocaleString()}</span>
              {report.resolved_at ? (
                <span className="pill pill-muted">Обработано: {new Date(report.resolved_at).toLocaleString()}</span>
              ) : null}
            </div>

            {report.comment ? <p className="subtitle">Комментарий: {report.comment}</p> : null}
            {report.moderator_note ? <p className="subtitle">Заметка модератора: {report.moderator_note}</p> : null}

            <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => performAction('resolveReport', report)}
                disabled={actionLoading === report.id}
              >
                {actionLoading === report.id ? 'Сохраняем...' : 'Отметить обработанной'}
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => performAction('archiveListing', report)}
                disabled={actionLoading === report.id}
              >
                Скрыть объявление
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => performAction('unarchiveListing', report)}
                disabled={actionLoading === report.id}
              >
                Вернуть объявление
              </button>
              <button
                className="ghost-btn"
                type="button"
                onClick={() => performAction(report.owner?.isBanned ? 'unbanUser' : 'banUser', report)}
                disabled={actionLoading === report.id}
              >
                {report.owner?.isBanned ? 'Снять бан' : 'Забанить пользователя'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
