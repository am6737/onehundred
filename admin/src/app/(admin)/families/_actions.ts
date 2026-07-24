'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)]
  return c
}

export async function removeMember(familyId: string, userId: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'remove_member', 'family', familyId, { userId })
  revalidatePath(`/families/${familyId}`)
}

export async function transferCreator(familyId: string, newCreatorId: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('families')
    .update({ created_by: newCreatorId })
    .eq('id', familyId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'transfer_creator', 'family', familyId, { newCreatorId })
  revalidatePath(`/families/${familyId}`)
}

export async function regenerateInviteCode(familyId: string) {
  const adminId = await getAdminId()
  let code = genCode()
  for (let i = 0; i < 9; i++) {
    const { data } = await supabaseAdmin
      .from('families')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()
    if (!data) break
    code = genCode()
  }
  const { error } = await supabaseAdmin
    .from('families')
    .update({ invite_code: code })
    .eq('id', familyId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'regenerate_invite_code', 'family', familyId, { newCode: code })
  revalidatePath(`/families/${familyId}`)
}
