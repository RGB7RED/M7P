import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthForm } from '../components/AuthForm';
import { getCurrentUser } from '../lib/currentUser';
import { MainNavigation } from '../components/MainNavigation';

export const metadata: Metadata = {
  title: 'М7 платформа — мини-приложение',
  description: 'Маркетплейс внутри Telegram Mini App: знакомства, маркет, жильё и работа.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="ru">
      <body>
        <header className="header">
          <div className="header-start">
            <div className="logo">М7 платформа</div>
            <MainNavigation />
          </div>
          <span className="subtitle">{currentUser ? `@${currentUser.telegram_username}` : 'Mini App'}</span>
        </header>
        <main>{currentUser ? children : <AuthForm />}</main>
      </body>
    </html>
  );
}
