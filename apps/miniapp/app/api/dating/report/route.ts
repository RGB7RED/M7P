import { NextResponse } from 'next/server';

import { getCurrentUser } from '../../../../lib/currentUser';
import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';
import { createDatingReport, DatingReportReason } from '../_helpers/reports';

export const dynamic = 'force-dynamic';

type ReportBody = {
  targetUserId?: string;
  reason?: DatingReportReason;
  comment?: string;
};

const ALLOWED_REASONS: DatingReportReason[] = [
  'escort',
  'scam',
  'drugs',
  'weapons',
  'inappropriate',
  'other',
];

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = (await req.json()) as ReportBody;
    const targetUserId = String(body?.targetUserId ?? '').trim();
    const reason = body?.reason;
    const comment = body?.comment ? String(body.comment).trim() : undefined;

    if (!targetUserId || !reason || !ALLOWED_REASONS.includes(reason)) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT' }, { status: 400 });
    }

    if (targetUserId === currentUser.userId) {
      return NextResponse.json({ ok: false, error: 'CANNOT_REPORT_SELF' }, { status: 400 });
    }

    const supabase = getServiceSupabaseClient();

    const { data: existingReport, error: existingReportError } = await supabase
      .from('dating_reports')
      .select('id')
      .eq('reported_user_id', targetUserId)
      .eq('reporter_user_id', currentUser.userId)
      .maybeSingle();

    if (existingReportError) {
      console.error('[dating/report] duplicate check error', existingReportError);
      return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
    }

    if (existingReport) {
      return NextResponse.json({ ok: false, error: 'ALREADY_REPORTED' }, { status: 400 });
    }

    const result = await createDatingReport(
      {
        reportedUserId: targetUserId,
        reporterUserId: currentUser.userId,
        reason,
        comment,
      },
      supabase,
    );

    return NextResponse.json({
      ok: true,
      bannedAfterThisReport: result.banned,
      totalReportsForUser: result.totalReports,
    });
  } catch (error) {
    console.error('[dating/report] unexpected error', error);
    const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
