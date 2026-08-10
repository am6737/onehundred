# 管理后台数据契约 V2

决策基线：`product-rules-v1.md` 的 PR-01 至 PR-15。

适用范围：
- 管理后台的数据读取、写入、审核、发布、归档、审计
- 事情 / 记录 / 版本 / 插画 / 家庭私有封面 / 审核 / 权限 / RLS 的统一契约
- 后台页面的 read model 与 write command 约束

约束：
- 仅描述契约，不提供 SQL、不提供实现代码。
- 不把目标设计写成当前已实现事实。
- 不覆盖 `product-rules-v1.md`、`admin-redesign-blueprint.md`、App、admin-web、Supabase、migration 或任何其他文件。
- 明确区分三层状态：
  - 当前已存在事实
  - V1 已确认目标
  - 尚未实现

---

## 0. 结论

V2 的核心原则只有三条：

1. “事情”是定义实体，“记录”是完成实体，“版本”是发布治理实体。
2. 系统事情与家庭事情共享同一目标模型，但不共享同一治理边界。
3. V1 只确认“系统事情可复制为独立家庭事情”，不引入家庭字段覆盖、`override_of_version_id` 或自动同步。

---

## 1. 状态分层

### 1.1 当前已存在事实

以下事实来自审计材料与已确认规则基线：

- App 侧已经存在系统内置事情、家庭自定义事情、记录、封存、推荐记录方式、插画回退等概念。
- 数据库里已经有 `levels`、`custom_levels`、`memories`、`invite_tokens`、`families`、`family_members` 等实体。
- 管理后台当前对“内容 / 审核 / 活动 / 推送”存在明显混淆，且部分页面依赖派生数据或 demo 数据。

### 1.2 V1 已确认目标

V1 已经确认的产品目标包括：

- 系统事情由平台维护，拥有稳定身份、版本、下架历史。
- 家庭自定义事情家庭私有，支持快速创建。
- 系统事情可以复制为独立家庭事情，且必须保留 `copied_from`。
- `why`、`how`、`record_hint`、`suggest_mode`、`allowed_capture_modes`、`illustration` 必须有明确语义和发布校验。
- 一次记录支持混合媒体，保留 `primary_capture_mode`，并绑定 `activity_id`、`activity_version_id`、必要快照。
- 系统插画归属事情版本；家庭上传封面私有，治理查看受限。
- 四类管理员最小权限明确。

### 1.3 尚未实现

当前尚未实现且不得被本契约伪装为已实现的能力包括：

- 家庭字段覆盖
- `override_of_version_id`
- 自动同步
- 统一的活动主表、版本表、记录表、记录媒体表、审计表的正式落地
- 面向后台的稳定 repository / RPC / RLS 完整实现
- 版本发布、下架、历史版本的全量 UI 和 API

---

## 2. 领域术语

### 2.1 术语定义

| 术语 | 含义 | 状态 |
|---|---|---|
| system activity | 平台维护的系统事情，面向全局可发布与下架 | V1 目标 |
| family custom activity | 家庭私有事情，属于某个家庭边界 | V1 目标 |
| copied family activity | 由系统事情复制出的独立家庭事情 | V1 目标 |
| activity version | 事情的可发布版本 | V1 目标 |
| record | 一次真实完成记录 | V1 目标 |
| record media | 记录的媒体附件集合 | V1 目标 |
| version-owned system illustration | 系统事情版本自带插画字段，不存在独立系统资产实体 | V1 目标 |
| family private cover asset | 家庭私有封面资产，不可跨家庭复用 | V1 目标 |
| moderation case | 审核或治理案件，围绕敏感对象和动作产生 | V1 目标 |
| audit event | 审计事件，记录谁在何时因何理由做了什么 | V1 目标 |

### 2.2 关系总览

- 一个 `activity` 可以拥有多个 `activity_version`。
- 一个 `activity_version` 在发布后可以被多个 `record` 引用。
- 一个 `record` 可以拥有多个 `record_media`。
- 一个 `activity_version` 直接承载系统插画字段；家庭私有封面仍保持家庭边界。
- 一个 `moderation_case` 可以关联一个 activity、version、record、family private cover 或 family 访问动作。
- 每个敏感动作都应产生 `audit_event`。

---

## 3. 目标模型总图

### 3.1 activity

`activity` 是事情的稳定身份层，不承载正文编辑事实。

### 3.2 activity_version

`activity_version` 承载正文、推荐、允许记录方式、封面语义、发布状态、历史版本。

### 3.3 record

`record` 承载一次完成事实，不可被后续版本改写。

### 3.4 record_media

`record_media` 承载混合媒体附件，独立于主记录。

### 3.5 illustration / private covers

