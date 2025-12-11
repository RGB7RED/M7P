'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { getWebApp } from './telegramWebApp';

export function useTelegramBackButton(enabled: boolean) {
  const router = useRouter();

  useEffect(() => {
    const tg = getWebApp();
    if (!tg) return;

    try {
      (tg as { ready?: () => void }).ready?.();
    } catch {
      // ignore ready errors
    }

    const handleClick = () => {
      if (typeof window !== 'undefined' && window.location.pathname === '/') {
        return;
      }

      router.push('/');
    };

    if (enabled) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleClick);
    } else {
      tg.BackButton.hide();
      tg.BackButton.offClick?.(handleClick);
    }

    return () => {
      tg.BackButton.offClick?.(handleClick);
      if (!enabled) {
        tg.BackButton.hide();
      }
    };
  }, [enabled, router]);
}
