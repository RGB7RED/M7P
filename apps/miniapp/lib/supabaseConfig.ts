export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

export function assertSupabaseEnv(): void {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.warn('Supabase env vars отсутствуют: NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
}