- 系统插画属于 `activity_version`，不是独立系统资产实体。
- 家庭封面资产属于家庭私有资产，不能并入系统事情插画。
- 兼容期可保留从版本字段派生的只读 view / RPC，但新后台契约不暴露系统插画资产列表。

### 3.6 governance

- `moderation_case` 负责治理语境。
- `audit_event` 负责不可变审计。

---

## 4. 实体字段定义

以下字段采用 TypeScript 风格说明。`?` 表示可选。

### 4.1 `Activity`

```ts
type ActivitySourceType = 'system' | 'family' | 'copied_family';
type ActivityLifecycleStatus = 'draft' | 'published' | 'archived' | 'unpublished' | 'deleted';
type ActivityVisibility = 'system' | 'family_private' | 'governed';

type Activity = {
  id: string; // 稳定 UUID
  source_type: ActivitySourceType;
  source_key: string; // 稳定业务键，不等同于展示编号
  display_no?: string; // 展示编号，与 UUID 分离
  family_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_version_id?: string | null;
  status: ActivityLifecycleStatus;
  visibility: ActivityVisibility;
  copied_from?: {
    activity_id: string;
    activity_version_id?: string | null;
  } | null;
  deleted_at?: string | null;
};
```

#### 不变量

- `id` 必须是稳定 UUID，不能用展示编号代替。
- `source_key` 必须稳定且可追踪，但不承担展示职责。
- `display_no` 只用于展示，不能作为主键或外键。
- `family_id` 仅对家庭事情或复制出的家庭事情有意义。
- `copied_from` 只记录来源，不代表覆盖关系。
- `status = published` 时，必须有可发布的当前版本。

#### 当前已存在事实

- `levels`、`custom_levels`、`memories` 已分别承载部分事实，但不是上述统一模型。

#### V1 已确认目标

- 系统事情与家庭事情共用 `activity` 身份层。

#### 尚未实现

- 统一主表尚未落地。

### 4.2 `ActivityVersion`

```ts
type CaptureMode = 'text' | 'photo' | 'video' | 'voice';
type SuggestMode = CaptureMode;
type IllustrationSource = 'system_asset' | 'family_private' | 'motif_fallback' | 'none';
type VersionStatus = 'draft' | 'published' | 'archived' | 'unpublished';
type SealRecommendationKind = 'none' | 'until_date' | 'age_based' | 'manual_prompt';

type ActivityVersion = {
  id: string;
  activity_id: string;
  version_no: number;
  status: VersionStatus;
  title: string;
  why: string;
  how: string;
  record_hint: string;
  suggest_mode: SuggestMode;
  allowed_capture_modes: CaptureMode[];
  illustration?: {
    source: IllustrationSource;
    storage_bucket?: string | null;
    storage_path?: string | null;
    mime_type?: string | null;
    width?: number | null;
    height?: number | null;
    alt?: string | null;
    metadata?: Record<string, unknown> | null;
    /**
     * Deprecated compatibility alias for old admin-web clients.
     * New code must use storage_path.
     */
    path?: string | null;
    /**
     * Deprecated compatibility identifier derived from version fields.
     * It is not a foreign key to a system asset entity.
     */
    asset_id?: string | null;
  } | null;
  family_id?: string | null;
  perspective?: 'parent' | 'child' | 'together' | null;
  tone?: string | null;
  category?: string | null;
  scene?: string | null;
  tags?: string[] | null;
  min_age?: number | null;
  max_age?: number | null;
  seasonal?: boolean | null;
  seal_recommendation?: {
    default_state: 'recommend_unsealed' | 'recommend_sealed';
    kind: SealRecommendationKind;
    default_until?: string | null;
    label?: string | null;
    reason?: string | null;
  } | null;
  published_at?: string | null;
  published_by?: string | null;
  drafted_by?: string | null;
  review_approved_at?: string | null;
  review_approved_by?: string | null;
  copied_from_version_id?: string | null;
  created_at: string;
  updated_at: string;
};
```

#### 不变量

- `title`、`why`、`how`、`record_hint`、`suggest_mode`、`allowed_capture_modes` 是发布前核心字段。
- `suggest_mode` 必须属于 `allowed_capture_modes`。
- `allowed_capture_modes` 至少要能表达文字、照片、视频、语音。
- 版本层不得保存 `primary_capture_mode`，主采集方式只属于实际完成记录。
- `seal_recommendation` 只是事情给记录流程的默认建议，不能表达最终封存事实。
- 系统插画字段直接归属于版本；新版本继承插画时复制字段形成快照。
- `illustration.source` 只能表达真实来源，不允许把家庭私有封面伪装成系统插画。

#### 当前已存在事实

