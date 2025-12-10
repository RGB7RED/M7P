'use client';

import { useState } from 'react';

type Section = 'market' | 'housing' | 'jobs';

type Props = {
  section: Section;
  listingId: string;
  onReported?: (autoArchived: boolean) => void;
};

type ReportReason = 'spam' | 'scam' | 'escort' | 'drugs' | 'weapons' | 'other';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Спам / нерелевантное' },
  { value: 'scam', label: 'Мошенничество / скам' },
  { value: 'escort', label: 'Эскорт / интим услуги' },
  { value: 'drugs', label: 'Наркотики' },
  { value: 'weapons', label: 'Оружие / опасные товары' },
  { value: 'other', label: 'Другое' },
];

export function ListingReportButton({ section, listingId, onReported }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submitReport = async () => {
    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/listings/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, listingId, reason, comment: comment.trim() || undefined }),
      });

      const data = await response.json();
      if (!data?.ok) {
        setStatus('error');
        setError(
          data?.error === 'ALREADY_REPORTED'
            ? 'Вы уже отправляли жалобу на это объявление.'
            : 'Не удалось отправить жалобу. Попробуйте позже.',
        );
        return;
      }

      setStatus('idle');
      setIsOpen(false);
      setComment('');
      setReason('spam');
      onReported?.(Boolean(data?.autoArchived));
    } catch (err) {
      console.error(err);
      setStatus('error');
      setError('Не удалось отправить жалобу. Попробуйте позже.');
    }
  };

  return (
    <>
      <button className="ghost-btn" type="button" onClick={() => setIsOpen(true)}>
        Пожаловаться
      </button>

      {isOpen ? (
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
          <div className="card" style={{ maxWidth: '480px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h3>Пожаловаться на объявление</h3>
              <button className="ghost-btn" type="button" onClick={() => setIsOpen(false)}>
                Закрыть
              </button>
            </div>

            <p className="muted">Выберите причину и добавьте комментарий, если нужно.</p>

            <div className="profile-section" style={{ display: 'grid', gap: 8 }}>
              {REASONS.map((item) => (
                <label key={item.value} className="radio-item">
                  <input
                    type="radio"
                    name={`report-reason-${listingId}`}
                    value={item.value}
                    checked={reason === item.value}
                    onChange={() => setReason(item.value)}
                  />
                  <span style={{ marginLeft: 8 }}>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="profile-section">
              <div className="label">Комментарий (необязательно)</div>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Опишите проблему"
              />
            </div>

            {error ? (
              <div className="hint error" role="alert">
                {error}
              </div>
            ) : null}

            <div className="actions-row">
              <button className="ghost-btn" type="button" onClick={() => setIsOpen(false)}>
                Отмена
              </button>
              <button className="primary-btn" type="button" onClick={submitReport} disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Отправляем...' : 'Отправить жалобу'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
