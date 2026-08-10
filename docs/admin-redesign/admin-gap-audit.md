# Admin Redesign Gap Audit

审计目标：对照真实领域需求，识别 `admin-web` 当前实现里不合理、混淆或缺失的部分，并给出可落地的后台重构方向。

审计范围：
- `src/App.tsx`
- `src/components/app-sidebar.tsx`
- `src/features/*`
- `src/lib/admin/*`
- `docs/admin-data-contract.md`

结论先行：
- 当前后台把“内容 / 记忆 / 活动 / 审核 / 推送”混成了一层，且大量页面在用派生数据、本地状态或 demo 数据伪装成正式后台。
- 最严重的问题不是 UI 样式，而是领域模型错误：`memories` 被当作内容审核对象、活动来源、用户活动记录和家庭统计来源，导致页面职责、数据契约和权限边界全部漂移。
- 当前信息架构更像“通用运营面板”，不是“面向一百件事业务对象的管理后台”。

## 严重度总览

### P0
- 把 `memory` 当成了 `content` 的唯一管理对象，且内容管理页实际承担审核页职责。见 `src/App.tsx:18-38`、`src/components/app-sidebar.tsx:31-44`、`src/features/content/ContentManagementPage.tsx`、`src/lib/admin/repository.ts:187-210`。
- 把活动配置建模成“由记忆和推送队列派生的前端假对象”，而不是独立业务实体。见 `src/features/activities/index.tsx:84-121`、`src/features/activities/index.tsx:183-262`。
- 把推送模板做成前端本地数组，不受 repository / 数据契约管理。见 `src/features/notifications/index.tsx:31-105`、`src/features/notifications/index.tsx:173-272`、`src/lib/admin/types.ts:125-139`。

### P1
- 当前后台缺少“系统内置内容”和“家庭自定义来源”的区分，所有内容都按单一 `memories` 处理。见 `src/lib/admin/types.ts:71-103`、`src/features/content/ContentManagementPage.tsx:283-314`、`src/features/families/index.tsx:186-226`。
- 缺少插画资产管理入口与数据契约；`src/lib/admin/types.ts` 没有任何资产表/字段，`src/App.tsx` 和 `src/components/app-sidebar.tsx` 也没有对应导航。
- 缺少“为什么值得做、怎么做、记录什么、可用记录方式”的模板/内容生产工作流页面；现在只看到审核和展示，没有模板生命周期管理。见 `src/features/content/ContentManagementPage.tsx`、`src/features/activities/index.tsx`、`src/features/notifications/index.tsx`。

### P2
- 导航命名和页面职责不一致，多个入口指向同一页面或同一页面承担多个完全不同职责。见 `src/components/app-sidebar.tsx:31-49`。
- `createAdminRepository()` 会在会话恢复失败时降级到 demo repository，导致很多页面在“看起来可用”与“真实可操作”之间失真。见 `src/lib/admin/repository.ts:7-19`、`src/lib/admin/demoRepository.ts:111-165`。
- `docs/admin-data-contract.md` 只描述了现有表和权限前提，没有描述真实产品必须的“模板、来源、资产、版本、发布、复制、家庭覆盖、统计”对象，因此契约本身已经落后于需求。见 `docs/admin-data-contract.md:37-77`。

## 真实需求对照

结合现有实现和你明确指出的业务要求，真实后台至少需要表达这些概念：
- 事情/内容的生成来源：系统内置、家庭自定义、模板衍生、人工草稿、活动产物。
- 插画资产管理：资产库、关联模板、复用、替换、上下线。
- 模板生命周期：草稿、版本、发布、复制、历史版本、回滚、家庭覆盖、使用统计。
- 内容生产说明：为什么值得做、怎么做、要记录什么、可用记录方式。
- 审核与运营：不是只有“memory 审核”，而是围绕不同对象和不同生命周期阶段的处理。

当前代码只覆盖了其中非常窄的一部分，而且很多地方是伪实现。

## 详细差距

### 1) 后台错误地把“事情”混同为 `memory` / `content`