- App 端已显式区分 `why`、`how`、`record`、推荐记录方式。
- 当前数据库中相关语义分散在 `levels`、`custom_levels`、`invite_tokens`、`memories`。

#### V1 已确认目标

- 发布前必须通过完整字段校验。
- 复制后的家庭事情版本必须保留来源链路。

#### 尚未实现

- `activity_version` 的正式表、版本号规则、发布状态机尚未实现。

### 4.3 `Record`

```ts
type RecordModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
type RecordSealState = 'sealed' | 'unsealed';

type Record = {
  id: string;
  family_id: string;
  kid_id: string;
  activity_id: string;
  activity_version_id: string;
  recorded_by: string;
  primary_capture_mode: CaptureMode;
  capture_modes: CaptureMode[];
  title?: string | null;
  caption?: string | null;
  transcript?: string | null;
  duration?: number | null;
  shots?: number | null;
  place?: string | null;
  recorded_at: string;
  sealed: RecordSealState;
  seal_until?: string | null;
  seal_label?: string | null;
  moderation_status?: RecordModerationStatus | null;
  moderation_note?: string | null;
  snapshot: {
    activity_title: string;
    activity_why: string;
    activity_how: string;
    record_hint: string;
    suggest_mode: CaptureMode;
    allowed_capture_modes: CaptureMode[];
    illustration_source?: IllustrationSource | null;
  };
  created_at: string;
  updated_at: string;
};
```

#### 不变量

- 一条记录必须绑定 `activity_id` 和 `activity_version_id`。
- `snapshot` 必须足以还原当时记录语义。
- `primary_capture_mode` 是主采集方式，不排斥同次混合媒体。
- `capture_modes` 可以包含多个采集方式。
- 记录一旦生成，不能因为后续版本变化而被改写。

#### 当前已存在事实

- `memories` 已承载部分记录事实。

#### V1 已确认目标

- 混合媒体记录是允许的。
- `primary_capture_mode` 必须保留。

#### 尚未实现

- 记录与媒体拆分表尚未正式落地。

### 4.4 `RecordMedia`

```ts
type RecordMediaKind = 'image' | 'video' | 'audio' | 'text' | 'other';

type RecordMedia = {
  id: string;
  record_id: string;
  kind: RecordMediaKind;
  storage_path?: string | null;
  mime_type?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  order_index: number;
  is_primary?: boolean | null;
  caption?: string | null;
  created_at: string;
};
```

#### 不变量

- 同一条记录可以存在多种媒体类型。
- `order_index` 决定展示顺序。
- 主媒体与主采集方式不是同一个概念。

#### 当前已存在事实

- App 已支持照片、多图、视频、语音、文本的混合体验。

#### 尚未实现

- 记录媒体表尚未统一落库。

### 4.5 系统插画兼容投影

```ts
type AssetLifecycleStatus = 'active' | 'disabled' | 'archived';

type SystemIllustrationCompatProjection = {
  id: string;
  source_key: string;
  display_no?: string | null;
  title: string;
  path: string;
  mime_type?: string | null;
  status: AssetLifecycleStatus;
  usage_count?: number | null;
  used_by_activity_ids?: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
```

#### 不变量

- 这不是权威实体，只能从 `activity_version.illustration_*` 字段派生。
- 新后台契约不得以 `list assets` 或独立系统资产 CRUD 暴露它。
- 兼容投影存在时只能用于旧客户端过渡，不得成为新写路径。
- `path` 是 `storage_path` 的兼容别名，不是展示编号。

#### 当前已存在事实

- 系统插画与 motif 回退已经存在于 App 表现层。

#### V1 已确认目标

- 系统插画属于事情版本，版本继承和历史快照必须成立。

#### 尚未实现

- 旧资产库 UI / RPC 退出新后台契约仍需分阶段落地。

### 4.6 `FamilyPrivateCoverAsset`

```ts
type FamilyPrivateCoverAsset = {
  id: string;
  family_id: string;
  source_key: string;
  title?: string | null;
  path: string;
  mime_type?: string | null;
  status: AssetLifecycleStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};
```

#### 不变量

- 家庭封面资产不可跨家庭复用。
- 管理员查看必须走治理式访问。
- 不能把家庭封面当作系统公共资产。

#### 当前已存在事实

- App 端已有家庭上传封面行为。

#### V1 已确认目标

- 家庭封面属于家庭私有资产。

#### 尚未实现

- 治理式访问契约与审计链路尚未落地。

### 4.7 `ModerationCase`

