import { SupabaseClient } from '@supabase/supabase-js';

import { DatingReportReason } from '../../../dating/_helpers/reports';
import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';

export type ModerationReportStatus = 'new' | 'resolved' | 'all';

export type ModerationReportFilters = {
  status?: ModerationReportStatus;
  reason?: DatingReportReason | '';
  targetQuery?: string;
  limit?: number;
};

export type ModerationReportItem = {
  id: string;
  reason: DatingReportReason;
  comment: string | null;
  created_at: string;
  status: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  moderator_note: string | null;
  reporter: {
    id: string;
    telegram_username: string;
  } | null;
  target: {
    id: string;
    telegram_username: string;
    status: string;
    isBanned: boolean;
    totalReports: number;
  } | null;
};

async function resolveTargetUserIds(search: string, client: SupabaseClient): Promise<string[]> {
  const query = search.trim();
  if (!query) return [];

  const normalized = query.replace(/^@/, '');
  const result = new Set<string>();
  const looksLikeUuid = /^[0-9a-fA-F-]{32,36}$/.test(normalized);
  if (looksLikeUuid) {
    result.add(normalized);
  }

  const { data, error } = await client
    .from('users')
    .select('id')
    .ilike('telegram_username', `%${normalized}%`)
    .limit(20);

  if (error) {
    console.error('[moderation][dating] failed to search users by username', { query: normalized, error });
    throw new Error('USER_SEARCH_FAILED');
  }

  (data ?? []).forEach((row) => {
    if (row.id) {
      result.add(row.id);
    }
  });

  return Array.from(result);
}

async function getReasonOptions(client: SupabaseClient): Promise<DatingReportReason[]> {
  const { data, error } = await client.from('dating_reports').select('reason').limit(200);
  if (error) {
    console.error('[moderation][dating] failed to fetch reason options', error);
    throw new Error('REASONS_LOOKUP_FAILED');
  }

  const reasons = new Set<DatingReportReason>();
  (data ?? []).forEach((row) => {
    if (row.reason) {
      reasons.add(row.reason as DatingReportReason);
    }
  });

  return Array.from(reasons).sort();
}

export async function fetchModerationReports(
  filters: ModerationReportFilters,
  client?: SupabaseClient,
): Promise<{ items: ModerationReportItem[]; reasons: DatingReportReason[] }> {
  const supabase = client ?? getServiceSupabaseClient();
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);

  const reasonsPromise = getReasonOptions(supabase);

  let targetUserIds: string[] | undefined;
  if (filters.targetQuery) {
    const ids = await resolveTargetUserIds(filters.targetQuery, supabase);
    targetUserIds = ids;
  }

  let query = supabase
    .from('dating_reports')
    .select(
      `id, reported_user_id, reporter_user_id, reason, comment, created_at, status, resolved_at, resolved_by_user_id, moderator_note,
      reported_user:users!dating_reports_reported_user_id_fkey(id, telegram_username, status),
      reporter:users!dating_reports_reporter_user_id_fkey(id, telegram_username)`,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (filters.status === 'resolved') {
    query = query.eq('status', 'resolved');
  } else if (filters.status === 'new') {
    query = query.in('status', ['new', 'pending']);
  }

  if (filters.reason) {
    query = query.eq('reason', filters.reason);
  }

  if (filters.targetQuery) {
    if (!targetUserIds?.length) {
      const reasons = await reasonsPromise;
      return { items: [], reasons };
    }
    query = query.in('reported_user_id', targetUserIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[moderation][dating] failed to load reports', error);
    throw new Error('REPORTS_LOOKUP_FAILED');
  }

  const reportRows = data ?? [];
  const reportedUserIds = Array.from(new Set(reportRows.map((item) => item.reported_user_id).filter(Boolean)));

  const counts = new Map<string, number>();
  if (reportedUserIds.length) {
    const { data: countRows, error: countError } = await supabase
      .from('dating_reports')
      .select('reported_user_id')
      .in('reported_user_id', reportedUserIds);

    if (countError) {
      console.error('[moderation][dating] failed to count reports per user', countError);
      throw new Error('REPORTS_COUNT_FAILED');
    }

    (countRows ?? []).forEach((row) => {
      if (!row.reported_user_id) return;
      counts.set(row.reported_user_id, (counts.get(row.reported_user_id) ?? 0) + 1);
    });
  }

  const items: ModerationReportItem[] = reportRows.map((row) => ({
    id: row.id,
    reason: row.reason as DatingReportReason,
    comment: row.comment ?? null,
    created_at: row.created_at,
    status: row.status,
    resolved_at: row.resolved_at ?? null,
    resolved_by_user_id: row.resolved_by_user_id ?? null,
    moderator_note: row.moderator_note ?? null,
    reporter: row.reporter
      ? {
          id: row.reporter.id,
          telegram_username: row.reporter.telegram_username,
        }
      : null,
    target: row.reported_user
      ? {
          id: row.reported_user.id,
          telegram_username: row.reported_user.telegram_username,
          status: row.reported_user.status,
          isBanned: row.reported_user.status === 'banned',
          totalReports: counts.get(row.reported_user.id) ?? 0,
        }
      : null,
  }));

  const reasons = await reasonsPromise;
  return { items, reasons };
}
