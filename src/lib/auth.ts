import { supabase } from './supabase';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 永久注销：删除自己的账号（含级联清除全部回忆），再清掉本地会话。
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  // 账号已删，本地会话必须清掉；服务端可能已无此用户，signOut 报错就忽略。
  await supabase.auth.signOut().catch(() => {});
}

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}

export async function isAnonymous(): Promise<boolean> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return false;
  return user.is_anonymous === true;
}

export async function bindEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.updateUser({ email, password });
  if (error) throw error;
  return data;
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// 启动时用它，而不是 getSession：getSession 只读本地存储、不校验。
// 本地库被重置后，设备里仍存着旧用户的 JWT（签名照样合法），auth.uid() 会返回
// 一个 auth.users 里已不存在的幽灵 id，带着它进 onboarding 就会触发 create_family 的
// 外键报错（families_created_by_fkey）。getUser 向服务端确认这个用户是否真的存在；
// 服务端明确否认（401/403）才清掉死会话，网络错误则保守沿用本地会话，避免离线误登出。
export async function getValidSession() {
  const session = await getSession();
  if (!session) return null;
  const { error } = await supabase.auth.getUser();
  if (error) {
    const status = (error as any).status;
    if (status === 401 || status === 403) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
  }
  return session;
}

export function onAuthStateChange(callback: (event: string, session: any) => void) {
  return supabase.auth.onAuthStateChange(callback);
}
