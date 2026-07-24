'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export async function updateModerationStatus(
  memoryId: string,
  status: 'pending' | 'approved' | 'flagged' | 'removed',
  note: string,
) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('memories')
    .update({ moderation_status: status, moderation_note: note })
    .eq('id', memoryId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_moderation', 'memory', memoryId, { status, note })
  revalidatePath(`/content/${memoryId}`)
  revalidatePath('/content')
}

export async function updateSealStatus(
  memoryId: string,
  sealed: boolean,
  sealUntil: string | null,
  sealLabel: string | null,
) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('memories')
    .update({ sealed, seal_until: sealUntil, seal_label: sealLabel })
    .eq('id', memoryId)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, sealed ? 'seal_memory' : 'unseal_memory', 'memory', memoryId, {
    sealed,
    sealUntil,
    sealLabel,
  })
  revalidatePath(`/content/${memoryId}`)
  revalidatePath('/content')
}

export async function deleteMemory(memoryId: string, familyId: string) {
  const adminId = await getAdminId()

  // 先获取记录标题用于审计
  const { data: mem } = await supabaseAdmin
    .from('memories')
    .select('title, type')
    .eq('id', memoryId)
    .maybeSingle()

  // 删除 Storage 文件
  const prefix = `${familyId}/${memoryId}/`
  const { data: files } = await supabaseAdmin.storage.from('memories').list(prefix)
  if (files && files.length > 0) {
    const paths = files.map((f) => `${prefix}${f.name}`)
    await supabaseAdmin.storage.from('memories').remove(paths)
  }

  // 删除数据库记录
  const { error } = await supabaseAdmin.from('memories').delete().eq('id', memoryId)
  if (error) throw new Error(error.message)

  await logAuditEvent(adminId, 'delete_memory', 'memory', memoryId, {
    title: mem?.title,
    type: mem?.type,
    familyId,
  })
  revalidatePath('/content')
}
