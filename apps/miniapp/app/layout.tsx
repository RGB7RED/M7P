import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AuthForm } from '../components/AuthForm';
import { getCurrentUser } from '../lib/currentUser';

export const metadata: Metadata = {
  title: 'М7 платформа — мини-приложение',
  description: 'Маркетплейс внутри Telegram Mini App: знакомства, маркет, жильё и работа.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <html lang="ru">
      <body className="miniapp-body">
        <main className="miniapp-root">
          {currentUser ? children : <div className="m7-miniapp-root"><AuthForm /></div>}
        </main>
      </body>
    </html>
  );
}
