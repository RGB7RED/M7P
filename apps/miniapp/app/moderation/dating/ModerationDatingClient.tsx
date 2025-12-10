'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { DatingReportReason } from '../../api/dating/_helpers/reports';
import type { DatingModerationStats } from '../../api/moderation/dating/_helpers/stats';

export type ModerationReport = {
  id: string;
  reason: DatingReportReason;
  comment: string | null;
  created_at: string;
  status: string;
  resolved_at: string | null;
  moderator_note: string | null;
  reporter: { id: string; telegram_username: string } | null;
  target: { id: string; telegram_username: string; isBanned: boolean; totalReports: number } | null;
};

const REASON_LABELS: Record<DatingReportReason, string> = {
  escort: 'Эскорт / проституция',
  scam: 'Скам / мошенничество',
  drugs: 'Наркотики',
  weapons: 'Оружие / насилие',
  inappropriate: 'Неподобающий контент',
  other: 'Другое',
};

type Filters = {
  status: 'all' | 'new' | 'resolved';
  reason: '' | DatingReportReason;
  target: string;
};

type FetchResponse = {
  ok: boolean;
  reports: ModerationReport[];
  stats: DatingModerationStats;
  reasons: DatingReportReason[];
  error?: string;
};

export function ModerationDatingClient() {
  const [filters, setFilters] = useState<Filters>({ status: 'all', reason: '', target: '' });
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [stats, setStats] = useState<DatingModerationStats | null>(null);
  const [reasonOptions, setReasonOptions] = useState<DatingReportReason[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const statsCards = useMemo(
    () => [
      { label: 'Активных анкет', value: stats?.activeProfiles ?? 0 },
      { label: 'Забаненных профилей', value: stats?.bannedProfiles ?? 0 },
      { label: 'Новых жалоб', value: stats?.newReports ?? 0 },
      { label: 'За 24 часа', value: stats?.reports24h ?? 0 },
      { label: 'За 7 дней', value: stats?.reports7d ?? 0 },
    ],
    [stats],
  );

  const loadData = async (appliedFilters: Filters) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (appliedFilters.status !== 'all') params.set('status', appliedFilters.status);
    if (appliedFilters.reason) params.set('reason', appliedFilters.reason);
    if (appliedFilters.target.trim()) params.set('target', appliedFilters.target.trim());

    try {
      const response = await fetch(`/api/moderation/dating?${params.toString()}`);
      const data = (await response.json()) as FetchResponse;
      if (!data.ok) {
        setError(data.error ?? 'Не удалось загрузить жалобы.');
        setReports([]);
        return;
      }

      setReports(data.reports ?? []);
      setStats(data.stats ?? null);
      setReasonOptions(data.reasons ?? []);
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

  const performAction = async (action: 'resolveReport' | 'banUser' | 'unbanUser', report: ModerationReport) => {
    if (!report.target?.id) return;
    const note = window.prompt('Комментарий модератора (опционально):', report.moderator_note ?? '') ?? '';
    setActionLoading(report.id);
    try {
      const response = await fetch('/api/moderation/dating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reportId: report.id,
          targetUserId: report.target.id,
          moderatorNote: note.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError(data?.error ?? 'Не удалось выполнить действие.');
      } else {
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
        <h2>Модерация знакомств</h2>
        <p className="subtitle">Просмотр и обработка жалоб, управление банами.</p>
      </div>

      <div className="card">
        <h3>Статистика</h3>
        <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
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
          <div className="links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
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
              Тип жалобы
              <select
                className="input"
                value={filters.reason}
                onChange={(e) => setFilters((prev) => ({ ...prev, reason: e.target.value as Filters['reason'] }))}
              >
                <option value="">Все категории</option>
                {reasonOptions.map((reason) => (
                  <option key={reason} value={reason}>
                    {REASON_LABELS[reason] ?? reason}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-label" style={{ display: 'grid', gap: 6 }}>
              Пользователь (username или ID)
              <input
                className="input"
                placeholder="@username или UUID"
                value={filters.target}
                onChange={(e) => setFilters((prev) => ({ ...prev, target: e.target.value }))}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button className="ghost-btn" type="button" onClick={() => setFilters({ status: 'all', reason: '', target: '' })}>
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
                <div className="profile-title">{report.target ? `@${report.target.telegram_username}` : 'Неизвестный пользователь'}</div>
                <div className="profile-subtitle">Всего жалоб: {report.target?.totalReports ?? 0}</div>
                <div className="profile-subtitle">{report.target?.isBanned ? 'Сейчас забанен' : 'Сейчас активен'}</div>
              </div>
              <span className={`pill ${report.status === 'resolved' ? 'pill-muted' : ''}`}>
                {report.status === 'resolved' ? 'Обработано' : 'Новое'}
              </span>
            </div>

            <div className="links-grid" style={{ alignItems: 'center' }}>
              <span className="pill">Категория: {REASON_LABELS[report.reason] ?? report.reason}</span>
              <span className="pill pill-muted">Создано: {new Date(report.created_at).toLocaleString()}</span>
            </div>

            {report.comment ? <p className="subtitle">Комментарий: {report.comment}</p> : null}
            {report.reporter ? (
              <p className="subtitle">Пожаловался: @{report.reporter.telegram_username}</p>
            ) : (
              <p className="subtitle">Отправитель не найден</p>
            )}

            {report.moderator_note ? <p className="subtitle">Заметка: {report.moderator_note}</p> : null}

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

              {!report.target?.isBanned ? (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('banUser', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : '🚫 Забанить пользователя'}
                </button>
              ) : (
                <button
                  className="ghost-btn"
                  disabled={actionLoading === report.id}
                  onClick={() => performAction('unbanUser', report)}
                >
                  {actionLoading === report.id ? 'Применяем...' : '🔓 Снять бан'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