```ts
type ModerationCaseKind =
  | 'record_review'
  | 'activity_review'
  | 'asset_review'
  | 'family_support'
  | 'policy_violation'
  | 'public_request';

type ModerationCaseStatus = 'open' | 'in_review' | 'resolved' | 'rejected' | 'closed';

type ModerationCase = {
  id: string;
  kind: ModerationCaseKind;
  status: ModerationCaseStatus;
  reason: string;
  target_type: 'activity' | 'activity_version' | 'record' | 'asset' | 'family';
  target_id: string;
  family_id?: string | null;
  opened_by: string;
  assigned_to?: string | null;
  opened_at: string;
  resolved_at?: string | null;
  resolution_note?: string | null;
  audit_event_id?: string | null;
};
```

#### 不变量

- 家庭自定义事情默认不进入常规人工审核，只在治理场景下产生 case。
- 家庭完成记录默认私有，管理员查看必须有治理理由。
- `reason` 必须可审计。

#### 当前已存在事实

- 当前后台已有审核概念，但对象边界不完整。

#### V1 已确认目标

- 审核中心按对象类型分流。

#### 尚未实现

- 统一 moderation case 模型尚未落地。

### 4.8 `AuditEvent`

```ts
type AuditEventAction =
  | 'create'
  | 'update'
  | 'copy'
  | 'approve_review'
  | 'publish'
  | 'unpublish'
  | 'archive'
  | 'delete'
  | 'view_private'
  | 'moderate'
  | 'grant_access'
  | 'revoke_access';

type AuditEvent = {
  id: string;
  actor_id: string;
  actor_role: 'content_editor' | 'content_reviewer' | 'family_support' | 'system_admin';
  action: AuditEventAction;
  target_type: 'activity' | 'activity_version' | 'record' | 'asset' | 'family' | 'member' | 'moderation_case';
  target_id: string;
  family_id?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};
```

#### 不变量

- 敏感操作必须生成 `audit_event`。
- 查看私有家庭数据必须记录治理理由。
- 审计事件是只追加，不应被业务流程覆盖。

#### 当前已存在事实

- 已有审计表和部分后台写审计行为。

#### V1 已确认目标

- RLS/RPC 与审计边界要清晰分离。

#### 尚未实现

- 审计覆盖所有敏感对象和动作尚未完整实现。

---

## 5. source_type、稳定 UUID、显示编号、copied_from

### 5.1 source_type

`source_type` 是来源类型，不是生命周期状态。

建议取值：

- `system`
- `family`
- `copied_family`

规则：

- `system` 表示平台维护。
- `family` 表示家庭原创。
- `copied_family` 表示由系统事情复制而来的家庭独立事情。

### 5.2 稳定 UUID

规则：

- 所有主实体使用稳定 UUID。
- 展示编号只用于后台和前台展示。
- 不能把展示编号作为记录事实的唯一主键。

### 5.3 显示编号分离

建议分离字段：

- `display_no`
- `source_key`
- `id`

语义：

- `id` 是机器主键。
- `source_key` 是来源稳定键。
- `display_no` 是人类可读编号。

### 5.4 `copied_from`

`copied_from` 只表达来源，不表达自动继承、自动同步或覆盖。

必须满足：

- 复制后对象是独立实体。
- 复制后不能和原对象共享编辑语义。
- V1 禁止设计家庭字段覆盖。

---

## 6. 字段语义与发布校验

### 6.1 `why`

语义：

- 这件事情为什么值得做。

发布校验：

- 系统事情发布前必填。
- 家庭事情允许快速创建时暂缺，但进入发布态时应补齐。

### 6.2 `how`

语义：

- 这件事情可以怎么做。

发布校验：

- 系统事情发布前必填。
- 应避免空泛文案。

### 6.3 `record_hint`

语义：

- 记录些什么，面向记录流程的提示。

发布校验：

- 系统事情发布前必填。
- 应能被记录页直接使用。

### 6.4 `suggest_mode`

语义：

- 推荐使用的记录方式，不等于唯一允许方式。

发布校验：

- 必须属于 `allowed_capture_modes`。

### 6.5 `allowed_capture_modes`

语义：

- 可用的记录方式白名单。

发布校验：

- 不能为空。
- 至少要表达文字、照片、视频、语音四类中的一个或多个。
- 推荐值不能被排除。

### 6.6 `illustration`

语义：

- 事情版本的视觉字段或回退来源。

发布校验：

- 系统事情优先使用版本自带系统插画字段。
- `source = 'system_asset'` 只是旧命名兼容，含义是“版本自带系统插画”，不代表存在独立系统资产实体。
- 系统插画至少应能表达 `storage_path`，并可表达 `mime_type`、`width`、`height`、`alt`、`metadata`。
- 家庭事情的封面必须保持家庭边界。
- motif 只能是回退，不应作为长期主资产替代。

