'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getWebApp } from './telegramWebApp';

export function useTelegramBackToRoot() {
  const router = useRouter();

  useEffect(() => {
    const tg = getWebApp();
    if (!tg) return;

    const onBack = () => router.push('/');
    tg.BackButton.show();
    tg.BackButton.onClick(onBack);

    return () => {
      tg.BackButton.hide();
      tg.BackButton.offClick?.(onBack);
    };
  }, [router]);
}
