# 管理后台重设计蓝图

> 适用范围：`admin-web` 重设计与后续数据库/接口演进的设计基线。
>
> 约束：本蓝图只基于四份审计结论与 `product-rules-v1.md` 整合，不把现有后台实现当作真相。
>
> 已确认规则基线：[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md)
>
> 审计来源：
> - App 产品流程与「事情 / 一百件事」领域模型审计
> - Database Domain Audit
> - Admin Redesign Gap Audit

## 0. 结论先行

当前最重要的设计结论是：

1. 业务主体是“事情 / level / 事”，不是“内容”或“任务”。
2. 事情有两类来源：系统内置事情与家庭自定义事情。
3. 真正的完成结果是 `memories` 所代表的记录，但它不承担“事情定义”的职责。
4. 后台必须按对象和生命周期组织，而不是按当前页面拼装。
5. 模板、版本、发布、复制、插画字段、家庭私有封面治理、审核、审计，必须进入正式的数据契约；V1 不包含家庭字段覆盖能力。

这些结论分别由以下审计交叉确认：

- App 产品审计确认了 App 端真实术语、页面链路和录入字段。证据：[App.tsx](/home/coder/workspaces/yibai/App.tsx)、[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)、[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- Database Domain Audit 确认了 `levels`、`custom_levels`、`memories`、`invite_tokens` 的实际表边界。证据：[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql)、[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)
- Admin Redesign Gap Audit 确认了当前后台的领域错误与信息架构缺口。证据：[admin-web/src/App.tsx](/home/coder/workspaces/yibai/admin-web/src/App.tsx)、[admin-web/src/lib/admin/repository.ts](/home/coder/workspaces/yibai/admin-web/src/lib/admin/repository.ts)、[admin-web/src/features/content/ContentManagementPage.tsx](/home/coder/workspaces/yibai/admin-web/src/features/content/ContentManagementPage.tsx)

## 1. 经证据确认的产品领域词汇表

以下词汇只收录被审计证据直接支持的术语，不引入未验证的新名词作为用户界面主词。

| 术语 | 定义 | 证据 |
|---|---|---|
| 事情 / level / 事 | 产品的核心对象，既可来自系统内置库，也可来自家庭自定义。 | App 产品审计结论；[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)、[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx) |
| 内置事情 | 来自 `levels` 表与推荐 RPC 的系统内容，带编号、推荐逻辑、年龄权重、季节适配和插画回退。 | App 产品审计；[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)、[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) |
| 家庭自定义事情 | 家庭成员创建的家庭私有事情，归家庭边界管理。 | App 产品审计；[src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)、[src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx) |
| 记忆 / memory | 一条完成后的记录，承载孩子、事情、时间、地点、内容、媒体和封存信息。 | App 产品审计；[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)、[src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx) |
| 记录方式 | 语音、照片、视频、文本。 | App 产品审计；[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx) |
| 为什么值得做 | 事情的动机说明，App 端以 `why` 展示。 | App 产品审计；[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)、[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx) |
| 可以怎么做 | 事情的玩法说明，App 端以 `how` 展示。 | App 产品审计；[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx) |
| 记录些什么 | 事情的记录提示，App 端以 `record` 展示，并在记录流程第 0 步引导。 | App 产品审计；[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx) |
| 推荐记录方式 / suggest | 对该事情最适合的记录形式；V1 中它必须与允许记录方式分离，且推荐值必须属于允许集合。 | App 产品审计；[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)、[src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| 插画 / 封面 | 系统插画归属事情版本；无系统插画时才回退到 motif。家庭上传封面属于家庭私有，不可跨家庭复用。 | App 产品审计；[src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)、[src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| 封存 | 事情或记录的封存状态；内置事情和记录都能出现封存语义。 | App 产品审计；[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)、[src/screens/SealedPage.tsx](/home/coder/workspaces/yibai/src/screens/SealedPage.tsx) |
| 家庭 | 共享孩子、记忆、自定义事情和邀请的共享边界。 | Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql) |
| 家庭成员 | 家庭内的成员记录，含角色与自定义角色。 | Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql) |
| 邀请令牌 | 临时分享载体，承载事情与孩子快照。 | Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql)、[supabase-docker/volumes/functions/yaoji/index.ts](/home/coder/workspaces/yibai/supabase-docker/volumes/functions/yaoji/index.ts) |
| 审核 | 管理后台对记忆及未来其他对象的治理动作，不等于内容本身。 | Admin Redesign Gap Audit；[admin-web/src/features/content/ContentManagementPage.tsx](/home/coder/workspaces/yibai/admin-web/src/features/content/ContentManagementPage.tsx) |
| 插画与家庭封面 | 系统事情版本插画字段、motif 回退、家庭私有封面治理。 | `product-rules-v1.md` PR-08 / PR-09；Admin Redesign Gap Audit 的历史缺口 |

