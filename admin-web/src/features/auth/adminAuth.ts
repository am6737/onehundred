import type { Session } from '@supabase/supabase-js';
import { AdminDataError } from '@/lib/admin/errors';
import { getAdminSupabaseClient } from '@/lib/admin/supabase';
import type { AdminRole, AdminSession, Database } from '@/lib/admin/types';

const allowedRoles = new Set<AdminRole>([
  'super_admin',
  'admin',
  'operator',
  'support',
  'content_editor',
  'content_reviewer',
  'family_support',
  'system_admin',
]);

async function signOutBlockedSession() {
  await getAdminSupabaseClient()
    .auth.signOut()
    .catch(() => undefined);
}

export async function resolveAdminSession(session: Session | null): Promise<AdminSession | null> {
  if (!session?.user) return null;

  const supabase = getAdminSupabaseClient();
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error) {
    await signOutBlockedSession();
    throw new AdminDataError(`Load admin profile: ${error.message}`, error.code, error);
  }

  const role = profile.admin_role;
  if (!role || !allowedRoles.has(role)) {
    await signOutBlockedSession();
    throw new AdminDataError('Signed-in user does not have profiles.admin_role for admin access.', 'not_admin');
  }

  return {
    user: session.user,
    role,
    profile: profile as Database['public']['Tables']['profiles']['Row'],
  };
}

export async function signInAdminWithPassword(email: string, password: string): Promise<AdminSession> {
  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AdminDataError(`Admin sign in failed: ${error.message}`, error.name, error);
  try {
    const adminSession = await resolveAdminSession(data.session);
    if (!adminSession) throw new AdminDataError('Admin sign in did not return a session.', 'no_session');
    return adminSession;
  } catch (adminError) {
    await supabase.auth.signOut().catch(() => undefined);
    throw adminError;
  }
}

export async function restoreAdminSession(): Promise<AdminSession | null> {
  const supabase = getAdminSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) throw new AdminDataError(`Restore admin session failed: ${error.message}`, error.name, error);
  if (!session) return null;

  const { error: userError } = await supabase.auth.getUser();
  if (userError) {
    const status = (userError as { status?: number }).status;
    if (status === 401 || status === 403) {
      await supabase.auth.signOut().catch(() => undefined);
      throw new AdminDataError(
        `Validate admin session failed: Supabase rejected the restored session (${status}). Sign in again with an admin account.`,
        'not_authenticated',
        userError,
      );
    }
    throw new AdminDataError(`Validate admin session failed: ${userError.message}`, userError.name, userError);
  }

  return resolveAdminSession(session);
}

export async function signOutAdmin() {
  const supabase = getAdminSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw new AdminDataError(`Admin sign out failed: ${error.message}`, error.name, error);
}