### 6.7 `seal_recommendation`

语义：

- 事情版本给记录流程的默认封存建议。
- 它可以建议默认不封存、默认封存到某日期、按年龄节点提示或由记录人手动决定。
- 它不是最终封存结果。

发布校验：

- 若存在，必须明确 `default_state` 与 `kind`。
- 若 `kind = 'until_date'`，必须提供 `default_until`。
- 最终事实只能写入 `Record.sealed`、`Record.seal_until` 和 `Record.seal_label`。

---

## 7. 家庭快速创建校验

### 7.1 允许的最小创建

家庭快速创建只要求：

- 标题
- 至少一种允许记录方式

可选内容：

- `why`
- `how`
- `record_hint`
- `illustration`
- `tone`
- `perspective`
- `category`
- `scene`
- `tags`

### 7.2 约束

- 不能把家庭快速创建强制升级为系统级完整发布校验。
- 不能因为快速创建而默认产生系统共享语义。
- 快速创建后可以继续补全，不需要重建对象。

### 7.3 当前已存在事实

- App 已经支持家庭事情快速创建方向。

### 7.4 V1 已确认目标

- 家庭事情支持快速创建后完善。

### 7.5 尚未实现

- 后台契约尚未把快速创建与发布校验分离。

---

## 8. 混合媒体记录模型

### 8.1 语义

一条记录允许同时包含：

- 文本
- 多张照片
- 视频
- 语音

### 8.2 关键字段

- `primary_capture_mode`
- `capture_modes`
- `activity_id`
- `activity_version_id`
- `snapshot`
- `record_media[]`

### 8.3 不变量

- 不能退化成单一媒体类型模型。
- `primary_capture_mode` 是主采集方式，不是唯一采集方式。
- 记录快照必须能解释当时录入语义。

### 8.4 当前已存在事实

- App 侧已能录入多种媒体形态。

### 8.5 V1 已确认目标

- 混合媒体记录和主采集方式保留。

### 8.6 尚未实现

- 后台正式模型仍未拆分记录与媒体。

---

## 9. 草稿、发布、新版本、下架、历史版本

### 9.1 状态机

`activity_version.status` 建议支持：

- `draft`
- `published`
- `archived`
- `unpublished`

### 9.2 规则

- 草稿不可对外生效。
- 发布必须生成可追踪版本。
- 新版本不是覆盖旧版本。
- 下架不删除历史版本。
- 历史版本必须可回看。

### 9.3 版本切换

建议动作：

- `create draft`
- `validate`
- `approve review`
- `publish`，仅系统管理员执行
- `unpublish`，仅系统管理员执行
- `archive`
- `view history`

### 9.4 当前已存在事实

- 当前后台没有正式版本流。

### 9.5 V1 已确认目标

- 系统事情需要版本治理。

### 9.6 尚未实现

- 新版本、下架、历史版本接口和页面都尚未完整落地。

---

## 10. V1 复制边界

### 10.1 明确允许

- 系统事情复制为独立家庭事情。
- 复制后保留 `copied_from`。

### 10.2 明确禁止

- 家庭字段覆盖
- `override_of_version_id`
- 自动同步
- 复制后共享编辑语义

### 10.3 设计原因

- V1 只确认复制，不确认复杂继承。
- 复制是派生新对象，不是覆盖原对象。

### 10.4 当前已存在事实

- App 侧已有复制 / 自定义事情的意图。

### 10.5 V1 已确认目标

- 复制是独立家庭事情的生成方式之一。

### 10.6 尚未实现

- 复制的统一后台契约尚未落地。

---

## 11. 家庭事情和家庭封面的私有性

### 11.1 家庭事情

规则：

- 家庭自定义事情属于家庭私有对象。
- 默认不跨家庭共享。
- 不纳入系统内容池。

### 11.2 家庭封面

规则：

- 家庭封面是家庭私有资产。
- 不可跨家庭复用。
- 管理员查看需要治理理由与审计。

### 11.3 当前已存在事实

- App 和数据库都已有家庭边界概念。

### 11.4 V1 已确认目标

- 家庭私有边界必须被保留。

### 11.5 尚未实现

- 管理员治理式访问控制尚未在统一契约中完成。

---

## 12. 四角色权限矩阵

### 12.1 角色定义

- 内容编辑
- 内容审核
- 家庭支持
- 系统管理员

### 12.2 权限矩阵

