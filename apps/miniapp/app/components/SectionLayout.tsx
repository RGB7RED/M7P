'use client';

import type { ReactNode } from 'react';

export function SectionLayout({ children, className }: { children: ReactNode; className?: string }) {
  const classes = ['section-layout', className].filter(Boolean).join(' ');

  return <div className={classes}>{children}</div>;
}