问题表现：
- 顶层页面用 `content` 这个名词，但数据来源全部是 `memories`。`src/App.tsx:18-38` 只定义了 `content: "内容管理"`，实际渲染的是 `ContentManagementPage`。
- `ContentManagementPage` 的标题是“内容管理与审核”，但列表、筛选、批量操作全部围绕 `MemoryRow`，接口调用的是 `listContentReview()`，本质是审核 `memories`。见 `src/features/content/ContentManagementPage.tsx:263-343`、`src/lib/admin/repository.ts:187-210`。
- 搜索字段包含 `memory.caption`、`memory.transcript`、`kidId`、`familyId`、`author`，说明它不是单纯内容库，而是“家庭记忆审核台”。见 `src/features/content/ContentManagementPage.tsx:132-145`、`src/features/content/ContentManagementPage.tsx:283-287`。
- 页面文案用“记忆内容”“内容审核”“审核队列”交替出现，表明命名没有固定领域词汇。见 `src/features/content/ContentManagementPage.tsx:329-370`、`src/components/app-sidebar.tsx:35-43`。

为什么不合理：
- “事情”如果是业务对象，应该能区分它是什么类型、来自哪里、是否模板化、是否系统生成、是否家庭创建、是否可复用。
- 当前 `MemoryRow` 只有 `type`、`title`、`caption`、`transcript`、`sealed`、`moderationStatus`，没有“来源”“模板关联”“资产关联”“版本”“发布状态”等关键字段。见 `src/lib/admin/types.ts:278-293`。
- 这会把后台重心错误地压到“审核内容”，而不是“管理业务对象生命周期”。

受影响流程：
- 内容审核
- 内容创建来源识别
- 模板和资产复用
- 数据统计口径

### 2) 缺少系统内置与家庭自定义来源

问题表现：
- `memories` 只有 `family_id`、`user_id`、`kid_id`、`level_num`、`perspective`，没有来源字段。见 `src/lib/admin/types.ts:71-103`。
- `ContentManagementPage` 只能从 `familyId`、`userId`、`inviteCode` 猜上下文，无法表达“这是系统内置内容还是家庭自定义内容”。见 `src/features/content/ContentManagementPage.tsx:283-287`、`src/features/content/ContentManagementPage.tsx:601-633`。
- `FamiliesPage` 只统计成员、孩子、记录数、邀请信息，仍然是围绕 `memories` 的回看，而不是围绕“家庭内容来源与覆盖关系”。见 `src/features/families/index.tsx:172-226`、`src/features/families/index.tsx:359-464`。

为什么不合理：
- 真实产品里，系统内置内容和家庭自定义内容通常决定了可编辑性、可复制性、默认版本、覆盖规则、统计归属。
- 不分来源，后续就无法做模板复用、运营默认值、家庭 override、内容治理。

受影响流程：
- 内容创建
- 复制/继承
- 家庭覆盖
- 数据分析

### 3) 缺少插画资产管理

问题表现：
- `src/lib/admin/types.ts` 里没有任何 asset / illustration 表或字段。
- `src/App.tsx:20-38`、`src/components/app-sidebar.tsx:31-49` 没有插画资产入口。
- `ContentManagementPage` 只支持 `text/photo/voice/video`，但没有“插画资产库、资产元信息、使用位置、替换、版本、发布状态”的任何概念。见 `src/lib/admin/types.ts:278-293`、`src/features/content/ContentManagementPage.tsx:560-656`。

为什么不合理：
- 如果产品的内容产出依赖插画资产，后台没有资产库就无法支撑模板配置、跨模板复用和视觉统一。
- 这不是“以后再加”的小功能，而是内容生产链条的一部分。

受影响流程：
- 模板制作
- 内容生成
- 复用与统一风格

### 4) 缺少“为什么值得做、怎么做、记录什么、可用记录方式”

问题表现：
- 现有后台只管理“已产出的记忆”和“推送记录”，没有面向生产流程的配置页面。见 `src/features/content/ContentManagementPage.tsx`、`src/features/notifications/index.tsx`、`src/features/activities/index.tsx`。
- `ActivitiesPage` 不是活动配置，而是把 `memories` 和 `notification_outbox` 派生成人工假活动。见 `src/features/activities/index.tsx:84-121`。
- `NotificationsPage` 的模板完全是 `defaultTemplates` 本地数组，且页面明确写了“契约未暴露模板读取/写入接口”。见 `src/features/notifications/index.tsx:31-105`、`src/features/notifications/index.tsx:356-380`。

