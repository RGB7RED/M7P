'use client';

import type { ReactNode } from 'react';

import { useTelegramBackToRoot } from '../../lib/useTelegramBackToRoot';

export function SectionLayout({ children, className }: { children: ReactNode; className?: string }) {
  useTelegramBackToRoot();

  const classes = ['section-layout', className].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
