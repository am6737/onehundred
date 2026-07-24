'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

export async function retryDeadJob(id: number) {
  const adminId = await getAdminId()
  const { error } = await supabaseAdmin
    .from('notification_outbox')
    .update({ status: 'pending', attempts: 0, last_error: null })
    .eq('id', id)
    .eq('status', 'dead')
  if (error) throw new Error(error.message)
  await logAuditEvent(adminId, 'retry_outbox_job', 'notification_outbox', String(id))
  revalidatePath('/notifications/outbox')
}

export async function retryAllDeadJobs() {
  const adminId = await getAdminId()
  const { data, error } = await supabaseAdmin
    .from('notification_outbox')
    .update({ status: 'pending', attempts: 0, last_error: null })
    .eq('status', 'dead')
    .select('id')
  if (error) throw new Error(error.message)
  const ids = (data ?? []).map((r) => r.id)
  await logAuditEvent(adminId, 'retry_all_dead_outbox_jobs', 'notification_outbox', 'bulk', { count: ids.length, ids })
  revalidatePath('/notifications/outbox')
}
