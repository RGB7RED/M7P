export type TelegramBackButton = {
  show: () => void;
  hide: () => void;
  onClick: (callback: () => void) => void;
  offClick?: (callback: () => void) => void;
};

export type TelegramWebApp = {
  BackButton: TelegramBackButton;
} & Record<string, unknown>;

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const telegram = (window as typeof window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram;
  const tg = telegram?.WebApp;

  return tg ?? null;
}

export function showBackButton(onClick: () => void) {
  const tg = getWebApp();
  if (!tg) return;

  tg.BackButton.show();
  tg.BackButton.onClick(onClick);
}

export function hideBackButton(onClick?: () => void) {
  const tg = getWebApp();
  if (!tg) return;

  if (onClick && typeof tg.BackButton.offClick === 'function') {
    tg.BackButton.offClick(onClick);
  }

  tg.BackButton.hide();
}
