'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';

import { DATING_PURPOSE_ENTRIES, DatingPurpose, isDatingPurpose } from '../../lib/datingPurposes';
import { USER_GENDERS } from '../../lib/profileValidation';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';

const TABS = [
  { key: 'basic', label: 'Основное' },
  { key: 'dating', label: 'Анкета' },
  { key: 'listings', label: 'Мои объявления' },
] as const;

type ProfileResponse = {
  ok: boolean;
  user?: {
    id: string;
    telegramUsername: string;
    displayName: string | null;
    gender: string;
    birthDate: string | null;
    city: string | null;
  };
  stats?: {
    hasDatingProfile: boolean;
    datingIsActive: boolean;
    listings: {
      marketActive: number;
      housingActive: number;
      jobsActive: number;
    };
  };
  error?: string;
};

type DatingProfileResponse = {
  ok: boolean;
  profile: any | null;
  user: {
    gender: string;
    birthDate: string | null;
    city: string | null;
  } | null;
  listings?: any;
  error?: string;
};

function TabSwitcher({ currentTab }: { currentTab: string }) {
  const router = useRouter();
  const search = useSearchParams();

  const onTabClick = (key: string) => {
    const params = new URLSearchParams(search.toString());
    params.set('tab', key);
    router.replace(`/profile?${params.toString()}`);
  };

  return (
    <div className="tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${currentTab === tab.key ? 'tab-active' : ''}`}
          onClick={() => onTabClick(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function BasicTab({ profile, onUpdated }: { profile: ProfileResponse; onUpdated: (next: ProfileResponse) => void }) {
  const [form, setForm] = useState({
    gender: profile.user?.gender ?? 'na',
    birthDate: profile.user?.birthDate ?? '',
    city: profile.user?.city ?? '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setForm({
      gender: profile.user?.gender ?? 'na',
      birthDate: profile.user?.birthDate ?? '',
      city: profile.user?.city ?? '',
    });
  }, [profile.user?.birthDate, profile.user?.city, profile.user?.gender]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender: form.gender,
          birthDate: form.birthDate || null,
          city: form.city,
        }),
      });

      const data = (await response.json()) as ProfileResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Не удалось сохранить профиль');
        return;
      }
      onUpdated(data);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">Базовый профиль</h2>
      <p className="card-subtitle">Заполните основные данные — они используются в знакомствах и объявлениях.</p>

      <label className="field">
        <span className="label">Пол</span>
        <select
          value={form.gender}
          onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
          className="input"
        >
          {USER_GENDERS.map((gender) => (
            <option key={gender} value={gender}>
              {gender === 'male'
                ? 'Мужской'
                : gender === 'female'
                  ? 'Женский'
                  : gender === 'other'
                    ? 'Другой'
                    : 'Не указано'}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="label">Дата рождения</span>
        <input
          type="date"
          className="input"
          value={form.birthDate ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
        />
      </label>

      <label className="field">
        <span className="label">Город</span>
        <input
          type="text"
          className="input"
          value={form.city ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          placeholder="Например, Санкт-Петербург"
        />
      </label>

      <div className="card-actions">
        <button type="submit" className="button" disabled={isSaving}>
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </button>
        {success ? <span className="text-success">Сохранено</span> : null}
        {error ? <span className="text-error">{error}</span> : null}
      </div>
    </form>
  );
}

type DatingFormState = {
  nickname: string;
  looking_for: string;
  offer: string;
  comment: string;
  purposes: DatingPurpose[];
  link_market: boolean;
  link_housing: boolean;
  link_jobs: boolean;
  show_listings: boolean;
  is_active: boolean;
  preferred_genders: string[];
  preferred_age_min: number;
  preferred_age_max: number;
  preferred_city_mode: string;
  show_market_listings_in_profile: boolean;
  show_housing_listings_in_profile: boolean;
  show_job_listings_in_profile: boolean;
};

function DatingTab() {
  const [profile, setProfile] = useState<DatingProfileResponse | null>(null);
  const [form, setForm] = useState<DatingFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dating/profile');
      const data = (await response.json()) as DatingProfileResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Не удалось загрузить анкету');
        setLoading(false);
        return;
      }
      setProfile(data);
      setForm({
        nickname: data.profile?.nickname ?? '',
        looking_for: data.profile?.looking_for ?? '',
        offer: data.profile?.offer ?? '',
        comment: data.profile?.comment ?? '',
        purposes: (data.profile?.purposes ?? []).filter(isDatingPurpose),
        link_market: data.profile?.link_market ?? false,
        link_housing: data.profile?.link_housing ?? false,
        link_jobs: data.profile?.link_jobs ?? false,
        show_listings: data.profile?.show_listings ?? true,
        is_active: data.profile?.is_active ?? true,
        preferred_genders: data.profile?.preferred_genders ?? [],
        preferred_age_min: data.profile?.preferred_age_min ?? 18,
        preferred_age_max: data.profile?.preferred_age_max ?? 99,
        preferred_city_mode: data.profile?.preferred_city_mode ?? 'same_city',
        show_market_listings_in_profile: data.profile?.show_market_listings_in_profile ?? true,
        show_housing_listings_in_profile: data.profile?.show_housing_listings_in_profile ?? true,
        show_job_listings_in_profile: data.profile?.show_job_listings_in_profile ?? true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить анкету');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const togglePurpose = (purpose: DatingPurpose) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exists = prev.purposes.includes(purpose);
      const nextPurposes = exists ? prev.purposes.filter((p) => p !== purpose) : [...prev.purposes, purpose];
      return { ...prev, purposes: nextPurposes };
    });
  };

  const togglePreferredGender = (gender: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exists = prev.preferred_genders.includes(gender);
      const next = exists
        ? prev.preferred_genders.filter((g) => g !== gender)
        : [...prev.preferred_genders, gender];
      return { ...prev, preferred_genders: next };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch('/api/dating/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as DatingProfileResponse;
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Не удалось сохранить анкету');
        return;
      }
      setSuccess(true);
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить анкету');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <section className="card">
        <h2 className="card-title">Загрузка анкеты...</h2>
      </section>
    );
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="card-title">Анкета знакомств</h2>
      <p className="card-subtitle">Заполните цели, тексты анкеты и предпочтения.</p>

      <label className="field">
        <span className="label">Никнейм анкеты</span>
        <input
          className="input"
          value={form.nickname}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, nickname: e.target.value } : prev))}
        />
      </label>

      <label className="field">
        <span className="label">Кого ищу</span>
        <textarea
          className="textarea"
          rows={3}
          value={form.looking_for}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, looking_for: e.target.value } : prev))}
        />
      </label>

      <label className="field">
        <span className="label">Что предлагаю</span>
        <textarea
          className="textarea"
          rows={3}
          value={form.offer}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, offer: e.target.value } : prev))}
        />
      </label>

      <label className="field">
        <span className="label">Комментарий / О себе</span>
        <textarea
          className="textarea"
          rows={2}
          value={form.comment}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
        />
      </label>

      <div className="field">
        <span className="label">Цели знакомств</span>
        <div className="badges selectable">
          {DATING_PURPOSE_ENTRIES.map(([purpose, meta]) => (
            <label key={purpose} className={`pill selectable-pill ${form.purposes.includes(purpose) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={form.purposes.includes(purpose)}
                onChange={() => togglePurpose(purpose)}
              />
              {meta.label}
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="label">Кого я ищу (пол)</span>
        <div className="badges selectable">
          {USER_GENDERS.filter((g) => g !== 'na').map((gender) => (
            <label key={gender} className={`pill selectable-pill ${form.preferred_genders.includes(gender) ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={form.preferred_genders.includes(gender)}
                onChange={() => togglePreferredGender(gender)}
              />
              {gender === 'male' ? 'Мужчин' : gender === 'female' ? 'Женщин' : 'Других'}
            </label>
          ))}
        </div>
      </div>

      <div className="field two-columns">
        <label className="field">
          <span className="label">Возраст от</span>
          <input
            className="input"
            type="number"
            min={14}
            value={form.preferred_age_min}
            onChange={(e) =>
              setForm((prev) => (prev ? { ...prev, preferred_age_min: Number(e.target.value) } : prev))
            }
          />
        </label>
        <label className="field">
          <span className="label">Возраст до</span>
          <input
            className="input"
            type="number"
            min={form.preferred_age_min}
            value={form.preferred_age_max}
            onChange={(e) =>
              setForm((prev) => (prev ? { ...prev, preferred_age_max: Number(e.target.value) } : prev))
            }
          />
        </label>
      </div>

      <label className="field">
        <span className="label">Гео</span>
        <select
          className="input"
          value={form.preferred_city_mode}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, preferred_city_mode: e.target.value } : prev))}
        >
          <option value="same_city">Только мой город</option>
          <option value="country">Вся страна</option>
          <option value="any">Любая локация</option>
        </select>
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.show_listings}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, show_listings: e.target.checked } : prev))}
        />
        <span>Показывать мои объявления в анкете</span>
      </label>

      {form.show_listings ? (
        <div className="field">
          <span className="label">Какие объявления показывать</span>
          <div className="checkbox-group">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.show_market_listings_in_profile}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, show_market_listings_in_profile: e.target.checked } : prev))
                }
              />
              <span>Маркет</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.show_housing_listings_in_profile}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, show_housing_listings_in_profile: e.target.checked } : prev))
                }
              />
              <span>Жильё</span>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={form.show_job_listings_in_profile}
                onChange={(e) =>
                  setForm((prev) => (prev ? { ...prev, show_job_listings_in_profile: e.target.checked } : prev))
                }
              />
              <span>Работа</span>
            </label>
          </div>
        </div>
      ) : null}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
        />
        <span>Показывать анкету в ленте</span>
      </label>

      <div className="card-actions">
        <button type="submit" className="button" disabled={saving}>
          {saving ? 'Сохранение...' : 'Сохранить анкету'}
        </button>
        {success ? <span className="text-success">Сохранено</span> : null}
        {error ? <span className="text-error">{error}</span> : null}
      </div>
    </form>
  );
}

