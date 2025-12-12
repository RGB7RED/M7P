'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import {
  DATING_PURPOSE_ENTRIES,
  DATING_PURPOSES,
  DatingPurpose,
} from '../../lib/datingPurposes';
import { ListingPreview, ListingPreviewGroups } from './types';
import { ListingPreviewCard } from './components/ListingPreviewCard';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';

type DatingReportReason = 'escort' | 'scam' | 'drugs' | 'weapons' | 'inappropriate' | 'other';

const REPORT_REASONS: { value: DatingReportReason; label: string }[] = [
  { value: 'escort', label: 'Эскорт / проституция' },
  { value: 'scam', label: 'Скам / мошенничество' },
  { value: 'drugs', label: 'Наркотики' },
  { value: 'weapons', label: 'Оружие / насилие' },
  { value: 'inappropriate', label: 'Неподобающий контент' },
  { value: 'other', label: 'Другое' },
];

type DatingProfile = {
  id: string;
  user_id: string;
  nickname: string;
  looking_for: string;
  offer: string;
  comment?: string | null;
  purposes: DatingPurpose[];
  photo_urls: string[];
  has_photo: boolean;
  link_market: boolean;
  link_housing: boolean;
  link_jobs: boolean;
  show_listings: boolean;
  is_active: boolean;
  last_activated_at: string | null;
  is_stale?: boolean;
  is_verified: boolean;
  status: string;
  created_at: string;
  isBanned?: boolean;
};

type MatchItem = {
  matchId: string;
  userId: string;
  telegramUsername: string;
  profile: Pick<DatingProfile, 'nickname' | 'purposes' | 'has_photo' | 'isBanned'> | null;
  nicknameFallback: string;
  isBanned?: boolean;
};

type DatingProfileWithListings = DatingProfile & { listings?: ListingPreviewGroups };

type SavePayload = {
  nickname: string;
  looking_for: string;
  offer: string;
  comment?: string | null;
  purposes: DatingPurpose[];
  link_market: boolean;
  link_housing: boolean;
  link_jobs: boolean;
  photo_urls: string[];
  show_listings: boolean;
  is_active: boolean;
};

const EMPTY_LISTINGS: ListingPreviewGroups = { market: [], housing: [], jobs: [] };

function PurposeBadges({ purposes }: { purposes: DatingPurpose[] }) {
  return (
    <div className="badges">
      {purposes.map((purpose) => (
        <span key={purpose} className="badge">
          {DATING_PURPOSES[purpose].label}
        </span>
      ))}
    </div>
  );
}

function ProfileCard({
  profile,
  children,
  isMine,
  compact,
}: {
  profile: DatingProfile;
  children?: ReactNode;
  isMine?: boolean;
  compact?: boolean;
}) {
  if (profile.isBanned) {
    return (
      <div className={`profile-card ${compact ? 'profile-card-compact' : ''}`}>
        <div className="profile-card-header">
          <div>
            <div className="profile-title">Профиль временно недоступен</div>
            <div className="profile-subtitle">По этому профилю идёт проверка модерацией.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`profile-card ${compact ? 'profile-card-compact' : ''}`}>
      <div className="profile-card-header">
        <div>
          <div className="profile-title">
            {profile.nickname}
            {profile.is_verified ? <span className="verified">Проверено</span> : null}
          </div>
          <div className="profile-subtitle">{isMine ? 'Моя анкета' : 'Анкета участника'}</div>
        </div>
        {profile.has_photo ? <span className="pill">Есть фото</span> : <span className="pill pill-muted">Без фото</span>}
      </div>

      <PurposeBadges purposes={profile.purposes} />

      <div className="links-grid">
        <span className={`pill ${profile.is_active ? '' : 'pill-muted'}`}>
          {profile.is_active ? 'Показываюсь в поиске' : 'Скрыто из поиска'}
        </span>
        <span className={`pill ${profile.show_listings ? '' : 'pill-muted'}`}>
          {profile.show_listings ? 'Объявления видны в анкете' : 'Объявления скрыты'}
        </span>
      </div>

      <div className="profile-section">
        <div className="label">Ищу</div>
        <p>{profile.looking_for}</p>
      </div>

      <div className="profile-section">
        <div className="label">Предлагаю</div>
        <p>{profile.offer}</p>
      </div>

      {profile.comment ? (
        <div className="profile-section">
          <div className="label">Комментарий / О себе</div>
          <p>{profile.comment}</p>
        </div>
      ) : null}

      {(profile.link_market || profile.link_housing || profile.link_jobs) && (
        <div className="links-grid">
          {profile.link_market && <span className="pill">Связка с Маркетом</span>}
          {profile.link_housing && <span className="pill">Связка с Жильём</span>}
          {profile.link_jobs && <span className="pill">Связка с Работой</span>}
        </div>
      )}

      {children ? <div className="card-actions">{children}</div> : null}
    </div>
  );
}