### 词汇调和规则

- 后台主词使用“事情”，不要继续把主对象叫“内容”或“任务”。
- “记忆”只表示完成记录，不表示模板、事情定义或内容库。
- “模板”是面向生产与发布的版本化定义，不等同于 App 里的单个事情卡片。
- “活动”如果当前没有独立持久化实体，就只能作为派生洞察，不得作为正式 CRUD 对象。

这些调和规则来自：

- App 产品审计对真实用户路径的确认
- Database Domain Audit 对现有表结构的确认
- Admin Redesign Gap Audit 对后台误建模的否定性证据

## 2. 事情、模板、实例、完成记录之间的关系

### 2.1 确认总模型

管理后台采用四层结构：

1. `thing` 或 `activity` 作为抽象业务对象
2. `activity_version` 作为可发布的版本
3. `activity_instance` 或 `assignment` 作为一次家庭场景下的可执行实例
4. `activity_record` 作为真正完成后的记录

### 2.2 对现有对象的映射

| 现有对象 | 归位 | 说明 | 证据 |
|---|---|---|---|
| `public.levels` | 系统事情定义 + 版本快照 | 目前是系统内置内容库，适合作为系统版本源。 | Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql) |
| `public.custom_levels` | 家庭事情定义 | 当前是家庭私有内容，应视为家庭自定义版本源。 | Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql) |
| `public.invite_tokens` 的 level_* 快照 | 临时实例快照 | 它是分发和邀请用的瞬时快照，不是主真相。 | Database Domain Audit；[supabase-docker/volumes/functions/yaoji/index.ts](/home/coder/workspaces/yibai/supabase-docker/volumes/functions/yaoji/index.ts) |
| `public.memories` | 完成记录 | 它是唯一稳定的完成层，但仍需从“定义层”中剥离。 | App 产品审计；[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)、Database Domain Audit；[supabase-docker/volumes/db/init/schema.sql](/home/coder/workspaces/yibai/supabase-docker/volumes/db/init/schema.sql) |

### 2.3 确认关系原则

- 系统内置事情由平台维护并版本化发布。
- 家庭自定义事情家庭私有。
- 完成记录在完成时必须绑定事情版本和快照。
- 邀请和分享只引用版本快照，不直接持久化为主定义。
- V1 只支持系统事情复制为家庭事情，不支持家庭字段覆盖或自动同步。

### 2.4 对现有冲突的调和

#### 冲突 A：App 端把 `levelNum` 当作事情引用，数据库里又有 `custom_levels.id`

调和方案：

- 短期保留 `memories.level_num` 的兼容引用方式。
- 后台和新模型中引入稳定 `activity_id` 与 `activity_version_id`。
- 将 `level_num` 解释为旧兼容键，而不是未来唯一主键。

证据：

- App 产品审计指出记录入库时写入 `levelNum`。
- Database Domain Audit 指出 `levels` 与 `custom_levels` 目前是双表分裂。

#### 冲突 B：`suggest_mode` 与 `allowed_capture_modes` 的关系

调和方案：

- `suggest_mode` 与 `allowed_capture_modes` 分离。
- 推荐值必须包含在允许集合内。
- 后台只展示与校验这两个字段，不再把二者混写成一个隐式配置。

