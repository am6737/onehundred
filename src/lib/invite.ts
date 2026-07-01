import * as Linking from 'expo-linking';

/**
 * 家庭邀请码 → 可扫描 / 可点击的深链。
 * 用 expo-linking 生成，自动带上当前构建的 scheme（moments100 或 dev 的 moments100-dev），
 * 这样 dev 包扫出来的二维码会拉起 dev app、正式包拉起正式 app。
 */
export function familyInviteUrl(code: string): string {
  return Linking.createURL('/join/' + encodeURIComponent(code));
}

/**
 * 从扫码结果 / 深链 / 直接粘贴的文本里解析出家庭邀请码，解析不到返回 null。
 * 兼容：
 *   - moments100://join/ABCD1234（自定义 scheme，含 dev 变体）
 *   - https://yibaijianshi.app/join/ABCD1234（网页链接）
 *   - 直接是一串裸邀请码 ABCD1234
 */
export function parseInviteCode(input?: string | null): string | null {
  if (!input) return null;
  const s = input.trim();
  const m = s.match(/join\/([A-Za-z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  // 裸邀请码：家庭邀请码是 8 位字母数字，这里放宽到 4~16 位容错
  if (/^[A-Za-z0-9]{4,16}$/.test(s)) return s.toUpperCase();
  return null;
}
