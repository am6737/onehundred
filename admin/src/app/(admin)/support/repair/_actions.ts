'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

// ─── Tool 1: 孤立 kid_id 的 memories ─────────────────────────────────────────

export interface OrphanedKidRow {
  id: string
  title: string
  kid_id: string
  family_id: string
  created_at: string
}

export interface AvailableKid {
  id: string
  name: string
  family_id: string
}

export interface ScanOrphanedKidResult {
  orphaned: OrphanedKidRow[]
  availableKids: AvailableKid[]
}

export async function scanOrphanedKidIds(): Promise<ScanOrphanedKidResult> {
  const { data: kids } = await supabaseAdmin.from('kids').select('id, name, family_id')
  const validIds = new Set(((kids ?? []) as AvailableKid[]).map((k) => k.id))

  const { data: memories, error } = await supabaseAdmin
    .from('memories')
    .select('id, title, kid_id, family_id, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) throw new Error(error.message)

  const orphaned = ((memories ?? []) as OrphanedKidRow[]).filter((m) => !validIds.has(m.kid_id))
  return { orphaned, availableKids: (kids ?? []) as AvailableKid[] }
}

export async function fixOrphanedKidId(memoryId: string, newKidId: string): Promise<void> {
  const adminId = await getAdminId()
  const { data: before } = await supabaseAdmin
    .from('memories')
    .select('kid_id')
    .eq('id', memoryId)
    .maybeSingle()
  const { error } = await supabaseAdmin
    .from('memories')
    .update({ kid_id: newKidId })
    .eq('id', memoryId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'repair_orphaned_kid_id', 'memory', memoryId, {
    oldKidId: (before as { kid_id: string } | null)?.kid_id,
    newKidId,
  })
}

// ─── Tool 2: user_id 为 NULL 的 memories ──────────────────────────────────────

export interface NullUserMemoryRow {
  id: string
  title: string
  kid_id: string
  family_id: string
  created_at: string
}

export interface FamilyMemberOption {
  family_id: string
  user_id: string
  role: string
  custom_role: string
  username: string | null
}

export interface ScanNullUserIdResult {
  nullMemories: NullUserMemoryRow[]
  familyMembers: FamilyMemberOption[]
}

export async function scanNullUserIdMemories(): Promise<ScanNullUserIdResult> {
  const { data: nullMemories, error } = await supabaseAdmin
    .from('memories')
    .select('id, title, kid_id, family_id, created_at')
    .is('user_id', null)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)

  const memories = (nullMemories ?? []) as NullUserMemoryRow[]
  if (memories.length === 0) return { nullMemories: [], familyMembers: [] }

  const familyIds = [...new Set(memories.map((m) => m.family_id))]

  const { data: members } = await supabaseAdmin
    .from('family_members')
    .select('family_id, user_id, role, custom_role')
    .in('family_id', familyIds)

  const typedMembers = (members ?? []) as Omit<FamilyMemberOption, 'username'>[]
  const userIds = typedMembers.map((m) => m.user_id)

  let profileMap = new Map<string, string | null>()
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username')
      .in('id', userIds)
    profileMap = new Map(
      ((profiles ?? []) as { id: string; username: string | null }[]).map((p) => [p.id, p.username])
    )
  }

  const familyMembers: FamilyMemberOption[] = typedMembers.map((m) => ({
    ...m,
    username: profileMap.get(m.user_id) ?? null,
  }))

  return { nullMemories: memories, familyMembers }
}

export async function fixNullUserId(memoryId: string, userId: string): Promise<void> {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('memories')
    .update({ user_id: userId })
    .eq('id', memoryId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'repair_null_user_id', 'memory', memoryId, { newUserId: userId })
}

// ─── Tool 3: 孤立吉祥物 ───────────────────────────────────────────────────────

export interface OrphanedMascotRow {
  kid_id: string
  family_id: string
  name: string
  species: string
}

export interface ScanOrphanedMascotsResult {
  orphaned: OrphanedMascotRow[]
}

export async function scanOrphanedMascots(): Promise<ScanOrphanedMascotsResult> {
  const { data: kids } = await supabaseAdmin.from('kids').select('id')
  const validIds = new Set(((kids ?? []) as { id: string }[]).map((k) => k.id))

  const { data: mascots, error } = await supabaseAdmin
    .from('mascots')
    .select('kid_id, family_id, name, species')

  if (error) throw new Error(error.message)

  const orphaned = ((mascots ?? []) as OrphanedMascotRow[]).filter((m) => !validIds.has(m.kid_id))
  return { orphaned }
}

export async function deleteOrphanedMascots(kidIds: string[]): Promise<number> {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin.from('mascots').delete().in('kid_id', kidIds)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'delete_orphaned_mascots', 'mascot', 'bulk', { kidIds })
  return kidIds.length
}

// ─── Tool 4: 过期邀记令牌 ─────────────────────────────────────────────────────

export interface ExpiredTokenRow {
  id: string
  family_id: string
  created_by: string
  kid_name: string | null
  level_title: string
  expires_at: string
  created_at: string
}

export interface ScanExpiredTokensResult {
  expired: ExpiredTokenRow[]
}

export async function scanExpiredActiveTokens(): Promise<ScanExpiredTokensResult> {
  const { data: expired, error } = await supabaseAdmin
    .from('invite_tokens')
    .select('id, family_id, created_by, kid_name, level_title, expires_at, created_at')
    .lt('expires_at', new Date().toISOString())
    .eq('is_active', true)
    .order('expires_at', { ascending: true })
    .limit(200)

  if (error) throw new Error(error.message)
  return { expired: (expired ?? []) as ExpiredTokenRow[] }
}

export async function deactivateExpiredTokensBulk(tokenIds: string[]): Promise<number> {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('invite_tokens')
    .update({ is_active: false })
    .in('id', tokenIds)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'deactivate_expired_tokens_bulk', 'invite_token', 'bulk', {
    tokenIds,
    count: tokenIds.length,
  })
  return tokenIds.length
}

// ─── Tool 5: 重复手机号账号 ───────────────────────────────────────────────────

export interface DuplicateUserEntry {
  id: string
  created_at: string
  is_anonymous: boolean
  email: string | null
}

export interface DuplicatePhoneGroup {
  phone: string
  users: DuplicateUserEntry[]
}

export interface ScanDuplicateAccountsResult {
  groups: DuplicatePhoneGroup[]
}

export async function scanDuplicatePhoneAccounts(): Promise<ScanDuplicateAccountsResult> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const users = data?.users ?? []

  const byPhone = new Map<string, DuplicateUserEntry[]>()
  for (const u of users) {
    if (!u.phone) continue
    if (!byPhone.has(u.phone)) byPhone.set(u.phone, [])
    byPhone.get(u.phone)!.push({
      id: u.id,
      created_at: u.created_at,
      is_anonymous: u.is_anonymous ?? false,
      email: u.email ?? null,
    })
  }

  const groups = [...byPhone.entries()]
    .filter(([, us]) => us.length > 1)
    .map(([phone, us]) => ({ phone, users: us }))

  return { groups }
}
