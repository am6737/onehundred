'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export async function banUser(userId: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: '876000h',
  })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'ban_user', 'user', userId)
  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
}

export async function unbanUser(userId: string) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'unban_user', 'user', userId)
  revalidatePath('/users')
  revalidatePath(`/users/${userId}`)
}
