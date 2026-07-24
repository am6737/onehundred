'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export type WardrobeInput = {
  name: string
  slot: string
  at: number
  line: string
}

export async function updateWardrobe(id: string, data: WardrobeInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('wardrobe')
    .update({ name: data.name, slot: data.slot, at: data.at, line: data.line })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_wardrobe', 'wardrobe', id, { name: data.name, at: data.at })
  revalidatePath('/wardrobe')
}

export async function createWardrobe(id: string, data: WardrobeInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('wardrobe')
    .insert({ id, name: data.name, slot: data.slot, at: data.at, line: data.line })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'create_wardrobe', 'wardrobe', id, { name: data.name, at: data.at })
  revalidatePath('/wardrobe')
}
