import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
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


export function normalizeChinaPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `+86${digits}`;
  if (digits.length === 13 && digits.startsWith('86')) return `+${digits}`;
  if (phone.trim().startsWith('+')) return phone.trim().replace(/\s/g, '');
  return phone.trim();
}

export function maskPhone(phone?: string | null) {
  if (!phone) return '';
  const normalized = phone.startsWith('+86') ? phone.slice(3) : phone;
  const digits = normalized.replace(/\D/g, '');
  if (digits.length >= 7) return `${digits.slice(0, 3)} **** ${digits.slice(-4)}`;
  return phone;
}

export async function sendPhoneOtp(phone: string) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone: normalizeChinaPhone(phone) });
  if (error) throw error;
  return data;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizeChinaPhone(phone),
    token,
    type: 'sms',
  });
  if (error) throw error;
  return data;
}

export async function signInWithPhonePassword(phone: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    phone: normalizeChinaPhone(phone),
    password,
  });
  if (error) throw error;
  return data;
}

export async function updatePhone(phone: string) {
  const { data, error } = await supabase.auth.updateUser({ phone: normalizeChinaPhone(phone) });
  if (error) throw error;
  return data;
}

export async function verifyPhoneChange(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizeChinaPhone(phone),
    token,
    type: 'phone_change',
  });
  if (error) throw error;
  return data;
}

export async function getCurrentUserPhone() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.phone || '';
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// 永久注销：删除自己的账号（含级联清除全部回忆），再清掉本地会话。
export async function deleteAccount() {
  const providers = await getLinkedProviders();
  let appleAuthorizationCode: string | null = null;
  if (providers.includes('apple')) {
    const credential = await appleCredential();
    appleAuthorizationCode = credential.authorizationCode;
  }

  const { error } = await supabase.functions.invoke('delete-account', {
    body: { appleAuthorizationCode },
  });
  if (error) throw error;
  // 服务端已删账号，本地会话必须清掉；此时 signOut 报错可以忽略。
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

// ── Apple Sign-In ──

function generateNonce(length = 32): string {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes, (b: number) => b.toString(16).padStart(2, '0')).join('');
}

async function appleCredential() {
  const rawNonce = generateNonce();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!credential.identityToken) throw new Error('Apple Sign-In: no identity token');
  if (!credential.authorizationCode) throw new Error('Apple Sign-In: no authorization code');
  return {
    token: credential.identityToken,
    nonce: rawNonce,
    authorizationCode: credential.authorizationCode,
  };
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

export async function signInWithApple() {
  const { token, nonce } = await appleCredential();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token,
    nonce,
  });
  if (error) throw error;
  return data;
}

export async function bindApple() {
  const { token, nonce } = await appleCredential();
  const { data, error } = await (supabase.auth as any).linkIdentity({
    provider: 'apple',
    token,
    nonce,
  });
  if (error) throw error;
  return data;
}

// ── Identity management ──

export async function getLinkedProviders(): Promise<string[]> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return [];
  return (user.identities || []).map((i: any) => i.provider);
}

export async function unbindProvider(provider: string) {
  const { data: { user }, error: ue } = await supabase.auth.getUser();
  if (ue || !user) throw ue || new Error('未登录');
  const identity = (user.identities || []).find((i: any) => i.provider === provider);
  if (!identity) throw new Error('该登录方式未绑定');
  const remaining = (user.identities || []).length;
  const hasPhone = !!user.phone;
  if (remaining <= 1 && !hasPhone) throw new Error('至少保留一种登录方式');
  const { error } = await supabase.auth.unlinkIdentity(identity);
  if (error) throw error;
}