function ListingsTab({ stats }: { stats: ProfileResponse['stats'] }) {
  return (
    <section className="card">
      <h2 className="card-title">Мои объявления</h2>
      <p className="card-subtitle">Количество активных объявлений по разделам.</p>

      <ul className="list">
        <li>
          Маркет: <strong>{stats?.listings.marketActive ?? 0}</strong>
        </li>
        <li>
          Жильё: <strong>{stats?.listings.housingActive ?? 0}</strong>
        </li>
        <li>
          Работа: <strong>{stats?.listings.jobsActive ?? 0}</strong>
        </li>
      </ul>

      <div className="links-grid">
        <Link className="button secondary" href="/market">
          В Маркет
        </Link>
        <Link className="button secondary" href="/housing">
          В Жильё
        </Link>
        <Link className="button secondary" href="/jobs">
          В Работу
        </Link>
      </div>

      <p className="card-subtitle">Настройки показа объявлений в анкете — во вкладке «Знакомства».</p>
    </section>
  );
}

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const currentTab = useMemo(
    () => (tabParam && TABS.some((tab) => tab.key === tabParam) ? tabParam : 'basic'),
    [tabParam],
  );

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/profile');
        const data = (await response.json()) as ProfileResponse;
        if (!response.ok || !data.ok) {
          setError(data.error ?? 'Не удалось загрузить профиль');
          return;
        }
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <SectionLayout>
      <SectionHeaderCard
        title="Профиль"
        subtitle="Заполните информацию о себе, настройте анкету знакомств и управление объявлениями."
      />

      <TabSwitcher currentTab={currentTab} />

      {loading ? (
        <section className="card">
          <h2 className="card-title">Загрузка...</h2>
        </section>
      ) : error || !profile ? (
        <section className="card">
          <h2 className="card-title">Ошибка загрузки</h2>
          <p className="card-subtitle">{error}</p>
        </section>
      ) : null}

      {!loading && profile ? (
        <>
          {currentTab === 'basic' ? <BasicTab profile={profile} onUpdated={setProfile} /> : null}
          {currentTab === 'dating' ? <DatingTab /> : null}
          {currentTab === 'listings' ? <ListingsTab stats={profile.stats} /> : null}
        </>
      ) : null}
    </SectionLayout>
  );
}
