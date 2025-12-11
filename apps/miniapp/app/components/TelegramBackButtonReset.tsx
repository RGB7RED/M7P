'use client';

import { useEffect } from 'react';

import { getWebApp } from '../../lib/telegramWebApp';

export function TelegramBackButtonReset() {
  useEffect(() => {
    const tg = getWebApp();
    if (!tg) return;

    const noop = () => {};
    tg.BackButton.hide();
    tg.BackButton.offClick?.(noop);
    tg.BackButton.onClick(noop);

    return () => {
      tg.BackButton.offClick?.(noop);
    };
  }, []);

  return null;
}
