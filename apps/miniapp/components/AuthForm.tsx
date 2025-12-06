'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

export function AuthForm() {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'username' | 'code'>('username');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRequestCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await fetch('/api/auth/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_username: username }),
    });

    const data = await response.json();

    if (!data?.ok) {
      setError('Некорректный username. Проверьте формат @username.');
      return;
    }

    setMessage(
      data.delivery === 'telegram'
        ? 'Код отправлен в Telegram — проверьте сообщения от бота.'
        : 'Код отображается здесь. Если вы не получили сообщение от бота, напишите /start боту в Telegram и запросите код ещё раз.'
    );

    if (data.dev_code) {
      setCode(data.dev_code);
    }

    setUsername(data.normalized_username ?? username);
    setStep('code');
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_username: username, code }),
    });

    const data = await response.json();

    if (!data?.ok) {
      setError('Неверный или просроченный код. Попробуйте снова.');
      return;
    }

    setMessage('Готово! Обновляем интерфейс...');
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="card auth-card">
      <h1 className="hero-title">Вход в М7 платформу</h1>
      <p className="hero-text">Авторизация через Telegram @username и одноразовый код.</p>

      <form className="auth-form" onSubmit={step === 'username' ? handleRequestCode : handleVerifyCode}>
        <label className="input-label" htmlFor="username">
          Telegram @username
        </label>
        <input
          id="username"
          name="username"
          type="text"
          placeholder="@nickname"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="input"
          disabled={step === 'code'}
          required
          minLength={5}
          maxLength={32}
        />

        {step === 'code' && (
          <>
            <label className="input-label" htmlFor="code">
              Код из Telegram
            </label>
            <input
              id="code"
              name="code"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
              required
            />
          </>
        )}

        {message && <div className="hint success">{message}</div>}
        {error && <div className="hint error">{error}</div>}

        <button className="primary-btn" type="submit" disabled={isPending}>
          {step === 'username' ? 'Отправить код' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
