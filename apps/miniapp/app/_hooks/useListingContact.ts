'use client';

import { useState } from 'react';

type ListingSection = 'market' | 'housing' | 'jobs';

export type ListingContactState = {
  telegramUsername: string | null;
};

export function useListingContact(section: ListingSection, listingId: string) {
  const [contact, setContact] = useState<ListingContactState | null>(null);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestContact = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/listings/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, listingId }),
      });

      const data = await response.json();

      if (!response.ok || !data?.ok) {
        const code = data?.error ?? 'failed_to_request_contact';
        if (code === 'unauthorized') {
          setError('Авторизуйтесь, чтобы получить контакт.');
        } else if (code === 'cannot_purchase_own_listing') {
          setError('Это ваше объявление — контакт уже у вас есть.');
        } else if (code === 'not_found') {
          setError('Объявление не найдено.');
        } else {
          setError('Не удалось получить контакт. Попробуйте ещё раз.');
        }
        return;
      }

      setContact({ telegramUsername: data.contact?.telegramUsername ?? null });
      setAlreadyPurchased(true);
    } catch (err) {
      console.error('[useListingContact] unexpected error', err);
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsLoading(false);
    }
  };

  return { contact, alreadyPurchased, isLoading, error, requestContact };
}