| 动作 | 内容编辑 | 内容审核 | 家庭支持 | 系统管理员 |
|---|---|---|---|---|
| 新建系统事情草稿 | 是 | 否 | 否 | 是 |
| 编辑系统事情草稿 | 是 | 否 | 否 | 是 |
| 审核批准系统事情版本 | 否 | 是 | 否 | 是 |
| 发布系统事情版本 | 否 | 否 | 否 | 是 |
| 下架系统事情版本 | 否 | 否 | 否 | 是 |
| 查看家庭私有事情 | 否 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 |
| 查看家庭私有封面 | 否 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 |
| 查看家庭完成记录 | 否 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 | 仅治理案件/理由 + 审计 |
| 处理家庭支持案件 | 否 | 否 | 是 | 是 |
| 查看审计日志 | 否 | 否 | 有限 | 是 |
| 编辑系统事情版本插画 | 是 | 否 | 否 | 是 |
| 查看 moderation case | 否 | 是 | 是 | 是 |

### 12.3 约束

- 角色边界要最小权限。
- 不得默认给所有管理员同等能力。
- 内容编辑默认不可访问家庭私有事情、家庭私有封面和家庭完成记录。
- 内容审核、家庭支持、系统管理员访问家庭私有数据时，都必须绑定明确治理案件或治理理由，并同步写审计。

### 12.4 当前已存在事实

- 当前后台已有管理员概念，但角色矩阵不完整。

### 12.5 V1 已确认目标

- 四类管理员边界明确。

### 12.6 尚未实现

- 后台页面按钮级权限控制尚未完整契约化。

---

## 13. RLS / RPC / 审计边界

### 13.1 RLS 边界

建议边界分为：

- 系统可读
- 家庭私有可读
- 治理式可读
- 管理员禁止直读，仅走 RPC

### 13.2 RPC 边界

建议 RPC 承担：

- 审核批准
- 系统管理员发布
- 系统管理员下架
- 复制
- 版本切换
- 治理式查看家庭私有对象
- 敏感对象审核

### 13.3 审计边界

所有以下动作都应写 `audit_event`：

- 创建
- 编辑
- 复制
- 审核批准
- 发布
- 下架
- 归档
- 删除
- 治理式查看
- 角色变更
- 家庭成员变更

### 13.4 当前已存在事实

- 当前已有部分审计能力，但不完整。

### 13.5 V1 已确认目标

- RLS、RPC 和审计边界必须清晰。

### 13.6 尚未实现

- 统一的 admin-safe projection 和治理式 RPC 契约尚未落地。

---

## 14. repository read model 与 write command

### 14.1 read model

后台 repository 的 read model 应至少覆盖：

- `activity list`
- `activity detail`
- `activity version history`
- `record list`
- `record detail`
- `family private cover governed view`
- `moderation case list`
- `audit event list`
- `family summary`
- `permission summary`

### 14.2 write command

后台 repository 的 write command 应至少覆盖：

- `createActivityDraft`
- `updateActivityDraft`
- `copySystemActivityToFamily`
- `createActivityVersion`
- `approveActivityVersionReview`
- `publishActivityVersion`
- `unpublishActivityVersion`
- `archiveActivityVersion`
- `requestGovernedPrivateAccess`
- `createModerationCase`
- `resolveModerationCase`
- `writeAuditEvent`

### 14.3 约束

- read model 不应混入写入副作用。
- write command 必须可审计。
- `publishActivityVersion` 和 `unpublishActivityVersion` 只允许系统管理员执行。
- 内容审核员只执行审核批准，不直接执行发布或下架。
- 家庭私有对象读取必须经治理式访问 command 或等价 RPC，不得绕过审计。
- demo 或 local derived 数据必须明确标记，不能伪装成 live。

### 14.4 当前已存在事实

- 当前 repository 主要围绕部分 `memory` 和通知能力。

### 14.5 V1 已确认目标

- 需要面向事情、版本、记录、资产、审核的正式 repository。

### 14.6 尚未实现

- 完整 repository 接口尚未落地。

---

## 15. live / demo / permission-denied 状态

### 15.1 必须显式区分

后台每个 read model 至少应表达：

- `live`
- `demo`
- `permission_denied`

### 15.2 规则

- `live` 表示来自真实后端且可操作。
- `demo` 表示模拟数据，只可预览，不可伪装成正式能力。
- `permission_denied` 表示有对象存在但当前角色无权读取。
- 禁止静默伪装。

### 15.3 当前已存在事实

- 现有后台有 demo 降级风险。

### 15.4 V1 已确认目标

- 后台必须暴露数据来源与权限状态。

### 15.5 尚未实现

- 统一状态模型尚未全面接入各页面。

---

## 16. levels / custom_levels / memories 到目标模型的兼容映射

### 16.1 系统事情映射

