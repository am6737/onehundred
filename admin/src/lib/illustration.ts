// 把 levels.illustration_path 解析成浏览器可访问的图片地址。
// 与 App 端 src/components/Motifs.tsx 的 illustrationUrl 保持一致：
//   1) 完整网址 https://...      —— 直接使用
//   2) 桶内路径 levels/01.png     —— 当成 illustrations 公开桶里的路径解析
// 都没有则返回 null。使用 NEXT_PUBLIC_ 前缀，服务端与客户端组件均可调用。
export function illustrationUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return null
  const clean = path.replace(/^\/+/, '')
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/illustrations/${clean}`
}
