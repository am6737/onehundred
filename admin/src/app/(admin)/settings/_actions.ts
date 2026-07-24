'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

// ─── App Config ───────────────────────────────────────────────────────────────

export async function updateConfig(key: string, value: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('app_config')
    .update({ value, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_config', 'app_config', key, { value: key === 'notify_secret' ? '[REDACTED]' : value })
  revalidatePath('/settings/config')
}

export async function createConfig(key: string, value: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('app_config')
    .insert({ key, value })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'create_config', 'app_config', key, { value: key === 'notify_secret' ? '[REDACTED]' : value })
  revalidatePath('/settings/config')
}

export async function deleteConfig(key: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('app_config')
    .delete()
    .eq('key', key)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'delete_config', 'app_config', key)
  revalidatePath('/settings/config')
}

// ─── Feature Flags ────────────────────────────────────────────────────────────

export async function updateFlag(key: string, enabled: boolean) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('feature_flags')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('key', key)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_feature_flag', 'feature_flag', key, { enabled })
  revalidatePath('/settings/flags')
}

export async function createFlag(key: string, description: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('feature_flags')
    .insert({ key, description, enabled: true })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'create_feature_flag', 'feature_flag', key, { description })
  revalidatePath('/settings/flags')
}

export async function deleteFlag(key: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('feature_flags')
    .delete()
    .eq('key', key)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'delete_feature_flag', 'feature_flag', key)
  revalidatePath('/settings/flags')
}

// ─── Admin Role ───────────────────────────────────────────────────────────────

export async function updateAdminRole(userId: string, role: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ admin_role: role })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_admin_role', 'profile', userId, { role })
  revalidatePath('/settings/system')
}

export async function removeAdminRole(userId: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ admin_role: null })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'remove_admin_role', 'profile', userId)
  revalidatePath('/settings/system')
}

export async function grantAdminRole(userId: string, role: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ admin_role: role })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'grant_admin_role', 'profile', userId, { role })
  revalidatePath('/settings/system')
}

export async function searchUserByPhone(phone: string) {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 })
  const users = (data?.users ?? []).filter((u) => u.phone === phone || u.email === phone)
  if (!users.length) return null
  const u = users[0]
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, username, admin_role')
    .eq('id', u.id)
    .maybeSingle()
  return { id: u.id, phone: u.phone ?? null, email: u.email ?? null, username: profile?.username ?? null, admin_role: profile?.admin_role ?? null }
}
