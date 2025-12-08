'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const STATUS_OPTIONS = ['active', 'draft', 'archived'] as const;

type HousingListing = {
  id: string;
  title: string;
  description: string | null;
  offer_type: string;
  property_type: string;
  city: string;
  district: string | null;
  price_per_month: number;
  currency: string | null;
  available_from: string | null;
  min_term_months: number | null;
  is_roommate_allowed: boolean;
  status: string;
  created_at: string;
};

type SavePayload = {
  id?: string;
  title: string;
  description: string;
  offer_type: string;
  property_type: string;
  city: string;
  district: string;
  price_per_month: string;
  currency: string;
  available_from: string;
  min_term_months: string;
  is_roommate_allowed: boolean;
  status: (typeof STATUS_OPTIONS)[number];
};

type FilterState = {
  city: string;
  maxPrice: string;
  offer_type: string;
  property_type: string;
};

const emptyForm: SavePayload = {
  title: '',
  description: '',
  offer_type: '',
  property_type: '',
  city: '',
  district: '',
  price_per_month: '',
  currency: 'RUB',
  available_from: '',
  min_term_months: '',
  is_roommate_allowed: true,
  status: 'active',
};

function ListingCard({
  listing,
  onEdit,
  anchorId,
  highlighted,
}: {
  listing: HousingListing;
  onEdit?: (item: HousingListing) => void;
  anchorId?: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="profile-card profile-card-compact"
      id={anchorId}
      style={highlighted ? { outline: '2px solid #7c3aed' } : undefined}
    >
      <div className="card-header">
        <div>
          <div className="profile-title">{listing.title}</div>
          <div className="profile-subtitle">{listing.offer_type} · {listing.property_type}</div>
        </div>
        <span className={`pill ${listing.status !== 'active' ? 'pill-muted' : ''}`}>{listing.status}</span>
      </div>

      <div className="links-grid">
        <span className="pill">{listing.city}</span>
        {listing.district ? <span className="pill pill-muted">{listing.district}</span> : null}
        <span className="pill">
          {listing.price_per_month} {listing.currency ?? 'RUB'} / мес
        </span>
        {listing.available_from ? <span className="pill">Доступно с {listing.available_from}</span> : null}
        {listing.min_term_months ? <span className="pill">Мин. срок {listing.min_term_months} мес</span> : null}
        <span className={`pill ${listing.is_roommate_allowed ? '' : 'pill-muted'}`}>
          {listing.is_roommate_allowed ? 'Можно соседей' : 'Без соседей'}
        </span>
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
    </div>
  );
}

