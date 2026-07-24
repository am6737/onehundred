'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export async function updateKid(
  kidId: string,
  name: string,
  birthYear: number,
  birthMonth: number,
) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('kids')
    .update({ name, birth_year: birthYear, birth_month: birthMonth })
    .eq('id', kidId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_kid', 'kid', kidId, {
    name,
    birth_year: birthYear,
    birth_month: birthMonth,
  })
  revalidatePath(`/kids/${kidId}`)
  revalidatePath('/kids')
}
