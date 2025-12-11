'use client';

import { useEffect } from 'react';

import { getWebApp } from './telegramWebApp';
import { useGoToHub } from './navigation';

export function useTelegramBackButton(enabled: boolean) {
  const goToHub = useGoToHub();

  useEffect(() => {
    const tg = getWebApp();
    if (!tg) return;

    try {
      (tg as { ready?: () => void }).ready?.();
    } catch {
      // ignore ready errors
    }

    const handleClick = () => goToHub();

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
  }, [enabled, goToHub]);
}