- `levels` -> `activity` + `activity_version`
- `num` -> `display_no` 或 `source_key` 的历史兼容映射
- `why`、`how`、`record` -> `activity_version`
- `suggest` -> `suggest_mode`
- `illustration_path` -> `activity_version.illustration.storage_path`
- `sealed` / `seal_until` / `seal_kind` -> `seal_recommendation`，只作为事情版本给记录流程的默认建议

### 16.2 家庭事情映射

- `custom_levels` -> `activity` + `activity_version`
- `family_id` -> `activity.family_id`
- `user_id` -> `created_by`
- `record_hint` -> `record_hint`
- `suggest` -> `suggest_mode`
- `illustration_path` -> `FamilyPrivateCoverAsset` 或家庭私有 illustration；不得并入系统事情版本插画
- 旧家庭事情上的封存相关字段若存在，只能映射为 `seal_recommendation`

### 16.3 记录映射

- `memories` -> `record`
- `level_num` -> `activity_id` / `activity_version_id` 的历史兼容来源，不是最终主键
- `type` / `shots` / `caption` / `transcript` -> `record` + `record_media`
- `sealed` / `seal_until` / `seal_label` -> `Record.sealed` / `Record.seal_until` / `Record.seal_label`，这是最终完成记录事实

### 16.4 约束

- 兼容映射只能用于过渡和读模型，不得掩盖目标模型缺口。
- 任何历史兼容字段都不能反向定义新主键语义。

---

## 17. 后台页面 read model

### 17.1 数据总览

read model：

- 系统事情数量
- 家庭事情数量
- 发布版本数量
- 记录数量
- 待审核案件数量
- 审计事件数量

状态：

- live

### 17.2 事情库

read model：

- `activity list`
- `activity detail`
- `activity version history`
- `source_type`
- `display_no`
- `current_version`
- `copied_from`
- `status`

状态：

- live
- permission_denied

### 17.3 模板中心

read model：

- 草稿版本
- 发布版本
- 历史版本
- 复制链路
- 允许记录方式
- 推荐记录方式

状态：

- live
- demo

### 17.4 完成记录

read model：

- 记录列表
- 记录详情
- 媒体列表
- 快照
- moderation status

状态：

- live
- permission_denied

### 17.5 家庭与用户

read model：

- 家庭摘要
- 成员角色
- 私有事情数量
- 受限访问标记
- 支持案件

状态：

- live
- permission_denied

### 17.6 插画与家庭私有封面

read model：

- 系统事情版本插画字段
- 家庭私有封面资产
- 版本使用位置
- 家庭私有封面治理访问
- 旧系统资产列表兼容投影

状态：

- live
- permission_denied

### 17.7 审核中心

read model：

- moderation case 列表
- 对象类型
- 风险原因
- 处理状态

状态：

- live

### 17.8 消息与触达

read model：

- 模板
- 队列
- 失败
- 重试

状态：

- demo 或 live，必须显式标明

### 17.9 审计与安全

read model：

- audit event 列表
- 角色映射
- 敏感操作

状态：

- live
- permission_denied

---

## 18. 错误模型

### 18.1 错误类型

```ts
type ContractErrorCode =
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_FAILED'
  | 'STATE_CONFLICT'
  | 'RELATION_MISSING'
  | 'IMMUTABLE_VIOLATION'
  | 'SOURCE_MISMATCH'
  | 'PUBLISH_BLOCKED'
  | 'VERSION_MISMATCH'
  | 'MEDIA_INVALID'
  | 'AUDIT_REQUIRED';
```

### 18.2 统一错误结构

```ts
type ContractError = {
  code: ContractErrorCode;
  message: string;
  target?: string | null;
  details?: Record<string, unknown> | null;
  retryable?: boolean;
};
```

### 18.3 规则

- `PERMISSION_DENIED` 不能静默降级成成功。
- `VALIDATION_FAILED` 必须指出缺失字段。
- `PUBLISH_BLOCKED` 必须指出阻塞原因。
- `IMMUTABLE_VIOLATION` 表示历史事实被尝试改写。

---

## 19. 发布校验

### 19.1 系统事情发布前必须检查

- `title`
- `why`
- `how`
- `record_hint`
- `suggest_mode`
- `allowed_capture_modes`
- `suggest_mode in allowed_capture_modes`
- `activity_version` 状态
- 版本号递增
- 视觉资产来源合法
- 若存在 `seal_recommendation`，必须明确它只是记录流程默认建议
- 已通过内容审核批准
- 发布执行者具备系统管理员权限

### 19.2 家庭事情快速创建前必须检查

- `title`
- 至少一种允许记录方式

### 19.3 记录入库前必须检查

- `activity_id`
- `activity_version_id`
- `family_id`
- `kid_id`
- `primary_capture_mode`
- 媒体与采集方式一致性
- snapshot 存在

### 19.4 管理员查看家庭私有对象前必须检查

