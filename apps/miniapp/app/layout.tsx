import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { MainTabs } from '../components/MainTabs';

export const metadata: Metadata = {
  title: 'М7 платформа — мини-приложение',
  description: 'Маркетплейс внутри Telegram Mini App: знакомства, маркет, жильё и работа.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <header className="header">
          <div>
            <div className="logo">М7 платформа</div>
            <div className="subtitle">Знакомства · Маркет · Жильё · Работа</div>
          </div>
          <span className="subtitle">Mini App</span>
        </header>
        <main>{children}</main>
        <MainTabs />
      </body>
    </html>
  );
}
