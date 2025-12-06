import { NextResponse } from 'next/server';
import { generateOneTimeCode, isDevEnv, isValidTelegramUsername, normalizeTelegramUsername } from '../../../../lib/auth';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

const CODE_TTL_MINUTES = 10;

async function sendTelegramCode(username: string, code: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { delivery: 'mock' as const };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: `@${username}`,
        text: `Ваш код авторизации для М7: ${code}. Никому его не сообщайте.`,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      console.warn('Не удалось отправить код в Telegram', payload);
      return { delivery: 'mock' as const };
    }

    return { delivery: 'telegram' as const };
  } catch (error) {
    console.error('Ошибка отправки в Telegram', error);
    return { delivery: 'mock' as const };
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const normalizedUsername = normalizeTelegramUsername(body?.telegram_username);

    if (!normalizedUsername || !isValidTelegramUsername(normalizedUsername)) {
      return NextResponse.json({ ok: false, error: 'INVALID_USERNAME' }, { status: 400 });
    }

    const code = generateOneTimeCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

    const supabase = getServiceSupabaseClient();

    const { error: userError } = await supabase
      .from('users')
      .upsert({ telegram_username: normalizedUsername, m7_nickname: normalizedUsername, status: 'active' }, {
        onConflict: 'telegram_username',
        ignoreDuplicates: false,
      });

    if (userError) {
      console.error('Не удалось создать пользователя перед выдачей кода', userError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    await supabase
      .from('auth_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('telegram_username', normalizedUsername)
      .eq('is_used', false);

    const { error: insertError } = await supabase.from('auth_codes').insert({
      telegram_username: normalizedUsername,
      code,
      expires_at: expiresAt,
      is_used: false,
    });

    if (insertError) {
      console.error('Не удалось сохранить код', insertError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const telegramResult = await sendTelegramCode(normalizedUsername, code);

    return NextResponse.json({
      ok: true,
      delivery: telegramResult.delivery,
      normalized_username: normalizedUsername,
      dev_code: isDevEnv ? code : undefined,
    });
  } catch (error) {
    console.error('[API ERROR]', error);

    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
        ? error
        : JSON.stringify(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