function ProfileForm({
  initialProfile,
  onSaved,
  onCancel,
}: {
  initialProfile: DatingProfile | null;
  onSaved: (profile: DatingProfile) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState<SavePayload>(() => ({
    nickname: initialProfile?.nickname ?? '',
    looking_for: initialProfile?.looking_for ?? '',
    offer: initialProfile?.offer ?? '',
    comment: initialProfile?.comment ?? '',
    purposes: initialProfile?.purposes ?? [],
    link_market: initialProfile?.link_market ?? false,
    link_housing: initialProfile?.link_housing ?? false,
    link_jobs: initialProfile?.link_jobs ?? false,
    photo_urls: initialProfile?.photo_urls ?? [],
    show_listings: initialProfile?.show_listings ?? true,
    is_active: initialProfile?.is_active ?? true,
  }));
  const [error, setError] = useState<string | null>(null);
  const [purposesError, setPurposesError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      nickname: initialProfile?.nickname ?? '',
      looking_for: initialProfile?.looking_for ?? '',
      offer: initialProfile?.offer ?? '',
      comment: initialProfile?.comment ?? '',
      purposes: initialProfile?.purposes ?? [],
      link_market: initialProfile?.link_market ?? false,
      link_housing: initialProfile?.link_housing ?? false,
      link_jobs: initialProfile?.link_jobs ?? false,
      photo_urls: initialProfile?.photo_urls ?? [],
      show_listings: initialProfile?.show_listings ?? true,
      is_active: initialProfile?.is_active ?? true,
    });
    setPurposesError(false);
  }, [initialProfile]);

  const handleCheckbox = (purpose: DatingPurpose) => {
    setForm((prev) => {
      const nextPurposes = prev.purposes.includes(purpose)
        ? prev.purposes.filter((p) => p !== purpose)
        : [...prev.purposes, purpose];
      return { ...prev, purposes: nextPurposes };
    });
    setPurposesError(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.nickname.trim() || !form.looking_for.trim() || !form.offer.trim()) {
      setError('Заполните никнейм, что ищете и что предлагаете.');
      return;
    }

    if (!form.purposes.length) {
      setPurposesError(true);
      setError('Выберите хотя бы одну цель.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/dating/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!data?.ok) {
        if (data?.error === 'PURPOSES_REQUIRED') {
          setPurposesError(true);
          setError('Выберите хотя бы одну цель.');
          return;
        }

        setError('Не удалось сохранить анкету. Проверьте поля и попробуйте снова.');
        return;
      }

      onSaved(data.profile);
    } catch (err) {
      console.error(err);
      setError('Произошла ошибка. Попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{initialProfile ? 'Редактирование анкеты' : 'Создание анкеты'}</h2>
      <div className="form-grid">
        <label className="input-label">
          Никнейм
          <input
            className="input"
            value={form.nickname}
            onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
            required
          />
        </label>

        <label className="input-label">
          Что/кого ищу?
          <textarea
            className="input textarea"
            value={form.looking_for}
            onChange={(e) => setForm((prev) => ({ ...prev, looking_for: e.target.value }))}
            required
            rows={3}
          />
        </label>

        <label className="input-label">
          Что предлагаю?
          <textarea
            className="input textarea"
            value={form.offer}
            onChange={(e) => setForm((prev) => ({ ...prev, offer: e.target.value }))}
            required
            rows={3}
          />
        </label>

        <label className="input-label">
          Комментарий / О себе
          <textarea
            className="input textarea"
            value={form.comment ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            rows={2}
            placeholder="Опционально"
          />
        </label>
      </div>

      <div className={`card-section purposes ${purposesError ? 'card-section-error' : ''}`}>
        <div className="label">Цели знакомств</div>
        <div className="purpose-grid">
          {DATING_PURPOSE_ENTRIES.map(([value, meta]) => (
            <label key={value} className="purpose-item">
              <input
                type="checkbox"
                checked={form.purposes.includes(value)}
                onChange={() => handleCheckbox(value)}
              />
              <div>
                <div className="purpose-title">{meta.label}</div>
                <div className="purpose-description">{meta.description}</div>
              </div>
            </label>
          ))}
        </div>
        {purposesError ? <div className="hint error">Выберите хотя бы одну цель.</div> : null}
      </div>

      <div className="toggle-grid">
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={form.link_market}
            onChange={(e) => setForm((prev) => ({ ...prev, link_market: e.target.checked }))}
          />
          <span>Показывать мои объявления в Маркете</span>
        </label>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={form.link_housing}
            onChange={(e) => setForm((prev) => ({ ...prev, link_housing: e.target.checked }))}
          />
          <span>Показывать мои объявления в Жилье</span>
        </label>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={form.link_jobs}
            onChange={(e) => setForm((prev) => ({ ...prev, link_jobs: e.target.checked }))}
          />
          <span>Показывать мои объявления в Работе</span>
        </label>
      </div>

      <div className="toggle-grid">
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={form.show_listings}
            onChange={(e) => setForm((prev) => ({ ...prev, show_listings: e.target.checked }))}
          />
          <span>Показывать мои объявления в анкете</span>
        </label>
        <label className="checkbox-item">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          <span>Показывать анкету в поиске (можно отключить в любой момент)</span>
        </label>
      </div>

      <label className="input-label">
        Фото (URL через запятую)
        <input
          className="input"
          value={form.photo_urls.join(', ')}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              photo_urls: e.target.value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
            }))
          }
          placeholder="https://..."
        />
      </label>
      <div className="hint muted">Отсутствие фото снижает видимость анкеты.</div>

      {error ? <div className="hint error">{error}</div> : null}

      <div className="form-actions">
        {onCancel ? (
          <button className="ghost-btn" type="button" onClick={onCancel}>
            Отмена
          </button>
        ) : null}
        <button className="primary-btn" type="submit" disabled={isSubmitting}>
          {initialProfile ? 'Сохранить изменения' : 'Создать анкету'}
        </button>
      </div>
    </form>
  );
}

