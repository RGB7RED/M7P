'use client';

import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListingContactActions } from '../_components/ListingContactActions';
import { ListingReportButton } from '../_components/ListingReportButton';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';

const STATUS_OPTIONS = ['active', 'draft', 'archived'] as const;

type MarketListing = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  type: string;
  price: number | null;
  currency: string | null;
  city: string | null;
  is_online: boolean;
  show_on_map: boolean;
  map_lat: number | null;
  map_lng: number | null;
  status: string;
  created_at: string;
};

type SavePayload = {
  id?: string;
  title: string;
  description: string;
  category: string;
  type: string;
  price: string;
  currency: string;
  city: string;
  is_online: boolean;
  show_on_map: boolean;
  map_lat: string;
  map_lng: string;
  status: (typeof STATUS_OPTIONS)[number];
};

type FilterState = {
  city: string;
  category: string;
  type: string;
};

const emptyForm: SavePayload = {
  title: '',
  description: '',
  category: '',
  type: '',
  price: '',
  currency: 'RUB',
  city: '',
  is_online: false,
  show_on_map: false,
  map_lat: '',
  map_lng: '',
  status: 'active',
};

function ListingCard({
  listing,
  onEdit,
  children,
}: {
  listing: MarketListing;
  onEdit?: (item: MarketListing) => void;
  children?: ReactNode;
}) {
  return (
    <div className="profile-card profile-card-compact">
      <div className="card-header">
        <div>
          <div className="profile-title">{listing.title}</div>
          <div className="profile-subtitle">Категория: {listing.category} · Тип: {listing.type}</div>
        </div>
        <span className={`pill ${listing.status !== 'active' ? 'pill-muted' : ''}`}>{listing.status}</span>
      </div>

      <div className="links-grid">
        {listing.city ? <span className="pill">{listing.city}</span> : null}
        {listing.is_online ? <span className="pill">Онлайн</span> : <span className="pill pill-muted">Оффлайн</span>}
        {listing.price !== null ? (
          <span className="pill">
            {listing.price} {listing.currency ?? 'RUB'}
          </span>
        ) : (
          <span className="pill pill-muted">Цена не указана</span>
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

export default function MarketPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('mine') ? 'mine' : 'feed';
  const [activeTab, setActiveTab] = useState<'feed' | 'mine' | 'form'>(defaultTab);
  const [form, setForm] = useState<SavePayload>(emptyForm);
  const [feedFilter, setFeedFilter] = useState<FilterState>({ city: '', category: '', type: '' });
  const [feed, setFeed] = useState<MarketListing[]>([]);
  const [mine, setMine] = useState<MarketListing[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reportToast, setReportToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoadingFeed(true);
    const params = new URLSearchParams({ status: 'all' });
    if (feedFilter.city.trim()) params.set('city', feedFilter.city.trim());
    if (feedFilter.category.trim()) params.set('category', feedFilter.category.trim());
    if (feedFilter.type.trim()) params.set('type', feedFilter.type.trim());

    try {
      const response = await fetch(`/api/market/listings?${params.toString()}`);
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
      const response = await fetch('/api/market/listings?mine=true&status=all');
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
  }, [activeTab, feedFilter.city, feedFilter.category, feedFilter.type]);

  useEffect(() => {
    if (activeTab === 'mine') {
      loadMine();
    }
  }, [activeTab]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setToast(null);

    if (!form.title.trim() || !form.category.trim() || !form.type.trim()) {
      setError('Заполните заголовок, категорию и тип.');
      return;
    }

    let map_lat: number | null = null;
    let map_lng: number | null = null;

    if (form.show_on_map) {
      if (!form.map_lat.trim() || !form.map_lng.trim()) {
        setError('Введите координаты, чтобы показать объявление на карте.');
        return;
      }

      const latNumber = Number(form.map_lat);
      const lngNumber = Number(form.map_lng);

      if (!Number.isFinite(latNumber) || latNumber < -90 || latNumber > 90) {
        setError('Укажите корректную широту от -90 до 90.');
        return;
      }

      if (!Number.isFinite(lngNumber) || lngNumber < -180 || lngNumber > 180) {
        setError('Укажите корректную долготу от -180 до 180.');
        return;
      }

      map_lat = latNumber;
      map_lng = lngNumber;
    }

    setIsSubmitting(true);
    const payload: any = {
      id: form.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim(),
      type: form.type.trim(),
      city: form.city.trim(),
      currency: form.currency.trim() || 'RUB',
      is_online: form.is_online,
      show_on_map: form.show_on_map,
      map_lat,
      map_lng,
      status: form.status,
    };

    if (form.price.trim()) {
      const priceNumber = Number(form.price);
      if (Number.isFinite(priceNumber)) {
        payload.price = priceNumber;
      }
    }

    try {
      const response = await fetch('/api/market/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError('Не удалось сохранить объявление. Проверьте поля и попробуйте снова.');
        return;
      }

      setToast('Объявление сохранено');
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

  const handleEdit = (item: MarketListing) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      category: item.category,
      type: item.type,
      price: item.price !== null ? String(item.price) : '',
      currency: item.currency ?? 'RUB',
      city: item.city ?? '',
      is_online: item.is_online,
      show_on_map: item.show_on_map,
      map_lat: item.map_lat !== null ? String(item.map_lat) : '',
      map_lng: item.map_lng !== null ? String(item.map_lng) : '',
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
        title="Маркет"
        subtitle="Товары и услуги с фильтрами по городу, категории и типу. В любой момент можно отредактировать своё объявление."
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
            <p className="subtitle">Лента активных объявлений, ваши записи и форма создания</p>
          </div>
          <div className="links-grid">
            <button
              className={`ghost-btn ${activeTab === 'feed' ? 'ghost-btn-active' : ''}`}
              onClick={() => setActiveTab('feed')}
            >
              Лента
            </button>
            <button
              className={`ghost-btn ${activeTab === 'mine' ? 'ghost-btn-active' : ''}`}
              onClick={() => setActiveTab('mine')}
            >
              Мои объявления
            </button>
            <button
              className={`ghost-btn ${activeTab === 'form' ? 'ghost-btn-active' : ''}`}
              onClick={() => setActiveTab('form')}
            >
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
                placeholder="Что предлагаете?"
                required
              />
            </label>

            <label className="input-label">
              Категория*
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Например, техника, услуги, одежда"
                required
              />
            </label>

            <label className="input-label">
              Тип*
              <input
                className="input"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                placeholder="product / service"
                required
              />
            </label>

            <label className="input-label">
              Город
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                placeholder="Санкт-Петербург"
              />
            </label>

            <label className="input-label">
              Цена
              <div className="links-grid">
                <input
                  className="input"
                  value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="1000"
                  inputMode="numeric"
                />
                <input
                  className="input"
                  value={form.currency}
                  onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                  placeholder="RUB"
                />
              </div>
            </label>

            <label className="input-label">
              Описание
              <textarea
                className="input textarea"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Ключевые детали: состояние, что включено"
              />
            </label>

            <div className="links-grid">
              <label className="checkbox-item">
                <input
                  type="checkbox"
                  checked={form.is_online}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_online: e.target.checked }))}
                />
                Доступно онлайн
              </label>

              <label className="input-label" style={{ width: '180px' }}>
                Статус
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as (typeof STATUS_OPTIONS)[number] }))
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

            <div className="card-subtitle" style={{ marginTop: 8 }}>
              Настройки карты (временно для внутренней настройки)
            </div>
            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={form.show_on_map}
                onChange={(e) => setForm((prev) => ({ ...prev, show_on_map: e.target.checked }))}
              />
              Показывать на карте
            </label>
            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Широта (lat)
                <input
                  className="input"
                  value={form.map_lat}
                  onChange={(e) => setForm((prev) => ({ ...prev, map_lat: e.target.value }))}
                  placeholder="59.93"
                  inputMode="decimal"
                  disabled={!form.show_on_map}
                />
              </label>

              <label className="input-label" style={{ flex: 1 }}>
                Долгота (lng)
                <input
                  className="input"
                  value={form.map_lng}
                  onChange={(e) => setForm((prev) => ({ ...prev, map_lng: e.target.value }))}
                  placeholder="30.31"
                  inputMode="decimal"
                  disabled={!form.show_on_map}
                />
              </label>
            </div>
            <p className="subtitle">Временно для внутренней настройки. Введите координаты, чтобы объявление появилось на карте.</p>

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
            <p className="subtitle">Все активные объявления по выбранным фильтрам</p>
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
              placeholder="Категория"
              value={feedFilter.category}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, category: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Тип (product/service)"
              value={feedFilter.type}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, type: e.target.value }))}
            />
          </div>

          {loadingFeed ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingFeed && !feed.length ? <p className="subtitle">Объявления не найдены.</p> : null}

          <div className="grid">
            {feed.map((item) => (
              <ListingCard key={item.id} listing={item}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ListingContactActions section="market" listingId={item.id} />
                  <ListingReportButton section="market" listingId={item.id} onReported={handleReportSent} />
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
            <p className="subtitle">Созданные вами записи, доступные для редактирования</p>
          </div>

          {loadingMine ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingMine && !mine.length ? <p className="subtitle">У вас пока нет объявлений.</p> : null}

          <div className="grid">
            {mine.map((item) => (
              <ListingCard key={item.id} listing={item} onEdit={handleEdit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <ListingContactActions section="market" listingId={item.id} isOwner />
                  <ListingReportButton section="market" listingId={item.id} onReported={handleReportSent} />
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
