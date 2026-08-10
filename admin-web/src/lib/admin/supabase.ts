import { createClient } from '@supabase/supabase-js';
import type { AdminSupabaseClient } from './types';
import { AdminDataError } from './errors';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export function getSupabaseConfigStatus() {
  if (supabaseUrl && supabaseAnonKey) return { configured: true as const };
  return {
    configured: false as const,
    reason: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Live admin repository cannot be created.',
  };
}

let browserSupabaseClient: AdminSupabaseClient | null = null;

export function getAdminSupabaseClient(): AdminSupabaseClient {
  if (!hasSupabaseConfig()) {
    throw new AdminDataError(
      'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Use admin-web/.env.local for live data.',
      'missing_supabase_config',
    );
  }
  browserSupabaseClient ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
  return browserSupabaseClient;
}
