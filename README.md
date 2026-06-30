# 一百件事 · 100 Things

> 陪孩子，慢慢做完一百件值得记住的小事。
> *Every little thing of growing up together.*

「一百件事」是一款面向家庭的成长记录 App。父母和家人把孩子的成长拆成「一百件事」——一件件慢慢去做、慢慢记下来，最后汇成一本只属于这个家的回忆册。每一件事都可以用**文字、照片、视频、实况照片（Live Photo）或语音**记录；可以把某条回忆**封存成时光胶囊**、约定一个未来的日子再打开；全家人**共享同一份回忆**，还能一起把一只虚拟小宠物养大。

App 名（中文「一百件事」 / 英文「100 Things」），URL scheme 为 `moments100`，bundle id `com.hitosea.moments100`。

---

## 功能特性

- **一百件事 · 三种视角** — 每件事属于「我为你做（父母→孩子）」「你为我做（孩子→父母）」或「我们一起做」三种视角之一，首页按场景（时段 / 季节 / 周末 / 孩子年龄）加权推荐。
- **多形态记录** — 文字、拍照、录视频、实况照片、语音录制；语音可经服务端 ASR 自动转写成文字。
- **我们家自己的事** — 在内置的事之外自定义「我们家的事」，可上传封面插画。
- **时光胶囊（封存）** — 把一条回忆封存到未来某天（自定义日期 / 孩子 18 岁生日），到期前任何人都打不开。
- **家庭共享** — 创建家庭、用邀请码或深链（`moments100://join/<code>`）邀请家人加入；数据按家庭隔离（Postgres RLS）。
- **邀记（yaoji）** — 为某一件事生成一个可分享的网页链接，没装 App 的家人也能通过网页提交一条记录。
- **回忆册 / 相册书** — 回忆册线、相册书翻页预览、年度回顾、记录日历、同一件事的时间线与前后对比。
- **虚拟宠物 / 小熊衣橱** — 小熊 / 小狗 / 小猫随记录数成长、解锁衣橱配饰，记录越多养得越大。
- **拟人化推送** — 新记录即时通知其他家人；由 `pg_cron` 每小时调度、以宠物口吻发送的成长提醒（基于 DooPush）。
- **中英双语** — 手写的轻量 i18n 方案，跟随系统或手动切换。
- **明暗主题** — 多套配色预设与强调色。

---

## 技术栈

**客户端（Expo / React Native）**

