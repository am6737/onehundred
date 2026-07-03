# 华为 HMS 推送接入

参照 DooPush RN SDK 文档（<https://doopush.com/docs/sdk/react-native-integration.html>）接入华为
Push Kit。华为通道与已有的 OPPO / vivo 通道并列，跑在同一套 `doopush-react-native-sdk` 上，
`DooPush.register()` 会在华为设备（无 GMS）上自动选中 HMS 通道，**JS 端无需改动**。

## 一句话原理

- **客户端**（本仓库）只需要一个文件：`agconnect-services.json`（AGC 控制台下载，**不含密钥**）。
  它带上 app 标识 / 包名 / AGC 网关地址，供华为 Push SDK 在设备上换取 push token。
- **服务端**（DooPush 后台）才需要华为的 **OAuth Client ID / Client Secret**，用来换 access token
  调华为 Push Kit 下发。这些密钥**不进客户端包**，只在 DooPush 控制台配置。

## 代码侧已完成（本次改动）

| 文件 | 改动 |
| --- | --- |
| `app.config.ts` | 存在 `agconnect-services.json` 时，给 doopush 插件注入 `android.vendors.hms`；dev 用 `agconnect-services.dev.json`，prod 用 `agconnect-services.json`；文件缺失自动跳过，不会让 prebuild 报错 |
| `.gitignore` | 忽略 `agconnect-services*.json`（含公开标识，按 DooPush 建议不入库） |
| `.github/workflows/release.yml` | `build-android` 里从 GitHub Secret `AGCONNECT_SERVICES_JSON_BASE64` 还原出该文件；未配置则打 warning 且包内不含华为通道 |

插件（`doopush-react-native-sdk`）在 prebuild 时会自动完成的原生配置：把文件复制到
`android/app/` 与 `android/app/src/main/assets/`、`apply plugin 'com.huawei.agconnect'`、
加华为 Maven 仓库 `https://developer.huawei.com/repo/` + `agcp` classpath、加
`implementation 'com.huawei.hms:push'` 依赖。**这些都不用手动改。**

## 你需要手动做的事

### 1. AGC 控制台：下载 `agconnect-services.json`

华为「AppGallery Connect → 我的项目 → 一百件事 → 应用（com.hitosea.moments100）→ 项目设置 →
常规 → 应用 → 下载 agconnect-services.json（不含密钥）」。

- 放到**仓库根目录**，命名 `agconnect-services.json`（正式包用）。
- 确认文件里的 `package_name` == `com.hitosea.moments100`（与 `app.config.ts` 里正式包名一致）。
- 顺手在 AGC「应用 → 常规 → SHA256 证书指纹」里**添加 release 签名证书的 SHA256 指纹**
  （华为侧目前显示未添加）。指纹取自 EAS 上的 Android keystore：
  `eas credentials`（Android → 查看 keystore 的 SHA-256）。

> ⚠️ 该文件已被 `.gitignore`，本地放着即可，不要提交。

### 2. DooPush 后台：配置华为（HMS）下发通道

进 DooPush 控制台 → 对应 App（**正式包 appId=2**，见 `.env` 的
`EXPO_PUBLIC_DOOPUSH_APP_ID`）→ 通道配置 → 华为 / HMS，填华为侧应用凭据：

| DooPush 字段 | 值（来自华为 AGC「应用」信息） |
| --- | --- |
| App ID | `118204949` |
| OAuth Client ID | `118204949` |
| OAuth Client Secret | 见 AGC 控制台 / 已下发的凭据（**勿写进仓库**） |

没配这一步的话，即使客户端拿到了华为 token，DooPush 服务端也无法把推送投给华为。

### 3. CI：加一个 GitHub Secret

让打包机能还原出 `agconnect-services.json`（沿用 `.env` 的 base64 套路）：

```bash
base64 -w0 agconnect-services.json   # 复制输出
```

到 GitHub → Settings → Secrets and variables → Actions，新建
`AGCONNECT_SERVICES_JSON_BASE64`，粘贴上面的 base64。之后 tag 触发的 Android 打包会自动带上华为通道。

### 4.（可选）dev 环境华为通道

dev 包名是 `com.hitosea.moments100.dev`，与正式包不同，华为通道按包名隔离。若要在 dev 包里测华为推送：
在 AGC 里为 `com.hitosea.moments100.dev` 建一个应用，下载其配置文件命名为
`agconnect-services.dev.json` 放仓库根目录（同样已 gitignore）。不建则 dev 包不含华为通道，不影响构建。

## 本地验证

需要一台**华为真机（无 GMS）**，模拟器 / 有 GMS 的设备不会走 HMS。

```bash
# 放好 agconnect-services.json 后
npx expo prebuild --clean
npx expo run:android            # 或 --device <id>
```

在 App 的「设置 → 开发者」里点注册，看 token / vendor 是否为 `hms`；或看日志
`[DooPush] 注册成功 <token> <deviceId>`。再用该页的测试推送验证下发。

## 排错

- **注册失败 / 拿不到 token**：确认 `agconnect-services.json` 的 `package_name` 与打包包名一致；
  确认设备是华为且无 GMS；确认 AGC 里已开通 Push Kit 且加了签名 SHA256 指纹。
- **prebuild 报找不到 `agconnect-services.json`**：文件没放对位置或名字不对（正式包必须叫
  `agconnect-services.json` 放仓库根）。
- **能注册但收不到推送**：多半是第 2 步（DooPush 后台华为通道凭据）没配或 Client Secret 错。