export default function HousingPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('mine') || searchParams.get('listing') ? 'mine' : 'feed';
  const highlightedListingId = searchParams.get('listing');
  const [activeTab, setActiveTab] = useState<'feed' | 'mine' | 'form'>(defaultTab);
  const [form, setForm] = useState<SavePayload>(emptyForm);
  const [feedFilter, setFeedFilter] = useState<FilterState>({ city: '', maxPrice: '', offer_type: '', property_type: '' });
  const [feed, setFeed] = useState<HousingListing[]>([]);
  const [mine, setMine] = useState<HousingListing[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMine, setLoadingMine] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = async () => {
    setLoadingFeed(true);
    const params = new URLSearchParams({ status: 'active' });
    if (feedFilter.city.trim()) params.set('city', feedFilter.city.trim());
    if (feedFilter.maxPrice.trim()) params.set('maxPrice', feedFilter.maxPrice.trim());
    if (feedFilter.offer_type.trim()) params.set('offer_type', feedFilter.offer_type.trim());
    if (feedFilter.property_type.trim()) params.set('property_type', feedFilter.property_type.trim());

    try {
      const response = await fetch(`/api/housing/listings?${params.toString()}`);
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
      const response = await fetch('/api/housing/listings?mine=true');
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
  }, [activeTab, feedFilter.city, feedFilter.maxPrice, feedFilter.offer_type, feedFilter.property_type]);

  useEffect(() => {
    if (activeTab === 'mine') {
      loadMine();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'mine' && highlightedListingId) {
      const element = document.getElementById(`housing-listing-${highlightedListingId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTab, highlightedListingId, mine.length]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setToast(null);

    if (!form.title.trim() || !form.offer_type.trim() || !form.property_type.trim() || !form.city.trim()) {
      setError('Заполните заголовок, тип предложения, тип жилья и город.');
      return;
    }

    const priceNumber = Number(form.price_per_month);
    if (!Number.isFinite(priceNumber)) {
      setError('Укажите корректную цену в месяц.');
      return;
    }

    setIsSubmitting(true);

    const payload: any = {
      id: form.id,
      title: form.title.trim(),
      description: form.description.trim(),
      offer_type: form.offer_type.trim(),
      property_type: form.property_type.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
      price_per_month: priceNumber,
      currency: form.currency.trim() || 'RUB',
      available_from: form.available_from.trim(),
      min_term_months: null,
      is_roommate_allowed: form.is_roommate_allowed,
      status: form.status,
    };

    if (payload.available_from === '') payload.available_from = null;
    const minTermRaw = form.min_term_months.trim();
    if (minTermRaw) {
      const minTermNumber = Number(minTermRaw);
      if (Number.isFinite(minTermNumber)) {
        payload.min_term_months = minTermNumber;
      }
    }

    try {
      const response = await fetch('/api/housing/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data?.ok) {
        setError('Не удалось сохранить объявление. Проверьте поля и попробуйте снова.');
        return;
      }

      setToast('Объявление по жилью сохранено');
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

  const handleEdit = (item: HousingListing) => {
    setForm({
      id: item.id,
      title: item.title,
      description: item.description ?? '',
      offer_type: item.offer_type,
      property_type: item.property_type,
      city: item.city,
      district: item.district ?? '',
      price_per_month: String(item.price_per_month),
      currency: item.currency ?? 'RUB',
      available_from: item.available_from ?? '',
      min_term_months: item.min_term_months !== null ? String(item.min_term_months) : '',
      is_roommate_allowed: item.is_roommate_allowed,
      status: (STATUS_OPTIONS.includes(item.status as any) ? item.status : 'active') as (typeof STATUS_OPTIONS)[number],
    });
    setActiveTab('form');
    setToast(null);
    setError(null);
  };

  return (
    <div className="grid">
      <div className="card">
        <h1 className="hero-title">Жильё</h1>
        <p className="hero-text">Аренда и поиск жилья. Добавляйте объявления и отслеживайте их в отдельной вкладке.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Навигация</h2>
            <p className="subtitle">Лента, ваши объявления и форма</p>
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
                placeholder="Комната, квартира, студия"
                required
              />
            </label>

            <label className="input-label">
              Тип предложения*
              <input
                className="input"
                value={form.offer_type}
                onChange={(e) => setForm((prev) => ({ ...prev, offer_type: e.target.value }))}
                placeholder="rent_out / rent_in"
                required
              />
            </label>

            <label className="input-label">
              Тип жилья*
              <input
                className="input"
                value={form.property_type}
                onChange={(e) => setForm((prev) => ({ ...prev, property_type: e.target.value }))}
                placeholder="room / flat / house"
                required
              />
            </label>

            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Город*
                <input
                  className="input"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Санкт-Петербург"
                  required
                />
              </label>

              <label className="input-label" style={{ flex: 1 }}>
                Район
                <input
                  className="input"
                  value={form.district}
                  onChange={(e) => setForm((prev) => ({ ...prev, district: e.target.value }))}
                  placeholder="Приморский"
                />
              </label>
            </div>

            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Цена в месяц*
                <input
                  className="input"
                  value={form.price_per_month}
                  onChange={(e) => setForm((prev) => ({ ...prev, price_per_month: e.target.value }))}
                  placeholder="40000"
                  inputMode="numeric"
                  required
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

            <div className="links-grid">
              <label className="input-label" style={{ flex: 1 }}>
                Доступно с
                <input
                  className="input"
                  type="date"
                  value={form.available_from}
                  onChange={(e) => setForm((prev) => ({ ...prev, available_from: e.target.value }))}
                />
              </label>

              <label className="input-label" style={{ flex: 1 }}>
                Мин. срок (мес)
                <input
                  className="input"
                  value={form.min_term_months}
                  onChange={(e) => setForm((prev) => ({ ...prev, min_term_months: e.target.value }))}
                  placeholder="6"
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="checkbox-item">
              <input
                type="checkbox"
                checked={form.is_roommate_allowed}
                onChange={(e) => setForm((prev) => ({ ...prev, is_roommate_allowed: e.target.checked }))}
              />
              Готов принять соседа
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
                placeholder="Что включено, пожелания к жильцам"
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
            <p className="subtitle">Все активные объявления по жилью</p>
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
              placeholder="Макс. цена"
              value={feedFilter.maxPrice}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, maxPrice: e.target.value }))}
              inputMode="numeric"
            />
            <input
              className="input"
              placeholder="Тип предложения"
              value={feedFilter.offer_type}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, offer_type: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Тип жилья"
              value={feedFilter.property_type}
              onChange={(e) => setFeedFilter((prev) => ({ ...prev, property_type: e.target.value }))}
            />
          </div>

          {loadingFeed ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingFeed && !feed.length ? <p className="subtitle">Объявления не найдены.</p> : null}

          <div className="grid">
            {feed.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'mine' ? (
        <div className="card">
          <div className="card-header">
            <h2>Мои объявления</h2>
            <p className="subtitle">Управляйте своими объявлениями по жилью</p>
          </div>

          {loadingMine ? <p className="subtitle">Загрузка...</p> : null}
          {!loadingMine && !mine.length ? <p className="subtitle">У вас пока нет объявлений.</p> : null}

          <div className="grid">
            {mine.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                onEdit={handleEdit}
                anchorId={`housing-listing-${item.id}`}
                highlighted={item.id === highlightedListingId}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
