import { supabaseAdmin } from './supabase-admin'

export async function logAuditEvent(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>,
  ipAddress?: string,
) {
  await supabaseAdmin.from('admin_audit_log').insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType,
    target_id: targetId,
    details: details ?? {},
    ip_address: ipAddress ?? null,
  })
}
