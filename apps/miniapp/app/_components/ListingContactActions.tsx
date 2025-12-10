'use client';

import Link from 'next/link';
import { useListingContact } from '../_hooks/useListingContact';

type Props = {
  section: 'market' | 'housing' | 'jobs';
  listingId: string;
  isOwner?: boolean;
};

export function ListingContactActions({ section, listingId, isOwner = false }: Props) {
  const { contact, alreadyPurchased, isLoading, error, requestContact } = useListingContact(section, listingId);

  const handleRequest = async () => {
    const confirmed = window.confirm(
      'Сейчас реальной оплаты нет, но мы фиксируем, что вы «купили» контакт по этому объявлению за 50 ₽ (MVP). Продолжить?',
    );
    if (!confirmed) return;

    await requestContact();
  };

  if (isOwner) {
    return <p className="subtitle">Это ваше объявление — контакт доступен вам по умолчанию.</p>;
  }

  return (
    <div className="card-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
      {contact || alreadyPurchased ? (
        <div className="links-grid" style={{ alignItems: 'center' }}>
          <span className="pill">Контакт получен</span>
          <span className="subtitle">
            Telegram: {contact?.telegramUsername ? `@${contact.telegramUsername}` : 'пользователь не указал username'}
          </span>
          {contact?.telegramUsername ? (
            <Link className="primary-btn" target="_blank" href={`https://t.me/${contact.telegramUsername}`}>
              Открыть в Telegram
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <button className="primary-btn" onClick={handleRequest} disabled={isLoading}>
            {isLoading ? 'Запрашиваем контакт...' : 'Познакомиться по объявлению · 50 ₽'}
          </button>
          <p className="subtitle">Оплата пока не взимается — фиксируем покупку внутри приложения.</p>
        </>
      )}
      {error ? (
        <div className="hint error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
