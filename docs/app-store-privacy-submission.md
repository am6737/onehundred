# App Store 隐私提交清单

本清单对应 2026-09-03 的生产版本。每次数据行为或第三方 SDK 变化后都必须重新核对。

## 发布前硬性检查

- [ ] 将隐私政策发布到稳定的公开 HTTPS 地址；可使用 GitHub Pages，访问时不得要求登录或额外权限。
- [ ] 在 App Store Connect 的 Privacy Policy URL 填入该公开地址，并在未登录浏览器中确认可以正常打开。
- [ ] 将网页中的“一百件事运营团队”替换为 Apple Developer 账号对应的真实个人或公司全名，并补充适用法律要求的联系地址。
- [ ] 确认网页、`PRIVACY.md` 和应用内中英文政策保持一致。
- [ ] EAS 设置 `EXPO_PUBLIC_ASR_PROVIDER_NAME`，值必须是实际处理录音的服务商公开名称。
- [ ] 后端设置 `APPLE_TEAM_ID`、`APPLE_KEY_ID`、`APPLE_CLIENT_ID` 和 `APPLE_PRIVATE_KEY`，并真机验证 Apple 账号注销。
- [ ] 执行 `20260903_app_store_account_deletion.sql`，部署 `delete-account` Edge Function，并确认两个 Storage bucket 无残留。
- [ ] 使用 Xcode Organizer 生成 Release Archive，检查 Privacy Report 和上传验证结果。
- [ ] 确认 Archive 中应用级 `PrivacyInfo.xcprivacy` 包含 `app.config.ts` 汇总的 UserDefaults、文件时间、磁盘空间和系统启动时间用途；如 Apple 上传邮件报告新 API，按实际依赖补充，不能猜测 reason code。

## App Privacy 建议申报

下列数据均用于 **App Functionality**；推荐内容涉及 **Product Personalization**；通知点击和推荐选择记录还涉及 **Analytics**。服务端数据通常均应标记为 **Linked to User**。当前没有广告跟踪，Tracking 应为 **No**。

| App Store 数据类型 | 本应用对应数据 |
| --- | --- |
| Contact Info / Name | Apple 授权姓名、孩子姓名或昵称 |
| Contact Info / Email Address | 登录或绑定邮箱、Apple 中继邮箱 |
| Contact Info / Phone Number | 手机号登录或绑定号码 |
| Location / Coarse Location | 用户填写的地点；若允许精确地址，按实际情况申报 Precise Location |
| User Content / Photos or Videos | 照片、视频、实况照片和自定义封面 |
| User Content / Audio Data | 录音及视频声音 |
| User Content / Other User Content | 标题、正文、转写、家庭角色、自定义事项和邀记内容 |
| Identifiers / User ID | Supabase 用户及家庭成员标识 |
| Identifiers / Device ID | DooPush 设备标识和推送令牌 |
| Usage Data / Product Interaction | 通知打开、推荐展示/跳过/选择状态 |
| Other Data | 家庭关系、儿童出生年月、时光胶囊和通知偏好 |

服务端若长期保存 IP 地址，应按实际用途额外申报 Device ID、Coarse Location 或 Diagnostics。DooPush、Apple 登录和实际语音识别服务商的数据行为也必须计入。

## 审核备注建议

1. 隐私政策位于登录页协议区域及“设置 -> 关于 -> 隐私政策”。
2. 注销位于“设置 -> 账号与安全 -> 注销账户”，不需要联系客服。
3. Apple 登录账号注销时会重新进行 Apple 验证并撤销 Apple token。
4. 录音转写为可选功能，每次发送前均显示实际服务商并取得明确同意；拒绝不影响保存录音。
5. 应用面向父母和监护人，不提交到 Kids Category，也不在元数据中描述为儿童直接使用的应用。
