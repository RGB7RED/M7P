import { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export type DatingReportReason = 'escort' | 'scam' | 'drugs' | 'weapons' | 'inappropriate' | 'other';

type CreateReportParams = {
  reportedUserId: string;
  reporterUserId: string;
  reason: DatingReportReason;
  comment?: string;
};

type CreateReportResult = {
  totalReports: number;
  banned: boolean;
};

export async function isUserBanned(userId: string, client?: SupabaseClient): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('users')
    .select('status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[dating/reports] failed to check user status', { userId, error });
    throw new Error('STATUS_LOOKUP_FAILED');
  }

  return data?.status === 'banned';
}

export async function createDatingReport(
  params: CreateReportParams,
  client?: SupabaseClient,
): Promise<CreateReportResult> {
  const supabase = client ?? getServiceSupabaseClient();
  const { reportedUserId, reporterUserId, reason, comment } = params;

  const { error: insertError } = await supabase.from('dating_reports').insert({
    reported_user_id: reportedUserId,
    reporter_user_id: reporterUserId,
    reason,
    comment,
  });

  if (insertError) {
    console.error('[dating/reports] failed to create report', { reportedUserId, reporterUserId, insertError });
    throw new Error('REPORT_CREATION_FAILED');
  }

  const { count, error: countError } = await supabase
    .from('dating_reports')
    .select('id', { count: 'exact', head: true })
    .eq('reported_user_id', reportedUserId);

  if (countError) {
    console.error('[dating/reports] failed to count reports', { reportedUserId, countError });
    throw new Error('REPORT_COUNT_FAILED');
  }

  let banned = false;

  if ((count ?? 0) >= 3) {
    const { data: banResult, error: banError } = await supabase
      .from('users')
      .update({ status: 'banned' })
      .eq('id', reportedUserId)
      .neq('status', 'banned')
      .select('id')
      .maybeSingle();

    if (banError) {
      console.error('[dating/reports] failed to ban user after reports', { reportedUserId, banError });
      throw new Error('USER_BAN_FAILED');
    }

    banned = Boolean(banResult);
  }

  return { totalReports: count ?? 0, banned };
}
