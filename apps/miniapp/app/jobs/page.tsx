'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListingContactActions } from '../_components/ListingContactActions';
import { ListingReportButton } from '../_components/ListingReportButton';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';

const STATUS_OPTIONS = ['active', 'draft', 'archived'] as const;

type JobListing = {
  id: string;
  title: string;
  description: string | null;
  role_type: string;
  city: string | null;
  employment_format: string | null;
  salary_from: number | null;
  salary_to: number | null;
  currency: string | null;
  experience_level: string | null;
  status: string;
  created_at: string;
};

type SavePayload = {
  id?: string;
  title: string;
  description: string;
  role_type: string;
  city: string;
  employment_format: string;
  salary_from: string;
  salary_to: string;
  currency: string;
  experience_level: string;
  status: (typeof STATUS_OPTIONS)[number];
};

type FilterState = {
  city: string;
  role_type: string;
  employment_format: string;
};

const emptyForm: SavePayload = {
  title: '',
  description: '',
  role_type: '',
  city: '',
  employment_format: '',
  salary_from: '',
  salary_to: '',
  currency: 'RUB',
  experience_level: '',
  status: 'active',
};

function ListingCard({
  listing,
  onEdit,
  children,
}: {
  listing: JobListing;
  onEdit?: (item: JobListing) => void;
  children?: ReactNode;
}) {
  return (
    <div className="profile-card profile-card-compact">
      <div className="card-header">
        <div>
          <div className="profile-title">{listing.title}</div>
          <div className="profile-subtitle">{listing.role_type}</div>
        </div>
        <span className={`pill ${listing.status !== 'active' ? 'pill-muted' : ''}`}>{listing.status}</span>
      </div>

      <div className="links-grid">
        {listing.city ? <span className="pill">{listing.city}</span> : null}
        {listing.employment_format ? <span className="pill">{listing.employment_format}</span> : null}
        {listing.experience_level ? <span className="pill pill-muted">Опыт: {listing.experience_level}</span> : null}
        {(listing.salary_from !== null || listing.salary_to !== null) && (
          <span className="pill">
            {listing.salary_from ?? 'от'} - {listing.salary_to ?? '...'} {listing.currency ?? 'RUB'}
          </span>
        )}
      </div>

      {listing.description ? <p className="subtitle">{listing.description}</p> : null}

      <div className="card-actions">
        <span className="subtitle">Создано: {new Date(listing.created_at).toLocaleDateString()}</span>
        {onEdit ? (
          <button className="ghost-btn" onClick={() => onEdit(listing)}>
            Редактировать
          </button>
        ) : null}
      </div>
      {children ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div> : null}
    </div>
  );
}

