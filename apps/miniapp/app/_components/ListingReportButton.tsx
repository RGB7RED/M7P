'use client';

import { ChangeEvent, useState } from 'react';

import type { ListingReportReason } from '../api/listings/_helpers/reports';
import type { ListingSection } from '../api/listings/_helpers/sections';

const REASONS: { value: ListingReportReason; label: string }[] = [
  { value: 'spam', label: 'Спам / нерелевантное' },
  { value: 'scam', label: 'Мошенничество / скам' },
  { value: 'escort', label: 'Эскорт / интим услуги' },
  { value: 'drugs', label: 'Наркотики' },
  { value: 'weapons', label: 'Оружие / опасные товары' },
  { value: 'other', label: 'Другое' },
];

type Props = {
  section: ListingSection;
  listingId: string;
  onReported?: (autoArchived: boolean) => void;
};

export function ListingReportButton({ section, listingId, onReported }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ListingReportReason>('spam');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/listings/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, listingId, reason, comment: comment.trim() || undefined }),
      });

      const data = await response.json();
      if (!response.ok || !data?.ok) {
        const code = data?.error;
        if (code === 'UNAUTHORIZED') {
          setError('Авторизуйтесь, чтобы отправить жалобу.');
        } else if (code === 'LISTING_NOT_FOUND') {
          setError('Объявление не найдено или уже удалено.');
        } else if (code === 'LISTING_NOT_ACTIVE') {
          setError('Объявление уже скрыто.');
        } else if (code === 'REPORT_ALREADY_EXISTS') {
          setError('Вы уже отправляли жалобу на это объявление.');
        } else {
          setError('Не удалось отправить жалобу, попробуйте позже.');
        }
        setStatus('error');
        return;
      }

      setStatus('success');
      setIsOpen(false);
      setComment('');
      onReported?.(Boolean(data.autoArchived));
    } catch (err) {
      console.error('[ListingReportButton] unexpected error', err);
      setError('Произошла ошибка. Попробуйте позже.');
      setStatus('error');
    }
  };

  return (
    <div style={{ marginTop: '8px' }}>
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
            padding: '12px',
          }}
        >
          <div className="card" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card-header">
              <h3>Пожаловаться на объявление</h3>
              <button className="ghost-btn" type="button" onClick={() => setIsOpen(false)}>
                Закрыть
              </button>
            </div>

            <p className="muted">Выберите причину и при необходимости добавьте комментарий.</p>

            <div className="profile-section">
              {REASONS.map((item) => (
                <label key={item.value} className="radio-item">
                  <input
                    type="radio"
                    name={`listing-report-${listingId}`}
                    value={item.value}
                    checked={reason === item.value}
                    onChange={() => setReason(item.value)}
                  />
                  <span style={{ marginLeft: '8px' }}>{item.label}</span>
                </label>
              ))}
            </div>

            <div className="profile-section">
              <div className="label">Комментарий (необязательно)</div>
              <textarea
                value={comment}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setComment(event.target.value)}
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
              <button className="primary-btn" type="button" onClick={submit} disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Отправляем...' : 'Отправить жалобу'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
