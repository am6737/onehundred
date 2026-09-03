# invite-web — 家庭邀请落地页 + Universal/App Link 关联文件

部署到 **`https://yibaijianshi.app`** 根目录的一套静态文件。App 里 `familyInviteUrl()`
（`src/lib/invite.ts`）生成的邀请链接就是 `https://yibaijianshi.app/join/<code>`。

```
invite-web/
├── join/index.html                     邀请落地页（浏览器可点 + 引导下载 + 显示邀请码）
├── .well-known/
│   ├── apple-app-site-association       iOS Universal Link 关联文件（AASA）
│   └── assetlinks.json                  Android App Link 关联文件
├── _redirects        Netlify / Cloudflare Pages：/join/* → join/index.html
├── _headers          Netlify / Cloudflare Pages：AASA/assetlinks 的 Content-Type
└── vercel.json       Vercel：同上的 rewrite + headers
```

## 现在就能用（第一步：落地页）

把本目录整体部署到 yibaijianshi.app 根，链接**立刻**在浏览器/微信里可点：
- 已装 App → 点「打开 App 加入」用 scheme 拉起（UL 未激活时的兜底）。
- 没装 App → 显示下载区 + 邀请码，手动加入。
- 系统相机/微信扫二维码 → 直接识别成这个 https 链接。

托管要求：`/.well-known/*` 按原路径以 `application/json` 直出（走 https、无跳转）；
`/join/<任意码>` 重写到 `join/index.html`（配置已随附，选对应平台的那个即可）。

## 待填占位（后续补）

| 位置 | 占位符 | 换成 |
|------|--------|------|
| `join/index.html` | `IOS_STORE_URL` / `ANDROID_STORE_URL` | App 上架后的商店链接（留空则按钮显示「即将上线」） |
| `join/index.html` | `APP_SCHEME`（已填 `moments100`） | 若正式包 scheme 改了再同步 |
| `.well-known/assetlinks.json` | `<ANDROID_SHA256>` / `<ANDROID_SHA256_DEV>` | 签名证书 SHA256 指纹 |

> 拿 Android SHA256：走 Play 应用签名时用 **Play Console → 应用完整性 → 应用签名** 里的
> SHA-256；自管密钥库用 `keytool -list -v -keystore <ks> -alias <alias>`。
> EAS 托管凭据可 `eas credentials -p android` 查看。dev 变体若不单独出包，可删掉第二条。

## 第二步：激活真正的 Universal / App Link（点链接直接开 App）

链接在浏览器可点之后，要做到「点 https 链接直接拉起 App、不过浏览器」，需要：

1. **本目录已部署**且 Android 关联文件占位已填真值（上表）。iOS AASA 已使用
   `eas.json` 中的 Team ID `G365J5PZA2`；更换 Apple Developer 团队时必须同步修改。
2. App 端配置已就位 —— 已在 `app.config.ts` 写好：
   - iOS `ios.associatedDomains: ["applinks:yibaijianshi.app"]`
   - Android `android.intentFilters`（`autoVerify: true`，host `yibaijianshi.app`，pathPrefix `/join`）
3. **重新出原生包**（`eas build`）并安装 —— 关联只在安装时校验，OTA 更新不生效。

验证：
- iOS：`https://app-site-association.cdn-apple.com/a/v1/yibaijianshi.app` 能看到解析结果；真机点链接直接进 App。
- Android：`adb shell pm get-app-links com.hitosea.moments100` 看到 `verified`；
  或 `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://yibaijianshi.app&relation=delegate_permission/common.handle_all_urls` 校验。

未激活期间链接不会报错，只是优雅降级为「打开本落地页」。

## 相关代码

- 链接生成 / 解析：`src/lib/invite.ts`（`familyInviteUrl` / `parseInviteCode`）
- 分享 & 二维码：`src/screens/Settings.tsx` 的 `InviteSheet`
- 深链接收 → 跳「加入家庭」：`App.tsx` 的 `Linking` 监听 + `parseInviteCode`
- 加入后端：`redeem_invite` / `peek_invite` RPC（`supabase-docker/volumes/db/init/schema.sql`）
