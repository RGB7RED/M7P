import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { isModeratorUser } from '../../../../lib/moderators';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { DatingReportReason } from '../../dating/_helpers/reports';
import { fetchModerationReports, ModerationReportFilters } from './_helpers/reports';
import { getDatingModerationStats } from './_helpers/stats';

export const dynamic = 'force-dynamic';

type ActionBody = {
  action?: 'resolveReport' | 'banUser' | 'unbanUser';
  reportId?: string;
  targetUserId?: string;
  moderatorNote?: string;
};

async function assertModerator() {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isModeratorUser(currentUser)) {
    return { error: NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 }) };
  }

  return { currentUser };
}

export async function GET(req: Request) {
  const moderator = await assertModerator();
  if ('error' in moderator) return moderator.error;

  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');
    const reasonParam = url.searchParams.get('reason') as DatingReportReason | null;
    const target = url.searchParams.get('target') ?? undefined;
    const limitRaw = Number(url.searchParams.get('limit'));

    const filters: ModerationReportFilters = {
      status: statusParam === 'new' || statusParam === 'resolved' ? statusParam : undefined,
      reason: reasonParam ?? undefined,
      targetQuery: target,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    };

    const supabase = getServiceSupabaseClient();
    const [reportsResult, stats] = await Promise.all([
      fetchModerationReports(filters, supabase),
      getDatingModerationStats(supabase),
    ]);

    return NextResponse.json({ ok: true, reports: reportsResult.items, reasons: reportsResult.reasons, stats });
  } catch (error) {
    console.error('[moderation/dating][GET] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const moderator = await assertModerator();
  if ('error' in moderator) return moderator.error;

  const { currentUser } = moderator;
  const supabase = getServiceSupabaseClient();

  try {
    const body = (await req.json()) as ActionBody;
    const action = body.action;
    const reportId = body.reportId?.trim();
    const targetUserId = body.targetUserId?.trim();
    const moderatorNote = body.moderatorNote?.trim() || null;

    if (!action) {
      return NextResponse.json({ ok: false, error: 'INVALID_ACTION' }, { status: 400 });
    }

    if (action === 'resolveReport') {
      if (!reportId) {
        return NextResponse.json({ ok: false, error: 'REPORT_ID_REQUIRED' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('dating_reports')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: currentUser.userId,
          moderator_note: moderatorNote,
        })
        .eq('id', reportId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/dating][POST] failed to resolve report', error);
        return NextResponse.json({ ok: false, error: 'RESOLVE_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'REPORT_NOT_FOUND' }, { status: 404 });
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'banUser') {
      if (!targetUserId) {
        return NextResponse.json({ ok: false, error: 'TARGET_USER_REQUIRED' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('users')
        .update({ status: 'banned' })
        .eq('id', targetUserId)
        .select('id')
        .maybeSingle();

      if (error) {
        console.error('[moderation/dating][POST] failed to ban user', error);
        return NextResponse.json({ ok: false, error: 'BAN_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        await supabase
          .from('dating_reports')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by_user_id: currentUser.userId,
            moderator_note: moderatorNote ?? 'Пользователь забанен вручную.',
          })
          .eq('id', reportId);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === 'unbanUser') {
      if (!targetUserId) {
        return NextResponse.json({ ok: false, error: 'TARGET_USER_REQUIRED' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('users')
        .update({ status: 'active' })
        .eq('id', targetUserId)
        .select('id, status')
        .maybeSingle();

      if (error) {
        console.error('[moderation/dating][POST] failed to unban user', error);
        return NextResponse.json({ ok: false, error: 'UNBAN_FAILED' }, { status: 500 });
      }

      if (!data) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
      }

      if (reportId) {
        await supabase
          .from('dating_reports')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by_user_id: currentUser.userId,
            moderator_note: moderatorNote ?? 'Бан снят вручную.',
          })
          .eq('id', reportId);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch (error) {
    console.error('[moderation/dating][POST] unexpected error', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