- 治理理由
- 关联治理案件或等价工单
- 角色权限
- 审计事件准备
- 内容编辑默认不可访问
- 内容审核、家庭支持、系统管理员也不得无条件访问

---

## 20. 验收标准

### 20.1 事情与版本

- 能区分系统事情、家庭事情、复制出的家庭事情。
- 能看到稳定 UUID、展示编号和来源键的分离。
- 能看到版本历史和当前版本。

### 20.2 记录与媒体

- 一条记录能包含文字 + 多媒体混合。
- 能看到 `primary_capture_mode`。
- 能追溯到 `activity_id`、`activity_version_id` 和快照。

### 20.3 插画、封面与治理

- 系统插画直接归属于事情版本。
- 家庭封面保持家庭私有。
- 治理式访问可审计。

### 20.4 权限与审计

- 四类角色边界清楚。
- 敏感动作有审计。
- 不能静默伪装 live / demo / permission_denied。

### 20.5 兼容与边界

- 兼容映射存在，但不反向定义新模型。
- 不包含家庭字段覆盖能力。
- 不包含 `override_of_version_id`。
- 不包含自动同步。

---

## 21. PR-01 至 PR-15 追踪矩阵

| PR | 规则摘要 | 本契约对应章节 | 覆盖状态 |
|---|---|---|---|
| PR-01 | 系统内置事情由平台维护，稳定身份、版本、下架不影响历史 | 第 4 章、第 9 章、第 16 章 | 已覆盖 |
| PR-02 | 家庭自定义事情家庭私有，角色控制编辑，删除不删除历史记录 | 第 4 章、第 11 章、第 12 章 | 已覆盖 |
| PR-03 | 系统事情可复制为独立家庭事情并保留 copied_from，V1 不做复杂覆盖或自动同步 | 第 4 章、第 5 章、第 10 章 | 已覆盖 |
| PR-04 | 系统事情发布必填完整字段与发布校验 | 第 6 章、第 19 章；内容审核只批准，系统管理员执行发布 | 已覆盖 |
| PR-05 | 家庭自定义事情仅标题和至少一种允许记录方式必填，支持快速创建后完善 | 第 7 章、第 19 章 | 已覆盖 |
| PR-06 | suggest_mode 与 allowed_capture_modes 分离，推荐必须属于允许集合 | 第 4 章、第 6 章、第 19 章 | 已覆盖 |
| PR-07 | 一次记录允许混合媒体，可保留 primary_capture_mode | 第 4 章、第 8 章、第 19 章 | 已覆盖 |
| PR-08 | 系统插画归属事情版本，不存在独立系统资产库，motif 仅回退 | 第 4 章、第 6 章、第 11 章 | 已覆盖 |
| PR-09 | 家庭上传封面家庭私有，不可跨家庭复用，治理查看受限 | 第 4 章、第 11 章、第 13 章 | 已覆盖 |
| PR-10 | 系统事情采用草稿/发布/新版本/下架/历史版本治理 | 第 4 章、第 9 章、第 19 章 | 已覆盖 |
| PR-11 | 历史完成记录绑定 activity_id、activity_version_id 和必要快照 | 第 4 章、第 8 章、第 16 章、第 19 章 | 已覆盖 |
| PR-12 | 封存最终是记录级选择，事情只提供默认建议 | 第 4 章、第 6 章、第 8 章、第 19 章；`seal_recommendation` 只在版本层表达默认建议，`Record.sealed` / `Record.seal_until` 才是最终事实 | 已覆盖 |
| PR-13 | 家庭自定义事情默认不常规人工审核，仅治理场景介入 | 第 4 章、第 7 章、第 13 章 | 已覆盖 |
| PR-14 | 家庭完成记录默认私有，管理员查看需治理理由和审计 | 第 4 章、第 11 章、第 12 章、第 13 章 | 已覆盖 |
| PR-15 | 四类管理员最小权限：内容编辑、内容审核、家庭支持、系统管理员 | 第 12 章、第 13 章、第 17 章；内容审核员审核批准，系统管理员发布/下架 | 已覆盖 |

---

## 22. 自查清单

- 本契约未引入家庭字段覆盖能力。
- 本契约未引入 `override_of_version_id`.
- 本契约未引入自动同步。
- 本契约未在 `ActivityVersion` 中定义 `primary_capture_mode`。
- 本契约未允许任何管理员角色无条件访问家庭私有事情、家庭私有封面或家庭完成记录。
- 本契约未把当前实现描述为已完成目标。
- 本契约明确区分了当前已存在事实、V1 已确认目标和尚未实现。
- 本契约对 PR-01 至 PR-15 建立了逐条追踪矩阵。
