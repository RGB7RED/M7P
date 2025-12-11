'use client';

import type { ReactNode } from 'react';

type SectionHeaderCardProps = {
  title: string;
  subtitle?: string;
  helper?: ReactNode;
};

export function SectionHeaderCard({ title, subtitle, helper }: SectionHeaderCardProps) {
  return (
    <section className="section-header-card">
      <h1 className="section-header-title">{title}</h1>
      {subtitle ? <p className="section-header-subtitle">{subtitle}</p> : null}
      {helper ? <div className="section-header-helper">{helper}</div> : null}
    </section>
  );
}
