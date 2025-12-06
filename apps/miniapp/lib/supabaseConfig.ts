import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE || '',
};

export function assertSupabaseEnv(): void {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.warn('Supabase env vars отсутствуют: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  if (!supabaseConfig.serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE отсутствует — API маршруты авторизации не смогут обращаться к БД.');
  }
}

export function getServiceSupabaseClient(): SupabaseClient {
  if (!supabaseConfig.url || !supabaseConfig.serviceRoleKey) {
    throw new Error('Supabase service client is not configured');
  }

  return createClient(supabaseConfig.url, supabaseConfig.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