export default function DatingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DatingProfile | null>(null);
  const [profileListings, setProfileListings] = useState<ListingPreviewGroups>(EMPTY_LISTINGS);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [feed, setFeed] = useState<DatingProfileWithListings[]>([]);
  const [catalog, setCatalog] = useState<DatingProfileWithListings[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [showMatches, setShowMatches] = useState(false);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [reportTarget, setReportTarget] = useState<DatingProfile | null>(null);
  const [reportReason, setReportReason] = useState<DatingReportReason>('escort');
  const [reportComment, setReportComment] = useState('');
  const [reportStatus, setReportStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const currentCard = feed[feedIndex] ?? null;

  const fetchProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const response = await fetch('/api/dating/profile');
      const data = await response.json();
      if (data?.ok) {
        setProfile(data.profile);
        setProfileListings(data.listings ?? EMPTY_LISTINGS);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchFeed = async () => {
    setIsLoadingFeed(true);
    try {
      const response = await fetch('/api/dating/feed');
      const data = await response.json();
      if (data?.ok) {
        setFeed((data.items as DatingProfileWithListings[]) ?? []);
        setFeedIndex(0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingFeed(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const response = await fetch('/api/dating/feed?limit=5');
      const data = await response.json();
      if (data?.ok) {
        setCatalog((data.items as DatingProfileWithListings[]) ?? []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchMatches = async () => {
    setIsLoadingMatches(true);
    try {
      const response = await fetch('/api/dating/matches');
      const data = await response.json();
      if (data?.ok) {
        setMatches(data.items ?? []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const openReportModal = (profileToReport: DatingProfile) => {
    setReportTarget(profileToReport);
    setReportReason('escort');
    setReportComment('');
    setReportStatus('idle');
  };

  const submitReport = async () => {
    if (!reportTarget) return;
    setReportStatus('submitting');
    try {
      const response = await fetch('/api/dating/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: reportTarget.user_id, reason: reportReason, comment: reportComment }),
      });

      const data = await response.json();
      if (data?.ok) {
        setReportStatus('success');
      } else {
        setReportStatus('error');
      }
    } catch (error) {
      console.error(error);
      setReportStatus('error');
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchFeed();
    fetchCatalog();
  }, []);

  const openSection = (
    section: ListingPreview['section'],
    options?: { mine?: boolean; listingId?: string; authorId?: string },
  ) => {
    const params = new URLSearchParams();
    if (options?.mine) params.set('mine', '1');
    if (options?.listingId) params.set('listing', options.listingId);
    if (options?.authorId) params.set('author', options.authorId);

    const query = params.toString();
    const path = `/${section}`;
    router.push(query ? `${path}?${query}` : path);
  };

  const hasListings = (listings: ListingPreviewGroups) =>
    listings.market.length + listings.housing.length + listings.jobs.length > 0;

  const hasMyListings = useMemo(
    () => (profile?.show_listings ? hasListings(profileListings) : false),
    [profile, profileListings],
  );

  const isProfileStale = useMemo(() => {
    if (!profile) return false;
    if (typeof profile.is_stale === 'boolean') return profile.is_stale;
    if (!profile.last_activated_at) return true;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return !profile.is_active || new Date(profile.last_activated_at).getTime() < ninetyDaysAgo;
  }, [profile]);

  const otherListingsPreview = useMemo(() => {
    if (!currentCard?.listings || !currentCard.show_listings) return [] as ListingPreview[];
    return [...currentCard.listings.market, ...currentCard.listings.housing, ...currentCard.listings.jobs].slice(0, 3);
  }, [currentCard]);

  const handleSavedProfile = (newProfile: DatingProfile) => {
    setProfile(newProfile);
    setIsEditing(false);
    fetchFeed();
    fetchCatalog();
  };

  const handleSwipe = async (decision: 'like' | 'dislike') => {
    if (!currentCard) return;
    setMatchNotice(null);
    try {
      const response = await fetch('/api/dating/swipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toProfileId: currentCard.id, decision }),
      });

      const data = await response.json();
      if (data?.ok) {
        if (data.matchCreated) {
          setMatchNotice('У вас новый мэтч! Можно написать в Telegram.');
          fetchMatches();
        }
        setFeedIndex((prev) => prev + 1);
        if (feedIndex + 1 >= feed.length - 2) {
          fetchFeed();
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRefreshProfile = async () => {
    if (!profile) return;
    setIsRefreshingProfile(true);

    const payload: SavePayload = {
      nickname: profile.nickname,
      looking_for: profile.looking_for,
      offer: profile.offer,
      comment: profile.comment ?? '',
      purposes: profile.purposes,
      link_market: profile.link_market,
      link_housing: profile.link_housing,
      link_jobs: profile.link_jobs,
      photo_urls: profile.photo_urls ?? [],
      show_listings: profile.show_listings,
      is_active: true,
    };

    try {
      const response = await fetch('/api/dating/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data?.ok) {
        setProfile(data.profile);
        fetchFeed();
        fetchCatalog();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  const matchesList = useMemo(() => matches, [matches]);

  return (
    <SectionLayout>
      <SectionHeaderCard
        title="Знакомства"
        subtitle="Свайпы, быстрые мэтчи и переход в Telegram. Заполните анкету, чтобы попадать в ленту и получать взаимные лайки."
      />

      <div className="actions-row" style={{ marginBottom: '12px' }}>
        <Link href="/profile?tab=dating" className="primary-btn">
          Настроить анкету
        </Link>
        <Link href="/profile?tab=basic" className="ghost-btn">
          Основное о себе
        </Link>
      </div>

      <div className="grid">
        {matchNotice ? <div className="hint success">{matchNotice}</div> : null}

        {profile && !isEditing && isProfileStale ? (
          <div className="hint warning">
            Анкета неактуальна: её не обновляли более 90 дней или она выключена. Обновите данные, чтобы снова показываться в
            поиске.
            <div className="actions-row" style={{ marginTop: '8px' }}>
              <button className="primary-btn" type="button" onClick={handleRefreshProfile} disabled={isRefreshingProfile}>
                {isRefreshingProfile ? 'Обновляем...' : 'Обновить анкету'}
              </button>
              <button className="ghost-btn" type="button" onClick={() => setIsEditing(true)}>
                Изменить данные
              </button>
            </div>
          </div>
        ) : null}

        {isLoadingProfile ? (
          <div className="card">Загружаем вашу анкету...</div>
        ) : !profile || isEditing ? (
          <ProfileForm initialProfile={profile} onSaved={handleSavedProfile} onCancel={() => setIsEditing(false)} />
        ) : (
          <>
            <div className="card">
              <h2>Моя анкета</h2>
              <ProfileCard profile={profile} isMine>
                <button className="ghost-btn" type="button" onClick={() => setIsEditing(true)}>
                  Редактировать
                </button>
              </ProfileCard>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Мои объявления</h3>
              </div>
              <p className="muted">Активные объявления из Маркета, Жилья и Работы, привязанные к этому аккаунту.</p>

              {!profile.show_listings ? (
                <div className="hint warning">Вы скрыли объявления в анкете. Включите переключатель в форме, если хотите показывать их другим пользователям.</div>
              ) : !hasMyListings ? (
                <>
                  <div className="hint">У вас пока нет активных объявлений. Создайте их в разделах Маркет, Жильё или Работа — и они появятся здесь.</div>
                  <div className="actions-row">
                    <button className="ghost-btn" type="button" onClick={() => openSection('market', { mine: true })}>
                      Открыть Маркет
                    </button>
                    <button className="ghost-btn" type="button" onClick={() => openSection('housing', { mine: true })}>
                      Открыть Жильё
                    </button>
                    <button className="ghost-btn" type="button" onClick={() => openSection('jobs', { mine: true })}>
                      Открыть Работу
                    </button>
                  </div>
                </>
              ) : (
                <div className="profile-section">
                  {profileListings.market.length ? (
                    <div className="profile-section">
                      <div className="label">Маркет</div>
                      <div className="catalog-grid">
                        {profileListings.market.map((listing) => (
                          <ListingPreviewCard
                            key={listing.id}
                            listing={listing}
                            onClick={() => openSection('market', { listingId: listing.id })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {profileListings.housing.length ? (
                    <div className="profile-section">
                      <div className="label">Жильё</div>
                      <div className="catalog-grid">
                        {profileListings.housing.map((listing) => (
                          <ListingPreviewCard
                            key={listing.id}
                            listing={listing}
                            onClick={() => openSection('housing', { listingId: listing.id })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {profileListings.jobs.length ? (
                    <div className="profile-section">
                      <div className="label">Работа</div>
                      <div className="catalog-grid">
                        {profileListings.jobs.map((listing) => (
                          <ListingPreviewCard
                            key={listing.id}
                            listing={listing}
                            onClick={() => openSection('jobs', { listingId: listing.id })}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}

        {profile && !isEditing ? (
          <>
            <div className="card">
              <div className="card-header">
                <h2>Лента знакомств</h2>
                <button className="ghost-btn" type="button" onClick={fetchFeed} disabled={isLoadingFeed}>
                  Обновить ленту
                </button>
              </div>

              {isLoadingFeed ? <p className="muted">Загружаем...</p> : null}
              {!currentCard && !isLoadingFeed ? <p className="muted">Новых анкет нет. Обновите позже.</p> : null}

              {currentCard ? (
                <>
                  <ProfileCard profile={currentCard}>
                    <div className="actions-row">
                      <button className="ghost-btn" type="button" onClick={() => handleSwipe('dislike')}>
                        Пропустить
                      </button>
                      <button className="primary-btn" type="button" onClick={() => handleSwipe('like')}>
                        Лайк
                      </button>
                    </div>
                    <button className="ghost-btn" type="button" onClick={() => openReportModal(currentCard)}>
                      Пожаловаться
                    </button>
                  </ProfileCard>

                  {currentCard.show_listings ? (
                    <div className="profile-section">
                      <div className="label">Объявления пользователя</div>
                      <p className="subtitle">Активные объявления из разделов М7 платформы.</p>
                      {otherListingsPreview.length ? (
                        <div className="catalog-grid">
                          {otherListingsPreview.map((listing) => (
                            <ListingPreviewCard
                              key={`${listing.section}-${listing.id}`}
                              listing={listing}
                              onClick={() => openSection(listing.section, { listingId: listing.id, authorId: currentCard.user_id })}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Объявления пользователя пока не найдены.</p>
                      )}
                    </div>
                  ) : (
                    <div className="profile-section">
                      <div className="label">Объявления пользователя</div>
                      <p className="muted">У пользователя есть активные объявления, но они скрыты настройками профиля.</p>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Мои мэтчи</h2>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    setShowMatches((prev) => !prev);
                    if (!showMatches) {
                      fetchMatches();
                    }
                  }}
                >
                  {showMatches ? 'Скрыть' : 'Показать'}
                </button>
              </div>
              {showMatches ? (
                <div className="matches-list">
                  {isLoadingMatches ? <p className="muted">Загружаем...</p> : null}
                  {!isLoadingMatches && !matchesList.length ? <p className="muted">Пока нет матчей.</p> : null}
                  {matchesList.map((match) => (
                    <div key={match.matchId} className="match-card">
                      <div className="match-title">{match.profile?.nickname ?? match.nicknameFallback}</div>
                      {match.profile?.purposes?.length ? <PurposeBadges purposes={match.profile.purposes} /> : null}
                      {match.profile?.isBanned || match.isBanned ? (
                        <div className="hint warning">Профиль временно недоступен: идёт проверка модератором.</div>
                      ) : (
                        <a className="primary-btn" href={`https://t.me/${match.telegramUsername}`} target="_blank" rel="noreferrer">
                          Написать в Telegram
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Здесь будут ваши взаимные лайки. Откройте список, чтобы написать в Telegram.</p>
              )}
            </div>

            <div className="card">
              <div className="card-header">
                <h2>Каталог</h2>
                <button className="ghost-btn" type="button" onClick={fetchCatalog}>
                  Обновить
                </button>
              </div>
              {!catalog.length ? <p className="muted">Пока нет новых анкет.</p> : null}
              <div className="catalog-grid">
                {catalog.map((item) => (
                  <ProfileCard key={item.id} profile={item} compact />
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {reportTarget ? (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '480px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className="card-header">
              <h3>Пожаловаться на профиль</h3>
              <button className="ghost-btn" type="button" onClick={() => setReportTarget(null)}>
                Закрыть
              </button>
            </div>

            <p className="muted">Выберите причину и добавьте комментарий, если нужно.</p>

            <div className="profile-section">
              {REPORT_REASONS.map((item) => (
                <label key={item.value} className="radio-item">
                  <input
                    type="radio"
                    name="report-reason"
                    value={item.value}
                    checked={reportReason === item.value}
                    onChange={() => setReportReason(item.value)}
                  />
                  <span style={{ marginLeft: '8px' }}>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="profile-section">
              <div className="label">Комментарий (необязательно)</div>
              <textarea
                value={reportComment}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReportComment(event.target.value)}
                placeholder="Опишите проблему"
              />
            </div>

            {reportStatus === 'success' ? (
              <div className="hint success">
                Жалоба отправлена. При трех жалобах профиль временно блокируется до проверки модератором.
              </div>
            ) : null}

            {reportStatus === 'error' ? (
              <div className="hint error">Не удалось отправить жалобу, попробуйте позже.</div>
            ) : null}

            <div className="actions-row">
              <button className="ghost-btn" type="button" onClick={() => setReportTarget(null)}>
                Отмена
              </button>
              <button className="primary-btn" type="button" onClick={submitReport} disabled={reportStatus === 'submitting'}>
                {reportStatus === 'submitting' ? 'Отправляем...' : 'Отправить жалобу'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionLayout>
  );
}
