'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export type LevelInput = {
  title: string
  why: string
  suggest: string
  tone: string
  sort_order: number
  illustration_path: string
  perspective: string
  sealed: boolean
  seasonal: boolean
}

export async function updateLevel(num: string, data: LevelInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('levels')
    .update({
      title: data.title,
      why: data.why,
      suggest: data.suggest,
      tone: data.tone,
      sort_order: data.sort_order,
      illustration_path: data.illustration_path || null,
      perspective: data.perspective,
      sealed: data.sealed,
      seasonal: data.seasonal,
    })
    .eq('num', num)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_level', 'level', num, { title: data.title })
  revalidatePath('/levels')
}

// 上传/重新上传活动插画到公开桶 illustrations，返回桶内路径（存进 illustration_path）。
export async function uploadLevelIllustration(formData: FormData): Promise<string> {
  const adminId = await getAdminId()
  const file = formData.get('file')
  const num = String(formData.get('num') || 'new').trim() || 'new'
  if (!(file instanceof File) || file.size === 0) throw new Error('未选择文件')
  if (!file.type.startsWith('image/')) throw new Error('仅支持图片文件')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png'
  const safeNum = num.replace(/[^a-zA-Z0-9_-]/g, '') || 'new'
  const path = `levels/${safeNum}-${Date.now()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error } = await supabaseAdmin.storage
    .from('illustrations')
    .upload(path, bytes, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)

  await logAuditEvent(adminId, 'upload_level_illustration', 'level', num, { path })
  return path
}

export async function createLevel(num: string, data: LevelInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('levels')
    .insert({
      num,
      title: data.title,
      why: data.why,
      suggest: data.suggest,
      tone: data.tone,
      sort_order: data.sort_order,
      illustration_path: data.illustration_path || null,
      perspective: data.perspective,
      sealed: data.sealed,
      seasonal: data.seasonal,
    })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'create_level', 'level', num, { title: data.title })
  revalidatePath('/levels')
}
