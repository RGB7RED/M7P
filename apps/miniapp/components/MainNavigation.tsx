'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { href: '/', label: 'Главная' },
  { href: '/dating', label: 'Знакомства' },
  { href: '/market', label: 'Маркет' },
  { href: '/housing', label: 'Жильё' },
  { href: '/jobs', label: 'Работа' },
];

export function MainNavigation() {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Основная навигация">
      {navigation.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`main-nav__link ${isActive ? 'main-nav__link--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
