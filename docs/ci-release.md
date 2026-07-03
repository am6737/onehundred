# 自动打包与发布（GitHub Actions）

工作流文件：`.github/workflows/release.yml`。用 `eas build --local` 在 GitHub Runner 上
直接出包（不消耗 EAS 云构建额度），产物挂到 GitHub Release；iOS 还能一键提交 App Store。

打包配置在 `eas.json`（profile：`production` / `preview` / `development`）。营销版本号由
`app.config.ts` 读取 `APP_VERSION`（取自 git tag，去掉前缀 `v`）；iOS buildNumber / Android
versionCode 由 EAS 远端自增（`appVersionSource: remote` + `autoIncrement`）。

## 两种触发方式

| 触发                         | 做什么                                          |
| ---------------------------- | ----------------------------------------------- |
| **push tag `v*`**            | 打 APK + AAB + IPA，汇总成一个 GitHub Release    |
| **Actions 手动运行**（填版本号） | 打 IPA 并提交到 App Store / TestFlight            |

发版示例：

```bash
git tag v1.2.3
git push origin v1.2.3
# → 自动出 3 个产物，见仓库 Releases 页
```

上架 App Store：GitHub → Actions → Release → Run workflow，版本号填 `1.2.3`。

## 必需的 GitHub Secrets

仓库 Settings → Secrets and variables → Actions → New repository secret：

| Secret                  | 说明                                                              |
| ----------------------- | ---------------------------------------------------------------- |
| `EXPO_TOKEN`            | Expo 机器人 token（expo.dev → Account → Access Tokens），需 build+submit 权限 |
| `ENV_FILE_BASE64`       | 本地 `.env` 的 base64，见下方生成命令。含 Supabase / DooPush / OPPO / vivo / 推送密钥 |
| `ASC_API_KEY_P8_BASE64` | App Store Connect API Key（`.p8` 文件）的 base64（仅上架用）         |
| `ASC_API_KEY_ID`        | 上述 Key 的 Key ID                                                |
| `ASC_ISSUER_ID`         | App Store Connect 的 Issuer ID                                   |
| `ASC_APP_ID`            | 本 App 在 App Store Connect 的数字 ID（ascAppId）                  |

生成 `ENV_FILE_BASE64`（在项目根目录）：

```bash
base64 -w0 .env    # macOS 用 `base64 -i .env`
```

生成 `ASC_API_KEY_P8_BASE64`：

```bash
base64 -w0 AuthKey_XXXXXXXXXX.p8
```

> `.env` 更新后要重新生成 `ENV_FILE_BASE64` 并覆盖 secret，否则打的包还是旧配置。

## 一次性准备：EAS 签名凭据

`--local` 打包会从 EAS 拉取签名证书，需先在本机跑一次交互式配置（用同一个 Expo 账号）：

```bash
eas login
eas credentials    # iOS：分发证书 + 描述文件；Android：release keystore
```

`eas.json` 里的 `submit.production.ios.appleId` / `appleTeamId` 目前填的是 hitosea 账号，
换其它开发者账号时记得改。`ascAppId` 由 `ASC_APP_ID` secret 在提交时注入，不用写进文件。

## 说明

- 产物命名 `yibai-<tag>.{apk,aab,ipa}`。AAB 用于 Google Play，本工作流只自动上架 iOS；
  Android 上架（`eas submit -p android`）需要 Google Play service account，按需另加。
- Android 步骤关掉了 `lintVital`（避免 CI 里因 lint 失败中断），与 happy-next 一致。
- Runner：Android 用 `ubuntu-latest`，iOS 用 `macos-26` + Xcode 26.4.1（对应 Expo 56 / RN 0.85）。