export default function JobsPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('mine') ? 'mine' : 'feed';
  const [activeTab, setActiveTab] = useState<'feed' | 'mine' | 'form'>(defaultTab);
  const [form, setForm] = useState<SavePayload>(emptyForm);
  const [feedFilter, setFeedFilter] = useState<FilterState>({ city: '', role_type: '', employment_format: '' });
  const [feed, setFeed] = useState<JobListing[]>([]);
  const [mine, setMine] = useState<JobListing[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportToast, setReportToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoadingFeed(true);
    const params = new URLSearchParams({ status: 'active' });
    if (feedFilter.city.trim()) params.set('city', feedFilter.city.trim());
    if (feedFilter.role_type.trim()) params.set('role_type', feedFilter.role_type.trim());
    if (feedFilter.employment_format.trim()) params.set('employment_format', feedFilter.employment_format.trim());

    try {
      const response = await fetch(`/api/jobs/listings?${params.toString()}`);
      const data = await response.json();
      if (data?.ok) {
        setFeed(data.data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFeed(false);
    }
  };

  const loadMine = async () => {
    setLoadingMine(true);
    try {
      const response = await fetch('/api/jobs/listings?mine=true');
      const data = await response.json();
      if (data?.ok) {
        setMine(data.data ?? []);
      } else if (data?.error === 'UNAUTHORIZED') {
        setMine([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMine(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'feed') {
      loadFeed();
    }
  }, [activeTab, feedFilter.city, feedFilter.role_type, feedFilter.employment_format]);

  useEffect(() => {
    if (activeTab === 'mine') {
      loadMine();
    }
  }, [activeTab]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setToast(null);

    if (!form.title.trim() || !form.role_type.trim()) {
      setError('Заполните заголовок и тип роли.');
      return;
    }

    setIsSubmitting(true);

    const payload: any = {
      id: form.id,
      title: form.title.trim(),
      description: form.description.trim(),
      role_type: form.role_type.trim(),
      city: form.city.trim(),
      employment_format: form.employment_format.trim(),
      currency: form.currency.trim() || 'RUB',
      experience_level: form.experience_level.trim(),
      status: form.status,
    };

    if (form.salary_from.trim()) {
      const salaryFrom = Number(form.salary_from);
      if (Number.isFinite(salaryFrom)) {
        payload.salary_from = salaryFrom;
      }
    }

    if (form.salary_to.trim()) {
      const salaryTo = Number(form.salary_to);
      if (Number.isFinite(salaryTo)) {
        payload.salary_to = salaryTo;
      }
    }

    try {
      const response = await fetch('/api/jobs/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError('Не удалось сохранить объявление. Проверьте поля и попробуйте снова.');
        return;
      }

      setToast('Объявление по работе сохранено');
      setForm({ ...emptyForm });
      loadMine();
      if (activeTab === 'feed') {
        loadFeed();
      }
    } catch (err) {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: JobListing) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      role_type: item.role_type,
      city: item.city ?? '',
      employment_format: item.employment_format ?? '',
      salary_from: item.salary_from !== null ? String(item.salary_from) : '',
      salary_to: item.salary_to !== null ? String(item.salary_to) : '',
      currency: item.currency ?? 'RUB',
      experience_level: item.experience_level ?? '',
      status: (STATUS_OPTIONS.includes(item.status as any) ? item.status : 'active') as (typeof STATUS_OPTIONS)[number],
    });
    setActiveTab('form');
    setToast(null);
    setError(null);
  };

  const handleReportSent = (autoArchived: boolean) => {
    setReportToast(
      autoArchived
        ? 'Жалоба отправлена: объявление временно скрыто до проверки.'
        : 'Жалоба отправлена модераторам.',
    );
    if (autoArchived && activeTab === 'feed') {
      loadFeed();
    }
  };

  return (
    <SectionLayout>
      <SectionHeaderCard
        title="Работа"
        subtitle="Вакансии и резюме с фильтрами по городу, формату и типу роли."
      />

      {reportToast ? (
        <div className="hint success" role="status">
          {reportToast}
        </div>
      ) : null}

      <div className="grid">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Навигация</h2>
            <p className="subtitle">Лента, личные объявления и форма</p>
          </div>
          <div className="links-grid">
            <button className={`ghost-btn ${activeTab === 'feed' ? 'tab-active' : ''}`} onClick={() => setActiveTab('feed')}>
              Лента
            </button>
            <button className={`ghost-btn ${activeTab === 'mine' ? 'tab-active' : ''}`} onClick={() => setActiveTab('mine')}>
              Мои объявления
            </button>
            <button className={`ghost-btn ${activeTab === 'form' ? 'tab-active' : ''}`} onClick={() => setActiveTab('form')}>
              Создать / редактировать
            </button>
          </div>
        </div>
        </div>

        {activeTab === 'form' ? (
          <div className="card">
          <div className="card-header">
            <h2>{form.id ? 'Редактирование объявления' : 'Новое объявление'}</h2>
            {form.id ? <span className="pill">ID: {form.id}</span> : null}
          </div>

          {toast ? (
            <div className="hint success" role="status">
              {toast}
            </div>
          ) : null}
          {error ? (
            <div className="hint error" role="alert">
              {error}
            </div>
          ) : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            <label className="input-label">
              Заголовок*
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Должность или роль"
                required
              />
            </label>

            <label className="input-label">
              Тип роли*
              <input
                className="input"
                value={form.role_type}
                onChange={(e) => setForm((prev) => ({ ...prev, role_type: e.target.value }))}
                placeholder="vacancy / resume"
                required
              />
            </label>

            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Город
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Москва"
                />
              </label>

              <label className="input-label" style={{ flex: 1 }}>
                Формат работы
                <input
                  className="input"
                  value={form.employment_format}
                  onChange={(e) => setForm((prev) => ({ ...prev, employment_format: e.target.value }))}
                  placeholder="офис / удалёнка / гибрид"
                />
              </label>
            </div>

            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Зарплата от
                <input
                  className="input"
                  value={form.salary_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, salary_from: e.target.value }))}
                  placeholder="70000"
                  inputMode="numeric"
                />
              </label>

              <label className="input-label" style={{ flex: 1 }}>
                Зарплата до
                <input
                  className="input"
                  value={form.salary_to}
                  onChange={(e) => setForm((prev) => ({ ...prev, salary_to: e.target.value }))}
                  placeholder="120000"
                  inputMode="numeric"
                />
              </label>

              <label className="input-label" style={{ width: '160px' }}>
                Валюта
                <input
                  className="input"
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="RUB"
                />
              </label>
            </div>

            <label className="input-label">
              Уровень опыта
              <input
                className="input"
                value={form.experience_level}
                onChange={(e) => setForm((prev) => ({ ...prev, experience_level: e.target.value }))}
                placeholder="junior / middle / senior"
              />
            </label>

            <label className="input-label" style={{ width: '180px' }}>
              Статус
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as (typeof STATUS_OPTIONS)[number] }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label className="input-label">
              Описание
              <textarea
                className="input textarea"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Обязанности, требования, формат отклика"
              />
            </label>

            <div className="form-actions">
              <button type="button" className="ghost-btn" onClick={() => setForm({ ...emptyForm })}>
                Очистить
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
          </div>
        ) : null}

        {activeTab === 'feed' ? (
          <div className="card">
          <div className="card-header">
            <h2>Лента объявлений</h2>
            <p className="subtitle">Активные вакансии и резюме</p>
          </div>

          <div className="links-grid">
            <input
              className="input"
              placeholder="Город"
              value={feedFilter.city}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, city: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Тип роли"
              value={feedFilter.role_type}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, role_type: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Формат работы"
              value={feedFilter.employment_format}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, employment_format: e.target.value }))}
            />
          </div>

          {loadingFeed ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingFeed && !feed.length ? <p className="subtitle">Объявления не найдены.</p> : null}

          <div className="grid">
            {feed.map((item) => (
              <ListingCard key={item.id} listing={item}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ListingContactActions section="jobs" listingId={item.id} />
                  <ListingReportButton section="jobs" listingId={item.id} onReported={handleReportSent} />
                </div>
              </ListingCard>
            ))}
          </div>
          </div>
        ) : null}

        {activeTab === 'mine' ? (
          <div className="card">
          <div className="card-header">
            <h2>Мои объявления</h2>
            <p className="subtitle">Ваши вакансии и резюме</p>
          </div>

          {loadingMine ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingMine && !mine.length ? <p className="subtitle">У вас пока нет объявлений.</p> : null}

          <div className="grid">
            {mine.map((item) => (
              <ListingCard key={item.id} listing={item} onEdit={handleEdit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ListingContactActions section="jobs" listingId={item.id} isOwner />
                  <ListingReportButton section="jobs" listingId={item.id} onReported={handleReportSent} />
                </div>
              </ListingCard>
            ))}
          </div>
          </div>
        ) : null}
      </div>
    </SectionLayout>
  );
}
