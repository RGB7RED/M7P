'use client';

import { useEffect } from 'react';

import { hideBackButton } from '../../lib/telegramWebApp';

export function TelegramBackButtonReset() {
  useEffect(() => {
    hideBackButton();
  }, []);

  return null;
}
