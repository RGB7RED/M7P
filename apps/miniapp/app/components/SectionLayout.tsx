'use client';

import type { ReactNode } from 'react';

import { useTelegramBackButton } from '../../lib/useTelegramBackButton';

type SectionLayoutProps = {
  children: ReactNode;
  className?: string;
  showBackButton?: boolean;
};

export function SectionLayout({
  children,
  className,
  showBackButton = true,
}: SectionLayoutProps) {
  useTelegramBackButton(showBackButton);

  const classes = ['m7-miniapp-root', 'section-layout', className].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
