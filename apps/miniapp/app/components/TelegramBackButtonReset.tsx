'use client';

import { useEffect } from 'react';

import { getWebApp } from '../../lib/telegramWebApp';

export function TelegramBackButtonReset() {
  useEffect(() => {
    const tg = getWebApp();
    if (!tg) return;

    try {
      (tg as { ready?: () => void }).ready?.();
    } catch {
      // ignore ready errors
    }

    tg.BackButton.hide();
    tg.BackButton.offClick?.(() => {});
  }, []);

  return null;
}
