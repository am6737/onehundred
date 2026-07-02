/**
 * 家庭邀请链接。
 *
 * 用一个我们自己控制的稳定域名生成 https 链接（而不是 moments100:// 自定义 scheme）：
 *   - 已装 App：走 iOS Universal Link / Android App Link，点链接直接拉起 App 到「加入家庭」
 *     （关联文件 apple-app-site-association / assetlinks.json 部署到该域名 /.well-known/ 后生效）。
 *   - 没装 App：点链接落到网页版邀请页（invite-web/），引导下载 + 显示邀请码手动加入。
 *   - 二维码也编码这个 https 链接：系统相机 / 微信「扫一扫」都能直接识别成可点链接，
 *     App 内的 QRScanner 则通过 parseInviteCode 抠出邀请码。
 *
 * 注意：Universal/App Link 真正“点链接直接开 App”需要 (1) 关联文件已部署到该域名根、
 * (2) app.config 里 associatedDomains / intentFilters 已配、(3) 重新出原生包。三者未齐时，
 * 链接会优雅降级为“打开网页版邀请页”，功能不受影响，只是多一步点击。
 */
const INVITE_WEB_ORIGIN = 'https://yibaijianshi.app';

export function familyInviteUrl(code: string): string {
  return `${INVITE_WEB_ORIGIN}/join/${encodeURIComponent(code)}`;
}

/**
 * 从扫码结果 / 深链 / 直接粘贴的文本里解析出家庭邀请码，解析不到返回 null。
 * 兼容：
 *   - https://yibaijianshi.app/join/ABCD1234（网页链接 / Universal Link）
 *   - moments100://join/ABCD1234（自定义 scheme，含 dev 变体，老链接向后兼容）
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
