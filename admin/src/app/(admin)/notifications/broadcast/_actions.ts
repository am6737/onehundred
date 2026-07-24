'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit'
import { getAdminId } from '@/lib/get-admin-id'

const DOOPUSH_APP_ID = process.env.DOOPUSH_APP_ID ?? ''
const DOOPUSH_API_KEY = process.env.DOOPUSH_API_KEY ?? ''
const DOOPUSH_BASE_URL = process.env.DOOPUSH_BASE_URL || 'https://doopush.com/api/v1'

export async function getTargetDeviceCount(platform: string, lang: string): Promise<number> {
  let query = supabaseAdmin
    .from('push_devices')
    .select('id', { count: 'exact', head: true })
    .not('token', 'is', null)
  if (platform !== 'all') query = query.eq('platform', platform)
  if (lang !== 'all') query = query.eq('lang', lang)
  const { count } = await query
  return count ?? 0
}

export type BroadcastResult = {
  ok: boolean
  sent: number
  failed: number
  total: number
  error?: string
}

export async function sendBroadcast(
  title: string,
  body: string,
  platform: string,
  lang: string,
): Promise<BroadcastResult> {
  if (!title.trim() || !body.trim()) {
    return { ok: false, sent: 0, failed: 0, total: 0, error: '标题和正文不能为空' }
  }
  if (!DOOPUSH_APP_ID || !DOOPUSH_API_KEY) {
    return {
      ok: false, sent: 0, failed: 0, total: 0,
      error: 'DooPush 配置缺失（DOOPUSH_APP_ID / DOOPUSH_API_KEY 未配置）',
    }
  }

  const adminId = await getAdminId()

  let query = supabaseAdmin
    .from('push_devices')
    .select('token')
    .not('token', 'is', null)
  if (platform !== 'all') query = query.eq('platform', platform)
  if (lang !== 'all') query = query.eq('lang', lang)
  const { data: devices } = await query

  const tokens = (devices ?? []).map((d) => d.token).filter(Boolean) as string[]

  let sent = 0
  let failed = 0
  for (const token of tokens) {
    try {
      const res = await fetch(`${DOOPUSH_BASE_URL}/apps/${DOOPUSH_APP_ID}/push/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': DOOPUSH_API_KEY },
        body: JSON.stringify({
          title,
          content: body,
          device_id: token,
          payload: { action: 'open_page', data: JSON.stringify({ type: 'broadcast' }) },
        }),
      })
      if (res.ok) sent++
      else failed++
    } catch {
      failed++
    }
  }

  await logAuditEvent(adminId, 'broadcast_push', 'push_devices', 'all', {
    title,
    body,
    platform,
    lang,
    total: tokens.length,
    sent,
    failed,
  })

  revalidatePath('/notifications/broadcast')
  return { ok: true, sent, failed, total: tokens.length }
}
