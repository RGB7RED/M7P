'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Главная' },
  { href: '/dating', label: 'Знакомства' },
  { href: '/market', label: 'Маркет' },
  { href: '/housing', label: 'Жильё' },
  { href: '/jobs', label: 'Работа' },
];

export function MainTabs() {
  const pathname = usePathname();

  return (
    <nav className="tabs" aria-label="Основная навигация">
      {tabs.map((tab) => {
        const isActive = tab.href === '/' ? pathname === '/' : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab ${isActive ? 'tab-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
