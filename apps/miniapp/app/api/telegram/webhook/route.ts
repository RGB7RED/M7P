import { NextResponse } from 'next/server';
import { normalizeTelegramUsername } from '../../../../lib/auth';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export async function POST(req: Request) {
  try {
    const update = await req.json();
    const message = update?.message;
    const from = message?.from;
    const chat = message?.chat;

    const username: string | undefined = from?.username;
    const chatId: number | undefined = chat?.id;

    if (!username || chatId === undefined || chatId === null) {
      console.warn('Telegram webhook: пропущен апдейт без username или chat.id', update);
      return NextResponse.json({ ok: true });
    }

    const normalizedUsername = normalizeTelegramUsername(username);
    const supabase = getServiceSupabaseClient();

    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_username', normalizedUsername)
      .maybeSingle();

    if (lookupError) {
      console.error('Telegram webhook: ошибка при поиске пользователя', lookupError);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    if (existingUser) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ telegram_chat_id: chatId })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Telegram webhook: ошибка при обновлении chat_id', updateError);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    } else {
      const { error: insertError } = await supabase.from('users').insert({
        telegram_username: normalizedUsername,
        telegram_chat_id: chatId,
        m7_nickname: normalizedUsername,
        status: 'active',
      });

      if (insertError) {
        console.error('Telegram webhook: ошибка при создании пользователя с chat_id', insertError);
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    }

    // TODO: добавить проверку X-Telegram-Bot-Api-Secret-Token при настройке webhook

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook: ошибка при сохранении chat_id', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true }, { status: 405 });
}