为什么不合理：
- 真正的后台应该先定义内容生产策略：为什么做、针对谁做、要记录什么、用什么记录方式承载（文本、语音、图片、视频、插画、混合）。
- 现在后台只在“事后审核”和“事后推送”上打转，无法支持内容设计与策略配置。

受影响流程：
- 模板设计
- 内容生产
- 记录方式选择
- 运营策略配置

### 5) 缺少模板生命周期、版本、发布、复制、家庭覆盖、使用统计

问题表现：
- `notification_templates` 只在 `src/lib/admin/types.ts:125-139` 中出现，但 repository 根本没有读写模板的方法。
- `NotificationsPage` 里的模板是本地 `TemplateRow[]`，`saveTemplate()` 只改前端状态，`source` 也只是 `"demo" | "local"`。见 `src/features/notifications/index.tsx:31-105`、`src/features/notifications/index.tsx:251-273`。
- 没有 `version`、`publishedAt`、`publishedBy`、`copiedFrom`、`familyOverride`、`usageCount` 等字段。见 `src/lib/admin/types.ts:125-139`。
- 当前模板只有“编辑”和“创建默认推送”，没有发布流、版本流、复制流、家庭覆盖流、统计流。见 `src/features/notifications/index.tsx:348-580`。

为什么不合理：
- 模板是运营和内容生产的核心资产，不是一个临时表单。
- 没有版本和发布，就无法复现历史、回滚、灰度、统计使用情况，也无法回答“哪个版本被哪个家庭覆盖了”。

受影响流程：
- 模板草稿与审核
- 发布与回滚
- 家庭级覆盖
- 使用统计与归因

### 6) 当前信息架构、命名、CRUD 和权限不匹配真实产品

问题表现：
- 导航把“内容管理”和“内容审核”拆成两个入口，但都指向 `content` 页面。见 `src/components/app-sidebar.tsx:31-44`。
- `navSecondary` 里“帮助中心”和“全局搜索”分别跳到 `settings` 和 `users`，明显是占位而非真实导航。见 `src/components/app-sidebar.tsx:46-50`。
- `activities` 只是派生视图，不应该和真实可配置对象混在主导航。见 `src/features/activities/index.tsx:183-262`。
- `users` / `families` 页面更像“横向浏览器”，不是明确的管理动作入口。见 `src/features/users/index.tsx:122-216`、`src/features/families/index.tsx:129-241`。
- `SupabaseAdminRepository` 只实现了部分只读列表和两种写入：`updateMemoryModeration()`、`updateNotificationPreferences()`、`writeAuditLog()`。见 `src/lib/admin/repository.ts:151-303`。

为什么不合理：
- 真实后台的导航应该按对象和生命周期组织，而不是按页面拼凑。
- 当前 CRUD 只有“看、筛、改状态”，没有“新建、复制、发布、版本、覆盖、禁用、回收、归档”等必要动作。
- 权限也停留在“admin_role 是否存在”的粗粒度判断，页面层没有按角色定义职责分区。见 `docs/admin-data-contract.md:8-15`、`docs/admin-data-contract.md:62-77`、`src/lib/admin/types.ts:227-237`。

受影响流程：
- 日常运营入口
- 角色分工
- 对象生命周期管理

## 应保留 / 重做 / 删除

### 保留
- `src/features/users/index.tsx`
- `src/features/families/index.tsx`
- `src/features/audit/index.tsx`
- `src/features/settings/index.tsx`

保留原因：
- 这些页面至少在对象层面接近真实业务对象：用户、家庭、审计、系统状态。
- 但它们仍需要重命名和重切分职责，尤其是 `users` 和 `families` 目前严重依赖 `memories` 派生统计。

### 重做
- `src/features/content/ContentManagementPage.tsx`
- `src/features/notifications/index.tsx`
- `src/features/activities/index.tsx`
- `src/components/app-sidebar.tsx`
- `src/App.tsx`
- `src/lib/admin/types.ts`
- `src/lib/admin/repository.ts`
- `src/lib/admin/supabaseRepository.ts`
- `docs/admin-data-contract.md`

重做原因：
- 这些文件都把错误领域假设写死了。
- 其中 `content`、`activities`、`notifications` 三个页面尤其依赖本地派生数据，不能直接作为真实后台基础。

### 删除或降级为临时页
- `src/features/activities/index.tsx`

