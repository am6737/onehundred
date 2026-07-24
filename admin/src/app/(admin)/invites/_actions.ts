'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export async function deactivateToken(tokenId: string) {
  const adminId = await getAdminId()

  const { error } = await supabaseAdmin
    .from('invite_tokens')
    .update({ is_active: false })
    .eq('id', tokenId)

  if (error) throw new Error(error.message)

  await logAuditEvent(adminId, 'deactivate_invite_token', 'invite_token', tokenId)
  revalidatePath('/invites')
  revalidatePath(`/invites/${tokenId}`)
}