证据：

- App 产品审计明确写出 `suggest` 更像“最适合的记录形式”，不是严格校验唯一形式。
- Database Domain Audit 指出记录 payload 仍欠缺与类型一一对应的约束。

#### 冲突 C：当前后台把活动当成由记忆和推送派生的假对象

调和方案：

- 取消“活动 = 派生统计”的假设。
- 若确实存在真实活动配置，再单独建表。
- 在真实实体未出现前，`activities` 页面只能降级为只读洞察页。

证据：

- Admin Redesign Gap Audit 指出 `activities` 是由 `memories` 和 `notification_outbox` 派生出来的前端假对象。

## 3. 事情字段完整定义

以下字段定义面向新后台的统一事情模型。对于系统内置事情与家庭自定义事情，允许字段来源不同，但字段语义应一致。

### 3.1 核心字段

| 字段 | 含义 | 是否必填 | 来源证据 |
|---|---|---|---|
| `id` | 事情唯一标识 | 是 | Database Domain Audit |
| `source_type` | 来源类型，V1 以 `system` / `family` / `draft` 表达 | 是 | Database Domain Audit + Admin Redesign Gap Audit + [`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| `source_key` | 稳定业务键，例如内置编号或家庭内部键 | 是 | App 产品审计：[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) |
| `title` | 事情标题 | 是 | App 产品审计：[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx) |
| `why` | 为什么值得做 | V1 必填 | App 产品审计：[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx) |
| `how` | 可以怎么做 | V1 必填 | App 产品审计：[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx) |
| `record_hint` / `record` | 记录些什么 | V1 必填 | App 产品审计：[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx) |
| `suggest_mode` | 推荐记录方式 | V1 必填，且必须属于允许集合 | App 产品审计：[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| `allowed_capture_modes` | 允许的记录方式白名单 | V1 必填 | Database Domain Audit、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| `perspective` | `parent` / `child` / `together` 视角 | 视对象而定 | App 产品审计：[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx) |
| `tone` | 语气 / 风格 | 可选 | Database Domain Audit |
| `category` | 分类 | 可选 | App 产品审计：[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql) |
| `scene` | 场景标签 | 可选 | App 产品审计：[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql) |
| `tags` | 检索标签 | 可选 | App 产品审计：[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql) |
| `min_age` / `max_age` | 年龄范围 | 可选 | App 产品审计：[supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql) |
| `seasonal` | 是否季节限定 | 可选 | App 产品审计：[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx) |
| `sealed` | 是否封存 | 可选 | App 产品审计：[src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) |
| `seal_until` | 封存截至时间 | 条件必填 | App 产品审计：[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx) |
| `seal_kind` | 封存规则类型 | 可选 | Database Domain Audit |
| `published_at` | 发布时间 | 版本发布必填 | Database Domain Audit |
| `status` | `draft` / `published` / `archived` / `deleted` | 是 | Database Domain Audit + Admin Redesign Gap Audit |
| `version` | 版本号 | 是 | Database Domain Audit |
| `family_id` | 家庭归属 | 家庭事情必填 | Database Domain Audit |
| `created_by` | 创建人 | 是 | Database Domain Audit |
| `updated_by` | 最近编辑人 | V1 推荐必填 | Admin Redesign Gap Audit |
| `illustration_path` | 插画或封面路径的兼容字段 | V1 可选；系统插画归属事情版本，motif 仅回退 | App 产品审计：[src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| `illustration_source` | 插画来源，系统/家庭/上传/占位 | V1 推荐必填 | Admin Redesign Gap Audit、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |
| `copy_of_activity_id` | 复制来源 | 复制时必填 | Admin Redesign Gap Audit、[`product-rules-v1.md`](/home/coder/workspaces/yibai/docs/admin-redesign/product-rules-v1.md) |

### 3.2 字段解释与产品含义

#### 插画

- 插画不是装饰字段，而是事情的一部分。
- 系统插画直接属于事情版本，motif 只作为回退。
- 家庭封面属于家庭私有。
- 后台必须能查看插画是否来自版本字段、家庭私有封面或 motif 回退。

证据：

- App 产品审计：[src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)
- App 产品审计：[src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)
- Admin Redesign Gap Audit 对插画/封面治理缺口的历史确认

#### 为什么值得做

- 这是事情的价值解释，应该在详情和列表里都能解释清楚。
- 后台可将其作为内容审核与产品编辑的核心质量指标。

证据：

- App 产品审计：[src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)

#### 可以怎么做

- 这是确认的版本化编辑要求。
- 应允许产品编辑多个版本，但上线版本只保留一个当前主版本。

证据：

- App 产品审计：[src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)

#### 记录些什么

- 这是完成记录的内容导向，应当清晰、短句化、可被多记录方式承载。

证据：

- App 产品审计：[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)

#### 允许记录方式

- 允许范围与推荐值分离。
- 推荐值必须属于允许范围。
- 文本、照片、视频、语音的组合应在模型层面表达，不应只在 UI 层临时判断。

证据：

- App 产品审计：[src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- Database Domain Audit 的记录模型缺口结论

## 4. 生命周期：发布、版本、下架、复制、家庭覆盖

### 4.1 生命周期定义

| 阶段 | 含义 | 可执行动作 |
|---|---|---|
| 草稿 | 未发布，仅编辑可见 | 编辑、复制、预览、删除 |
| 已发布 | 当前对目标范围生效的版本 | 复制新版本、下架 |
| 已下架 / 已归档 | 不再参与新流量分发，但保留历史 | 恢复、复制、审计查看 |
| 已删除 | 逻辑删除或物理删除，取决于对象级策略 | 仅限高权限操作 |

### 4.2 发布规则

- 系统内置事情由内容编辑或管理员发布，且必须通过完整字段校验。
- 家庭自定义事情允许快速创建，但不套用系统级完整发布校验。
- 记录层不会因为事情发布而回写事实数据，记录一旦产生应保持不可变。

### 4.3 版本规则

- 每次内容重写都应生成新版本，而不是直接改掉已发布版本。
- App 端历史记录必须回指当时的版本快照。
- invite payload 只存版本快照，不应作为主版本存储。

### 4.4 下架规则

- 下架后不再出现在新推荐或新列表中。
- 既有记录仍保留，历史回放仍应可读。
- 下架动作必须进入审计。

### 4.5 复制规则

- 系统内置事情可以复制成家庭可编辑副本。
- 家庭副本复制后应保留来源链路。
- 复制不是覆盖，复制后应生成新的 `activity_id` 或新的家庭分支。
- V1 不提供家庭字段覆盖页面，也不提供家庭覆盖流程。

证据依据：

- App 产品审计确认家庭自定义事情和内置事情在 App 内明确区分。
- Database Domain Audit 指出当前没有显式“发布/覆盖/版本”模型。
- Admin Redesign Gap Audit 指出后台缺少版本、发布、复制、家庭覆盖的工作流。

## 5. 确认数据库模型和迁移阶段

本节是基于已确认规则的目标设计，不是对当前已存在事实的声明。

### 5.1 确认模型

#### `activities`

统一事情主体，承载稳定身份与归属信息。

#### `activity_versions`

承载具体文案、插画、推荐方式、允许记录方式、发布状态和版本号。

#### `activity_records`

承载一次真实完成，替代继续把完成语义混在定义层里。

#### `activity_record_media`

承载记录的媒体附件，避免把所有媒体都塞进单表字段。

#### `activity_audit_log`

承载对事情、版本、发布、下架的审计事件。

### 5.2 推荐字段摘要

| 表 | 关键字段 |
|---|---|
| `activities` | `id`, `source_type`, `source_key`, `family_id`, `created_by`, `current_version_id`, `status`, `created_at`, `updated_at` |
| `activity_versions` | `id`, `activity_id`, `version`, `title`, `why`, `how`, `record_hint`, `suggest_mode`, `allowed_capture_modes`, `illustration_path`, `illustration_source`, `perspective`, `tone`, `category`, `scene`, `tags`, `min_age`, `max_age`, `seasonal`, `sealed`, `seal_until`, `seal_kind`, `published_at`, `published_by`, `locale`, `copied_from_version_id` |
| `activity_records` | `id`, `family_id`, `kid_id`, `activity_id`, `activity_version_id`, `recorded_by`, `primary_capture_mode`, `capture_type`, `title`, `caption`, `transcript`, `duration`, `shots`, `place`, `recorded_at`, `sealed`, `seal_until`, `seal_label`, `moderation_status`, `moderation_note` |
| `activity_record_media` | `id`, `record_id`, `kind`, `storage_path`, `mime_type`, `duration`, `width`, `height`, `order_index` |

### 5.3 迁移阶段

#### 阶段 1: 只读映射

- 建立新表或视图，先映射现有 `levels`、`custom_levels`、`memories`。
- 不改 App 和后台写路径。
- 先让管理后台能读统一模型。

验收：

- 后台能展示系统内置事情、家庭自定义事情和完成记录的统一列表。
- 不丢现有数据。

#### 阶段 2: 双写准备

- 新增后台写入能力，但旧表继续兼容。
- 先保证复制、发布、下架和版本回看可跑通，再讨论更深层迁移。

验收：

- 新建、编辑、发布、复制都可以在新模型跑通。
- 旧页面仍可读旧数据。

#### 阶段 3: 记录层解耦

- 将记录媒体与记录元信息拆分。
- `memories` 逐步退化为兼容视图或只读桥接表。

验收：

- 新记录能按版本快照写入。
- 附件能独立检索和审计。

#### 阶段 4: 旧模型收口

- 逐步停止直接写 `levels`、`custom_levels`、`memories` 的新语义字段。
- 旧表保留兼容读路径，直到迁移完成。

验收：

- 后台主路径完全基于新模型。
- 旧表仅承担兼容或归档职责。

### 5.4 迁移风险

数据库审计已经指出的高风险耦合点仍然成立：

- `src/data/index.ts`
- `src/data/DataProvider.tsx`
- `admin-web/src/lib/admin/supabaseRepository.ts`
- `supabase-docker/volumes/functions/yaoji/index.ts`
- `supabase-docker/volumes/db/init/schema.sql`

迁移时必须避免：

- 双写漂移
- `level_num` 旧引用失效
- 存储路径约定被破坏
- 现有后台直接 `select('*')` 的路径断裂

证据来源：

- Database Domain Audit 的迁移风险段落

## 6. 新管理后台信息架构与逐页功能

### 6.1 信息架构

主导航如下：

1. 数据总览
2. 事情库
3. 模板中心
4. 完成记录
5. 家庭与用户
6. 插画与家庭封面
7. 审核中心
8. 消息与触达
9. 审计与安全
10. 系统设置

这一定义同时吸收了：

- Admin Redesign Gap Audit 的“按对象 + 生命周期重组”结论
- Database Domain Audit 对后台治理边界的要求
- App 产品审计对用户真实入口的事实

### 6.2 数据总览

功能：

- 真实聚合指标
- 近日报表
- 异常告警
- 发布/下架/审核概览

不做：

- 伪 demo 表格
- 派生对象冒充正式业务实体

### 6.3 事情库

功能：

- 查看系统内置事情
- 查看家庭自定义事情
- 新建、编辑、复制、发布、下架、归档
- 按来源、年龄、场景、季节、标签、封存状态筛选
- 查看版本历史

必须展示：

- 标题
- 来源
- 当前版本
- 允许记录方式
- 推荐记录方式
- 插画来源
- 是否封存

### 6.4 模板中心

功能：

- 模板草稿
- 版本管理
- 发布
- 复制为家庭事情
- 历史版本
- 适用范围
- 使用统计

必须支持：

- 从系统内置事情生成可复制模板
- 预览后发布
- 版本回滚
- 明确哪些能力属于 V1 复制，哪些留待后续

### 6.5 完成记录

功能：

- 列表与搜索
- 审核
- 媒体查看
- 封存管理
- 记录来源回溯到事情版本

必须显示：

- 家庭
- 孩子
- 事情
- 版本
- 记录方式
- 媒体
- 时间
- 审核状态

### 6.6 家庭与用户

功能：

- 家庭概览
- 家庭成员
- 邀请状态
- 成员角色
- 关联记录概览

不要再只做：

- 基于 `memories` 的反向统计浏览
- 家庭字段覆盖配置页

### 6.7 插画与家庭封面

功能：

- 系统事情版本插画字段管理
- 家庭私有封面治理查看
- motif 回退识别
- 使用位置
- 版本继承与历史快照

说明：

- 系统插画不进入独立系统资产库，也不作为独立资产实体暴露给新后台契约。
- 兼容期如保留 `list assets`，只能从版本字段派生，不能成为新写路径。
- 家庭上传封面不进入公共复用池，只做家庭私有治理。

### 6.8 审核中心

功能：

- 记忆审核
- 模板审核
- 资产审核
- 敏感内容查看
- 审核动作日志

说明：

- 审核中心只做治理，不承担内容总管理入口职责。

### 6.9 消息与触达

功能：

- 推送模板
- 队列
- 重试
- 失败诊断
- 设备与家庭统计

说明：

- 不能继续把模板做成前端本地数组。

### 6.10 审计与安全

功能：

- 审计日志
- 敏感操作追踪
- 角色映射
- 权限检查结果
- 数据导出追踪

### 6.11 系统设置

功能：

- 环境状态
- 数据源模式
- 只读/可写提示
- 功能开关
- 风险提示

## 7. 权限、RLS、审计边界

### 7.1 总原则

- 家庭数据默认只在家庭内可见。
- 管理员不能用前端页面绕过数据边界。
- 审核、支持、内容治理需要最小权限集合。
- 审计必须覆盖敏感写操作，而不是只覆盖少数页面操作。

### 7.2 家庭侧边界

根据数据库审计，当前已有的家庭边界包括：

- `families`
- `family_members`
- `kids`
- `memories`
- `custom_levels`
- `invite_tokens`
- `notification_preferences`

这些对象在新后台中仍应保持家庭隔离逻辑。

### 7.3 管理员侧边界

管理后台应显式区分以下权限：

| 权限 | 含义 |
|---|---|
| 内容编辑 | 查看与编辑事情、版本、资产与记录相关内容 |
| 内容审核 | 修改审核状态与备注 |
| 家庭支持 | 查看家庭结构和关联内容 |
| 系统管理员 | 管理系统设置、权限与高风险动作 |

### 7.4 RLS 边界

应坚持以下边界：

- 业务表遵循家庭或管理员最小授权
- 审计表只增不改
- 版本表尽量不可变
- 发布动作与审核动作必须有独立审计事件

### 7.5 审计边界

必须进入审计的动作：

- 创建
- 编辑
- 发布
- 下架
- 复制
- 删除
- 审核状态变更
- 成员或家庭支持动作

证据：

- Database Domain Audit 已指出 `admin_audit_log` 存在，但覆盖仍不足。
- Admin Redesign Gap Audit 已指出当前仅有少量写操作和缺失的显式权限矩阵。

## 8. 现有 admin-web 保留、重构、删除清单

### 8.1 保留

保留但需重定位职责：

- [admin-web/src/features/users/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/users/index.tsx)
- [admin-web/src/features/families/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/families/index.tsx)
- [admin-web/src/features/audit/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/audit/index.tsx)
- [admin-web/src/features/settings/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/settings/index.tsx)

保留理由：

- 它们至少接近真实业务对象或基础治理对象。

### 8.2 重构

必须重构：

- [admin-web/src/App.tsx](/home/coder/workspaces/yibai/admin-web/src/App.tsx)
- [admin-web/src/components/app-sidebar.tsx](/home/coder/workspaces/yibai/admin-web/src/components/app-sidebar.tsx)
- [admin-web/src/features/content/ContentManagementPage.tsx](/home/coder/workspaces/yibai/admin-web/src/features/content/ContentManagementPage.tsx)
- [admin-web/src/features/activities/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/activities/index.tsx)
- [admin-web/src/features/notifications/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/notifications/index.tsx)
- [admin-web/src/lib/admin/types.ts](/home/coder/workspaces/yibai/admin-web/src/lib/admin/types.ts)
- [admin-web/src/lib/admin/repository.ts](/home/coder/workspaces/yibai/admin-web/src/lib/admin/repository.ts)
- [admin-web/src/lib/admin/supabaseRepository.ts](/home/coder/workspaces/yibai/admin-web/src/lib/admin/supabaseRepository.ts)

重构原因：

- 当前这些文件把错误领域假设写死了，尤其是把 `memories` 当成唯一内容对象。

### 8.3 删除或降级

删除或降级：

- [admin-web/src/features/activities/index.tsx](/home/coder/workspaces/yibai/admin-web/src/features/activities/index.tsx)

处理建议：

- 若未出现真实活动实体，则不要让它继续作为主导航页存在。
- 可降级成只读“活动洞察”页，或暂时移除。

## 9. 分阶段实施计划及验收标准

### 阶段 0: 定义冻结

目标：

- 冻结词汇表
- 冻结后台主导航
- 冻结新模型边界

验收：

- 所有人统一使用“事情 / 版本 / 记录 / 资产”这些词。
- 不再在新设计中把“内容管理”当总入口。

### 阶段 1: 只读统一视图

目标：

- 先打通统一读模型
- 不改现有写路径

验收：

- 后台可以同时看到系统内置事情、家庭自定义事情和完成记录。
- 读模型能标明来源、版本、家庭归属。

### 阶段 2: 新后台骨架

目标：

- 重做导航和页面职责
- 拆出事情库、模板中心、插画与家庭封面治理、审核中心

验收：

- 每个页面只有一个主职责。
- 不再存在“同一页承担内容管理和内容审核”的情况。

### 阶段 3: 版本与发布

目标：

- 引入版本化编辑
- 支持发布、下架、复制

验收：

- 每次发布都有版本号和审计记录。
- 复制链路能明确追溯来源。

### 阶段 4: 记录解耦

目标：

- 记录层独立
- 媒体附件独立

验收：

- 完成记录和事情定义不再共享一个模糊对象。
- 记录能回溯到版本快照。

### 阶段 5: 权限与审计收口

目标：

- 完善 RLS
- 完善审计
- 完善管理员最小权限矩阵

验收：

- 每个敏感动作都有审计。
- 管理员无法越权访问家庭私有数据。

## 10. 尚需产品确认的问题

以下问题仍需产品确认后再进入实现，不应由后台自行猜测。

1. 事情 `version` 的作用域是全局递增还是按来源类型递增。
2. 语音转写和自动摘要字段归属于记录正文、记录元数据还是独立衍生字段。
3. 旧表 `levels`、`custom_levels`、`memories` 的兼容期多久。
4. `activities` 洞察页是保留为只读页面还是在后续版本中移除。
5. 系统插画版本元数据需要记录到什么粒度，是否区分来源、授权和有效期。

## 11. 设计底线

- 不要把派生数据伪装成正式业务实体。
- 不要把 `memory` 继续当作事情定义。
- 不要让模板留在前端本地数组。
- 不要把“内容管理”和“内容审核”做成同一个入口。
- 不要在没有版本、发布、复制语义之前就上线重构后的编辑页。
- 不要把家庭字段覆盖写成 V1 已支持能力。

## 12. 本蓝图的证据边界

本蓝图只使用了三份审计中的证据及其指向的原始文件：

- App 产品审计：确认真实术语、真实链路、真实字段
- Database Domain Audit：确认真实表结构、RLS、审计与迁移风险
- Admin Redesign Gap Audit：确认 admin-web 的误建模、缺页和重构范围

当产品确认项被答复后，应再补一版实施方案，把确认项落到实现级别。
