import { createSupabaseServerClient } from './supabase-server'

export async function getAdminId(): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('未登录')
  return user.id
}
