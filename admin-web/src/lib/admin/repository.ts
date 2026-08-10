import { AdminDataError } from './errors';
import { getAdminSupabaseClient, getSupabaseConfigStatus } from './supabase';
import { SupabaseAdminRepository } from './supabaseRepository';
import type { AdminRepository } from './types';

export async function createAdminRepository(): Promise<AdminRepository> {
  const config = getSupabaseConfigStatus();
  if (!config.configured) {
    throw new AdminDataError(config.reason, 'missing_supabase_config');
  }

  const client = getAdminSupabaseClient();
  const { error } = await client.auth.getSession();
  if (error) {
    throw new AdminDataError(`Supabase client could not restore an admin session: ${error.message}`, error.name, error);
  }
  return new SupabaseAdminRepository(client);
}

export function createLiveAdminRepository(): AdminRepository {
  const config = getSupabaseConfigStatus();
  if (!config.configured) {
    throw new AdminDataError(config.reason, 'missing_supabase_config');
  }
  return new SupabaseAdminRepository(getAdminSupabaseClient());
}
