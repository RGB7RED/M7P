'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

type DatingPurpose =
  | 'romantic'
  | 'co_rent'
  | 'rent_tenant'
  | 'rent_landlord'
  | 'market_seller'
  | 'market_buyer'
  | 'job_employer'
  | 'job_seeker'
  | 'job_buddy';

type DatingProfile = {
  id: string;
  user_id: string;
  nickname: string;
  looking_for: string;
  offering: string;
  comment?: string | null;
  purposes: DatingPurpose[];
  photo_urls: string[];
  has_photo: boolean;
  link_market: boolean;
  link_housing: boolean;
  link_jobs: boolean;
  is_verified: boolean;
  status: string;
  created_at: string;
};

type MatchItem = {
  matchId: string;
  userId: string;
  telegramUsername: string;
  profile: Pick<DatingProfile, 'nickname' | 'purposes' | 'has_photo'> | null;
  nicknameFallback: string;
};

const PURPOSE_LABELS: Record<DatingPurpose, string> = {
  romantic: 'Романтика / общение',
  co_rent: 'Снимать жильё вместе',
  rent_tenant: 'Ищу жильё как арендатор',
  rent_landlord: 'Сдаю жильё',
  market_seller: 'Продаю / оказываю услуги',
  market_buyer: 'Покупаю / ищу услуги',
  job_employer: 'Ищу сотрудников',
  job_seeker: 'Ищу работу',
  job_buddy: 'Ищу напарника',
};

const PURPOSE_OPTIONS = Object.entries(PURPOSE_LABELS) as [DatingPurpose, string][];

type SavePayload = {
  nickname: string;
  looking_for: string;
  offering: string;
  comment?: string | null;
  purposes: DatingPurpose[];
  link_market: boolean;
  link_housing: boolean;
  link_jobs: boolean;
  photo_urls: string[];
};

function PurposeBadges({ purposes }: { purposes: DatingPurpose[] }) {
  return (
    <div className="badges">
      {purposes.map((purpose) => (
        <span key={purpose} className="badge">
          {PURPOSE_LABELS[purpose]}
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

      <div className="profile-section">
        <div className="label">Ищу</div>
        <p>{profile.looking_for}</p>
      </div>

      <div className="profile-section">
        <div className="label">Предлагаю</div>
        <p>{profile.offering}</p>
      </div>

      {profile.comment ? (
        <div className="profile-section">
          <div className="label">Комментарий</div>
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
    offering: initialProfile?.offering ?? '',
    comment: initialProfile?.comment ?? '',
    purposes: initialProfile?.purposes ?? [],
    link_market: initialProfile?.link_market ?? false,
    link_housing: initialProfile?.link_housing ?? false,
    link_jobs: initialProfile?.link_jobs ?? false,
    photo_urls: initialProfile?.photo_urls ?? [],
  }));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setForm({
      nickname: initialProfile?.nickname ?? '',
      looking_for: initialProfile?.looking_for ?? '',
      offering: initialProfile?.offering ?? '',
      comment: initialProfile?.comment ?? '',
      purposes: initialProfile?.purposes ?? [],
      link_market: initialProfile?.link_market ?? false,
      link_housing: initialProfile?.link_housing ?? false,
      link_jobs: initialProfile?.link_jobs ?? false,
      photo_urls: initialProfile?.photo_urls ?? [],
    });
  }, [initialProfile]);

  const handleCheckbox = (purpose: DatingPurpose) => {
    setForm((prev) => {
      const nextPurposes = prev.purposes.includes(purpose)
        ? prev.purposes.filter((p) => p !== purpose)
        : [...prev.purposes, purpose];
      return { ...prev, purposes: nextPurposes };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!form.nickname.trim() || !form.looking_for.trim() || !form.offering.trim()) {
      setError('Заполните никнейм, что ищете и что предлагаете.');
      return;
    }

    if (!form.purposes.length) {
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
            value={form.offering}
            onChange={(e) => setForm((prev) => ({ ...prev, offering: e.target.value }))}
            required
            rows={3}
          />
        </label>

        <label className="input-label">
          Комментарий
          <textarea
            className="input textarea"
            value={form.comment ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
            rows={2}
            placeholder="Опционально"
          />
        </label>
      </div>

      <div className="card-section">
        <div className="label">Цели знакомств</div>
        <div className="checkbox-grid">
          {PURPOSE_OPTIONS.map(([value, label]) => (
            <label key={value} className="checkbox-item">
              <input
                type="checkbox"
                checked={form.purposes.includes(value)}
                onChange={() => handleCheckbox(value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
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
  const [profile, setProfile] = useState<DatingProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [feed, setFeed] = useState<DatingProfile[]>([]);
  const [catalog, setCatalog] = useState<DatingProfile[]>([]);
  const [feedIndex, setFeedIndex] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [matchNotice, setMatchNotice] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [showMatches, setShowMatches] = useState(false);

  const currentCard = feed[feedIndex] ?? null;

  const fetchProfile = async () => {
    setIsLoadingProfile(true);
    try {
      const response = await fetch('/api/dating/profile');
      const data = await response.json();
      if (data?.ok) {
        setProfile(data.profile);
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
        setFeed(data.items ?? []);
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
        setCatalog(data.items ?? []);
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

  useEffect(() => {
    fetchProfile();
    fetchFeed();
    fetchCatalog();
  }, []);

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

  const matchesList = useMemo(() => matches, [matches]);

  return (
    <div className="grid">
      <div className="card">
        <h1 className="hero-title">Знакомства</h1>
        <p className="hero-text">
          Свайпы, быстрые мэтчи и переход в Telegram. Заполните свою анкету, чтобы попасть в ленту и получать взаимные лайки.
        </p>
      </div>

      {matchNotice ? <div className="hint success">{matchNotice}</div> : null}

      {isLoadingProfile ? (
        <div className="card">Загружаем вашу анкету...</div>
      ) : !profile || isEditing ? (
        <ProfileForm initialProfile={profile} onSaved={handleSavedProfile} onCancel={() => setIsEditing(false)} />
      ) : (
        <div className="card">
          <h2>Моя анкета</h2>
          <ProfileCard profile={profile} isMine>
            <button className="ghost-btn" type="button" onClick={() => setIsEditing(true)}>
              Редактировать
            </button>
          </ProfileCard>
        </div>
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
                </ProfileCard>
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
                    <a className="primary-btn" href={`https://t.me/${match.telegramUsername}`} target="_blank" rel="noreferrer">
                      Написать в Telegram
                    </a>
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
  );
}
