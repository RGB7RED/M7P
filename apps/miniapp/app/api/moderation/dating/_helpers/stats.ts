import { SupabaseClient } from '@supabase/supabase-js';

import { getServiceSupabaseClient } from '../../../../../lib/supabaseConfig';

export type DatingModerationStats = {
  activeProfiles: number;
  bannedProfiles: number;
  newReports: number;
  reports24h: number;
  reports7d: number;
};

export async function getDatingModerationStats(client?: SupabaseClient): Promise<DatingModerationStats> {
  const supabase = client ?? getServiceSupabaseClient();

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const activeProfilesPromise = supabase
      .from('dating_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_active', true);

    const bannedProfilesPromise = supabase
      .from('dating_profiles')
      .select('id, users!inner(status)', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('is_active', true)
      .eq('users.status', 'banned');

    const newReportsPromise = supabase
      .from('dating_reports')
      .select('id', { count: 'exact', head: true })
      .in('status', ['new', 'pending']);

    const reports24hPromise = supabase
      .from('dating_reports')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayAgo);

    const reports7dPromise = supabase
      .from('dating_reports')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo);

    const [activeProfiles, bannedProfiles, newReports, reports24h, reports7d] = await Promise.all([
      activeProfilesPromise,
      bannedProfilesPromise,
      newReportsPromise,
      reports24hPromise,
      reports7dPromise,
    ]);

    return {
      activeProfiles: activeProfiles.count ?? 0,
      bannedProfiles: bannedProfiles.count ?? 0,
      newReports: newReports.count ?? 0,
      reports24h: reports24h.count ?? 0,
      reports7d: reports7d.count ?? 0,
    };
  } catch (error) {
    console.error('[moderation][dating] failed to fetch stats', error);
    throw new Error('STATS_LOOKUP_FAILED');
  }
}
