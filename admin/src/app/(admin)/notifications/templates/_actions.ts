'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export type TemplateInput = {
  scene: string
  species: string
  lang: string
  title: string
  body: string
  sort_order: number
}

export async function updateTemplate(id: number, data: TemplateInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('notification_templates')
    .update({
      scene: data.scene,
      species: data.species,
      lang: data.lang,
      title: data.title,
      body: data.body,
      sort_order: data.sort_order,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'update_notification_template', 'notification_template', String(id), {
    scene: data.scene,
    species: data.species,
    lang: data.lang,
  })
  revalidatePath('/notifications/templates')
}

export async function createTemplate(data: TemplateInput) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('notification_templates')
    .insert({
      scene: data.scene,
      species: data.species,
      lang: data.lang,
      title: data.title,
      body: data.body,
      sort_order: data.sort_order,
    })
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'create_notification_template', 'notification_template', `${data.scene}/${data.species}/${data.lang}`, {
    scene: data.scene,
    species: data.species,
    lang: data.lang,
  })
  revalidatePath('/notifications/templates')
}