建议：
- 如果没有真实活动实体，就不要作为主导航页面保留。
- 可降级为“活动洞察”只读页，或者完全删除，避免继续误导产品与接口设计。

## 建议的新后台导航

建议把后台按“对象 + 生命周期”重组，而不是按现有实现拼接：

1. 数据总览
2. 用户与家庭
3. 内容与记录
4. 模板中心
5. 资产库
6. 审核中心
7. 消息与触达
8. 审计与安全
9. 系统设置

### 页面职责建议

- `数据总览`
  - 只保留真实聚合指标、异常告警、近日报表。
  - 不要再混入临时示例表格。

- `用户与家庭`
  - 用户、家庭、成员关系、邀请关系、家庭覆盖状态。
  - 不要从 `memories` 反向推家庭责任。

- `内容与记录`
  - 统一管理“事情/记录”对象。
  - 必须显示来源：系统内置、家庭自定义、模板生成、人工创建。
  - 必须能区分记录方式：文本、语音、图片、视频、插画、混合。

- `模板中心`
  - 模板草稿、版本、发布、复制、回滚、家庭覆盖、使用统计。
  - 模板不是本地对象，必须进入 repository。

- `资产库`
  - 插画资产、封面图、图标、占位图、版本、授权状态、关联模板。

- `审核中心`
  - 只做审核，不做内容管理总入口。
  - 审核对象应包括内容、模板、资产或其他需要治理的对象。

- `消息与触达`
  - 推送模板、发送队列、失败重试、设备/家庭统计。
  - 不要把模板留在前端本地数组。

- `审计与安全`
  - 审计日志、权限检查、角色映射、敏感操作追踪。

- `系统设置`
  - 环境检查、数据源模式、权限提示、开关。

## 短期止损项

1. 先把 `content` 页面改名为“内容与记录审核”，停止继续暗示这是完整内容管理。
2. 暂时隐藏或降级 `activities` 主导航，避免把派生视图当正式功能。
3. `notifications` 页里的模板编辑不要再假装已接入后端，明确标成“本地预览”，或者移到设置页下的临时区。
4. 让所有列表页都显式显示数据来源：
   - live
   - demo
   - local derived
5. 在 `settings` 页和顶部显著提示：
   - 当前仓库是否只读
   - 当前是否为 demo
   - 当前是否缺少模板/资产/版本相关接口
6. 先补 `docs/admin-data-contract.md`，把缺失的真实对象补进契约，再改页面。

## 具体代码问题清单

- `src/App.tsx:20-38`
  - 页面定义里没有任何“模板中心”或“资产库”。
  - `content` 这一页名过于宽泛，却只落到 `ContentManagementPage`。

- `src/components/app-sidebar.tsx:31-50`
  - 主导航与工具导航互相重复。
  - “内容审核”与“内容管理”指向同一页。
  - “帮助中心”与“全局搜索”是占位跳转。

- `src/lib/admin/types.ts:71-103`
  - `memories` 被定义成单一内容实体，没有来源、版本、模板、资产、可编辑性等字段。

- `src/lib/admin/types.ts:125-139`
  - `notification_templates` 只存在类型里，没有配套 repository。

- `src/lib/admin/types.ts:239-341`
  - `AdminRepository` 缺少模板、资产、来源、版本、复制、发布、统计相关方法。

- `src/lib/admin/repository.ts:7-28`
  - `createAdminRepository()` 把“可连上 Supabase”误当成“可用后台能力”。

- `src/lib/admin/supabaseRepository.ts:151-303`
  - 只读列表和少量写操作不足以支撑真实后台。
  - 重点缺失是模板与资产的读写接口。

- `src/lib/admin/demoRepository.ts:14-165`
  - demo 数据只覆盖 `memory`、`notification_outbox`、`audit_log`，会误导人以为业务只有这些对象。

- `docs/admin-data-contract.md:37-77`
  - 契约范围停留在现有对象，没有表达真实产品要求的模板生命周期、来源分层、资产库和家庭覆盖。

## 推荐的下一步

1. 先定领域模型，不要先补页面。
2. 把“事情/记录”“模板”“资产”“家庭覆盖”四类对象写进数据契约。
3. 再按对象重组后台导航和 repository。
4. 最后才修具体页面交互。
