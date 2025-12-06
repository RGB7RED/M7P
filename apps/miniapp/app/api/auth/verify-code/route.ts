import { NextResponse } from 'next/server';
import {
  createSessionToken,
  isValidTelegramUsername,
  normalizeTelegramUsername,
} from '../../../../lib/auth';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

const SESSION_COOKIE_NAME = 'm7_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const normalizedUsername = normalizeTelegramUsername(body?.telegram_username);
    const code = String(body?.code || '').trim();

    if (!normalizedUsername || !isValidTelegramUsername(normalizedUsername)) {
      return NextResponse.json({ ok: false, error: 'INVALID_USERNAME' }, { status: 400 });
    }

    if (!code || code.length < 4 || code.length > 12) {
      return NextResponse.json({ ok: false, error: 'INVALID_CODE' }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();

    const { data: authCode, error: lookupError } = await supabase
      .from('auth_codes')
      .select('*')
      .eq('telegram_username', normalizedUsername)
      .eq('code', code)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError || !authCode) {
      return NextResponse.json({ ok: false, error: 'INVALID_OR_EXPIRED_CODE' }, { status: 400 });
    }

    await supabase
      .from('auth_codes')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('id', authCode.id);

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, telegram_username, m7_nickname')
      .eq('telegram_username', normalizedUsername)
      .maybeSingle();

    const user =
      existingUser ||
      (await supabase
        .from('users')
        .insert({ telegram_username: normalizedUsername, m7_nickname: normalizedUsername, status: 'active' })
        .select('id, telegram_username, m7_nickname')
        .single()).data;

    if (!user) {
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    const { token, exp } = await createSessionToken({ user_id: user.id, telegram_username: user.telegram_username });

    const response = NextResponse.json({ ok: true, user });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(exp * 1000),
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });

    return response;
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