- [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/) · React Native 0.85（新架构 / Fabric） · React 19 · TypeScript
- React Navigation 7（native stack） · Reanimated 4 · react-native-gesture-handler
- expo-image-picker / expo-audio / expo-video / expo-live-photo / expo-media-library（媒体能力）
- react-native-svg · react-native-qrcode-svg · react-native-view-shot
- [DooPush](https://doopush.com) RN SDK（推送）· Apple 登录
- 自研 i18n（`src/i18n`）与主题系统（`src/theme/tokens.tsx`）

**后端（自建 Supabase）**

- Postgres + 行级安全（RLS），数据按 `family_id` 隔离
- Supabase Auth（手机号、邮箱密码、Apple 登录）
- Supabase Storage（`memories`、`illustrations` 桶）
- Edge Functions（Deno）：
  - `yaoji` — 邀记 token 的创建 / 失效与对外的网页记录页
  - `transcribe` — 语音转写（默认走 OpenAI / Whisper 兼容接口，可配置 ASR provider）
  - `send-pet-notifications` — 扫描家庭记录状态、匹配场景、调 DooPush 发送拟人化通知
  - `main` / `hello` — 基础示例

---

## 项目结构

```
.
├── App.tsx                  # 根组件：字体 / i18n / 主题 / 鉴权门 / 导航栈 / 推送初始化
├── app.config.ts            # Expo 配置（含按 APP_VARIANT 切换 Dev/Prod 与 DooPush 注入）
├── index.ts                 # registerRootComponent 入口
├── src/
│   ├── screens/             # 所有页面（首页、记录流、回忆册、封存、宠物、邀请、设置…）
│   ├── components/          # 复用组件（宠物渲染器、Live Photo、Motifs、图标…）
│   ├── data/                # Supabase 数据层（DataProvider + 取数/写数/家庭/封存等纯函数）
│   ├── lib/                 # supabase 客户端、auth、media、transcribe、yaoji（邀记）
│   ├── i18n/                # 手写中英双语（locales/zh.ts、en.ts + t()/useT()）
│   ├── theme/               # 配色预设与主题 token
│   └── utils/               # storage 等工具
├── assets/                  # 字体、图标、启动图
├── lang/                    # 原生层本地化（zh.json / en.json，供权限弹窗等）
├── docs/                    # 推送策略、宠物系统等设计文档
├── scripts/                 # 演示用户播种、手动触发宠物通知等脚本
└── supabase-docker/         # 自建 Supabase 栈（schema、迁移、Edge Functions、docker-compose）
    ├── volumes/db/init/schema.sql
    ├── volumes/functions/   # yaoji / transcribe / send-pet-notifications / main / hello
    └── migrations/          # 增量迁移（推送、家庭通知、邀记 opened_at 等）
```

---

## 快速开始

### 环境要求

- Node.js（建议 LTS）+ npm
- iOS：Xcode；Android：Android Studio / SDK
- ⚠️ 本项目用到 DooPush、expo-live-photo 等原生模块，**无法在 Expo Go 中运行**，需要构建[开发版客户端（Dev Client）](https://docs.expo.dev/develop/development-builds/introduction/)。

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env`（这些键会被打进 JS bundle，注意只放可公开的 anon key）：

```bash
APP_VARIANT=development            # development → Dev 变体；留空/其它 → 生产变体
EXPO_PUBLIC_SUPABASE_URL=...       # 你的 Supabase 地址
EXPO_PUBLIC_SUPABASE_ANON_KEY=...  # Supabase anon key
EXPO_PUBLIC_DOOPUSH_APP_ID=...     # DooPush 生产凭据
EXPO_PUBLIC_DOOPUSH_API_KEY=...
EXPO_PUBLIC_DOOPUSH_APP_ID_DEV=... # DooPush Dev 凭据（APP_VARIANT=development 时使用）
EXPO_PUBLIC_DOOPUSH_API_KEY_DEV=...
DOOPUSH_OPPO_APP_KEY=...           # Android 只接 OPPO vendor；仅构建期使用
DOOPUSH_OPPO_APP_SECRET=...
DOOPUSH_OPPO_APP_KEY_DEV=...       # 可选：Dev 变体 OPPO 凭据
DOOPUSH_OPPO_APP_SECRET_DEV=...
```

> 缺少 DooPush 凭据时 App 会跳过推送初始化（不会崩溃），其余功能可正常使用。

### 3. 运行 App

```bash
npm run ios       # 构建并运行 iOS 开发版客户端
npm run android   # 构建并运行 Android 开发版客户端
npm start         # 启动 Metro（连接已安装的 Dev Client）
```

### 4. 测试

```bash
npm test          # jest-expo
```

---

## 后端（自建 Supabase）

后端是一套自托管的 Supabase，全部位于 `supabase-docker/`，详见该目录下的 `README.md` / `setup.sh` / `run.sh`。

- 初始库结构：`supabase-docker/volumes/db/init/schema.sql`（表、RLS 策略、`create_family` / `redeem_invite` / `register_push_device` 等 RPC）。
- 增量迁移：`supabase-docker/migrations/`（推送设备、家庭通知、拟人化通知调度、邀记 `opened_at` 等）。
- Edge Functions：`supabase-docker/volumes/functions/`，需配置各自的 secrets，例如：
  - `transcribe`：`ASR_PROVIDER` / `ASR_API_KEY` / `ASR_MODEL` / `ASR_BASE_URL`
  - `send-pet-notifications`：`DOOPUSH_APP_ID` / `DOOPUSH_API_KEY`（与客户端 `EXPO_PUBLIC_DOOPUSH_*` 一致）
  - `yaoji`：`JWT_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_PUBLIC_URL`

> ⚠️ 重置本地库时请按 `supabase-docker` 的正确流程操作，避免误用破坏数据隔离的手段（见仓库内相关说明）。

---

## 约定与注意事项

- **Expo 版本敏感**：本仓库基于 Expo SDK 56，写代码前请先查[对应版本文档](https://docs.expo.dev/versions/v56.0.0/)，不同版本 API 差异较大。
- **新架构手势**：RN 0.85（Fabric）下 Modal 内的手势需用 `react-native-gesture-handler` 的 `GestureDetector`，并在 Modal 内再套一层 `GestureHandlerRootView`。
- **媒体功能不可 mock**：拍照、录视频、上传图片 / 视频必须调用真实原生能力。
- **i18n 双语同改**：新增文案要在 `zh.ts` 和 `en.ts` 两边都加键；角色、主题预设名、Motifs 关键词等作为规范标识符**不翻译**。
- **角色规范标识**：`role` 在数据库中以中文存储（如 `爸爸`、`其他`）并用于判等，仅在展示层翻译。

---

## 许可证

见 [LICENSE](./LICENSE)。
