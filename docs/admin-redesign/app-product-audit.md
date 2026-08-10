# App 产品流程与「事情 / 一百件事」领域模型审计

审计范围：仅以 App 端源码、路由、组件、hooks、状态、静态数据、文案和 assets 引用为准，不以现有管理后台反推产品。

本稿只记录产品事实、实现证据、合理推断与缺失项，不替代 schema 设计。

## 1. 结论摘要

- App 端的核心对象不是“任务”或“打卡”，而是“事情 / level / 事”：
  - 内置事情来自 `levels` 表与推荐 RPC。
  - 家庭自定义事情来自 `custom_levels` 表。
  - 真正被记录的是 `memories`，它把某件事情与孩子、家庭、时间、地点、内容、媒体、封存状态关联起来。
- 用户主路径是：
  - 首页浏览事情 `HomeFeed`
  - 看事情详情 `LevelDetail`
  - 进入记录流程 `RecordFlow`
  - 记录完成后进入回忆页 `Memory`
  - 通过时间线、日历、年度回顾、封存页回看
- 产品层面已经明确了“内置事”和“家庭自定义事”的差异：
  - 内置事有编号、推荐逻辑、年龄权重、节奏/季节适配、内置插画或 motif 回退。
  - 自定义事有 `★1/★2...` 这类家庭内序号、可编辑、可删除、可选封面，且文案直接称为“我们家自己的事”。

## 2. 用户端真实流程

### 2.1 路由与页面入口

`App.tsx` 中的主路由已经把“事情”链路完整串起来：

- `Home`
- `LevelDetail`
- `AddOwnLevel`
- `OwnLevels`
- `LevelTimeline`
- `SpotCompare`
- `Record`
- `Memory`
- `MemoryBook`
- `Sealed`
- `RecordsCalendar`
- `YearReview`
- `InviteRecord`

证据：

- [App.tsx](/home/coder/workspaces/yibai/App.tsx)
- 其中 `Stack.Screen name="Home"`、`LevelDetail`、`AddOwnLevel`、`OwnLevels`、`Record`、`MemoryBook`、`Sealed`、`RecordsCalendar`、`YearReview` 等路由直接暴露了产品流程。

### 2.2 首次进入

`AppNavigator` 会根据登录态和孩子是否存在决定初始页：

- 未登录 -> `LoginWelcome`
- 已登录但没有孩子 -> `Onboarding`
- 已登录且有孩子 -> `Home`

证据：

- [App.tsx](/home/coder/workspaces/yibai/App.tsx) 中 `initialRoute` 逻辑
- [src/data/DataProvider.tsx](/home/coder/workspaces/yibai/src/data/DataProvider.tsx) 负责加载 `kids / memories / customLevels / profile / family`

### 2.3 首页浏览事情

`HomeFeed` 是主浏览页，表现为全屏纵向卡片流：

- 顶部有三个视角 tab：`parent / child / together`
- 右上有孩子切换器
- 卡片可下滑换一件事
- 每张卡片可进入详情
- 内置事情与自定义事情被混合成一条 feed

证据：

- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)
- `TopBar`、`KidSwitcher`、`LevelCard`
- `feedLevels = [...customLevels, ...recommendedLevelsForKid(kidId)]`
- `navigation.navigate('LevelDetail', { level, kidId, me })`

关键产品事实：

- 当当前孩子筛选为 `all` 时，`parent` 和 `child` tab 会被禁用，只保留 `together`。
- 首页卡片同时展示：
  - 事情标题
  - `why`
  - `record` 摘要
  - 推荐记录方式
  - 插画 / motif
  - 视角标签
  - “季节限定”或“会被封存”等 badge

### 2.4 事情详情页

`LevelDetail` 是“这件事是什么、为什么做、怎么做、怎么记”的集中页：

- hero 区展示封面
- 标题
- `why`
- `how`
- `record`
- 推荐记录方式卡片
- 底部两个动作：
  - 邀请家人一起记 `InviteRecord`
  - 直接去记录 `Record`

证据：

- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)

### 2.5 自定义事情管理

`OwnLevels` 负责家庭自定义事情管理：

- 列表
- 新增
- 编辑
- 删除

`AddOwnLevel` 负责新增/编辑表单：

- 标题
- 谁为谁做的 `perspective`
- `why`
- `how`
- `record`
- 适合什么记录 `suggest`
- 封面

证据：

- [src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx)
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)

### 2.6 记录流程

`RecordFlow` 是真正把某件事落成一条 `memory` 的入口。

它支持四种记录方式：

- 语音
- 照片
- 视频
- 文本

每种方式都有自己的采集 UI 和附件字段：

- 语音：录音、播放、重录、自动转写
- 照片：主封面图 + 多张附图 + Live Photo 配对视频
- 视频：单段视频
- 文本：正文输入 + starter chips

记录完成后，客户端调用 `addMemory`，把当前事情、孩子、视角、类型、日期、地点、标题、caption、transcript、tone、封存信息一起写入 `memories`。

证据：

- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- `addMemory({ id, kid, levelNum, perspective, type, dur, shots, date, place, title, caption, transcript, tone, sealed, sealUntil, sealLabel })`

### 2.7 回看

回看不是单一页面，而是多入口：

- `MemoryBook`：时间线总览
- `LevelTimeline`：同一件事的多次记录
- `RecordsCalendar`：按年月日看记录
- `YearReview`：年度统计回顾
- `SealedPage`：封存中记录列表
- `Memory`：单条记录详情

证据：

- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)
- [src/screens/RecordsCalendar.tsx](/home/coder/workspaces/yibai/src/screens/RecordsCalendar.tsx)
- [src/screens/YearReview.tsx](/home/coder/workspaces/yibai/src/screens/YearReview.tsx)
- [src/screens/SealedPage.tsx](/home/coder/workspaces/yibai/src/screens/SealedPage.tsx)
- [src/screens/SpotTimeline.tsx](/home/coder/workspaces/yibai/src/screens/SpotTimeline.tsx)

## 3. 领域模型

### 3.1 核心实体

#### A. 内置事情 `levels`

来自 `supabase-docker/migrations/20260723_curated_100_levels.sql` 的 100 件内置库。

字段在 App 侧可见的最小集合：

- `num`
- `perspective`
- `tone`
- `title`
- `why`
- `how`
- `record`
- `suggest`
- `sealed`
- `sealUntil`
- `sealedOn`
- `sealKind`
- `seasonal`
- `kid`
- `illustrationPath`
- `category`
- `scene`
- `minAge`
- `maxAge`
- `seasons`
- `tags`
- `qualityScore`

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `mapLevel`
- [supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)

#### B. 家庭自定义事情 `custom_levels`

App 侧映射字段：

- `id`
- `num`
- `perspective`
- `tone`
- `custom: true`
- `title`
- `why`
- `how`
- `record`
- `suggest`
- `illustrationPath`

创建时额外写入：

- `family_id`
- `user_id`

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `mapCustomLevel / insertCustomLevel / updateCustomLevel`
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)

#### C. 记忆 `memories`

这是用户真正记录出来的一条条内容。App 侧字段：

- `id`
- `kid`
- `levelNum`
- `perspective`
- `type`
- `dur`
- `shots`
- `date`
- `place`
- `title`
- `caption`
- `transcript`
- `tone`
- `sealed`
- `sealUntil`
- `sealLabel`
- `inviteTokenId`
- `invitedRole`
- `userId`
- `createdAt`

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `mapMemory / insertMemory`
- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)

#### D. 孩子 `kids`

App 侧字段：

- `id`
- `name`
- `y`
- `m`
- `tone`
- `bear`
- `since`
- `acc`

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `mapKid`
- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx) 的 `KidSwitcher`

#### E. 家庭 `family`

App 侧家庭对象包含：

- `id`
- `inviteCode`
- `isCreator`
- `members[]`

成员包含：

- `userId`
- `role`
- `customRole`
- `phone`
- `isMe`

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `fetchMyFamily`
- [App.tsx](/home/coder/workspaces/yibai/App.tsx)

### 3.2 关系模型

#### 事情与记忆

- 一件事可以产生很多条记忆。
- 一条记忆必须绑定一个 `levelNum`。
- `MemoryBook`、`LevelTimeline`、`YearReview` 都是围绕 `memories` 的不同视图。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `memoriesForLevelFrom`
- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)

#### 事情与孩子

- 事情本身不直接属于某个孩子，但记录时会落到某个 `kid`。
- `kid` 可以是具体孩子，也可以是 `all`，表示全家。
- `kidDoneFrom / memoriesForKidFrom` 都把 `kid === 'all'` 视为全家可见/可计数。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)

#### 事情与家庭

- 自定义事情按 `family_id` 隔离。
- 内置事情库对 App 端是“读模型”，用户不会编辑基础库本体。
- 记忆、孩子、自定义事情都按同一家庭同步。

证据：

- [src/data/DataProvider.tsx](/home/coder/workspaces/yibai/src/data/DataProvider.tsx)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)

## 4. 内置事情与家庭自定义事情如何区分

这是当前 App 中最明确的二分。

### 4.1 内置事情

事实：

- 来自 `levels`。
- 有固定编号 `num`，例如 `01` 到 `100`。
- 来自 `curated_100_levels.sql` 的 curated 文案。
- 会参与推荐、季节权重、年龄权重、首页洗牌。
- 可带插画，也可没有插画；没有插画时回退到 motif SVG。
- 部分条目可封存 `sealed`，并带 `sealKind`。
- `seasonal`、`minAge`、`maxAge`、`category`、`scene`、`tags` 都是内置库维度。

证据：

- [supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)

### 4.2 家庭自定义事情

事实：

- 由当前登录用户在自己家庭下创建、编辑、删除。
- `num` 用 `★1 / ★2 ...` 形式生成，和内置 01-100 明确区分。
- 详情页与列表页都把它标成“我们家自己的事”。
- 可编辑 `title / why / how / record / perspective / tone / suggest / illustrationPath`。
- 可为自定义事情上传封面图。
- 删除时会尝试连同 `illustrationPath` 对应的 storage 文件一起删掉。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)
- [src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx)
- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)

### 4.3 UI 上的区分方式

- 首页：自定义事情会显示 `badgeCustom`，即“我们家自己的事”。
- 自定义事情列表：标题行、统计卡、编辑入口都围绕自定义事。
- 内置事情：显示固定编号 `num`，并可能带 `seasonal`、`sealed`、年龄适配等 badge。

证据：

- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)
- [src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx)
- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)

## 5. 事情是否带插画 / 封面 / 图标及其来源

### 5.1 内置事情的视觉来源

事实：

- `SceneSlot` 先看 `illustrationPath`。
- 若 `illustrationPath` 是完整 URL，直接显示。
- 若是桶内路径，则通过 Supabase 公共桶 `illustrations` 取 URL。
- 若没有插画，则回退到 `motifForLevel` 选择的 SVG 图案。

证据：

- [src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)

### 5.2 自定义事情的视觉来源

事实：

- 新建/编辑时允许选择封面图。
- 图片来源是相机或相册。
- 选中的本地图会通过 `uploadIllustration` 上传到公开桶 `illustrations`，路径格式是 `familyId/custom-<timestamp>.<ext>`。
- 若没有封面，则回退到 `SceneSlot` 的 motif。

证据：

- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)

### 5.3 记忆的视觉来源

事实：

- 记忆详情和时间线中的封面来自 `MemoryCover`。
- 照片记录会把第一张当封面；多图时第一张是主图。
- 视频记录显示视频首帧/播放器。
- 语音记录显示音频播放态。
- 封存中的记忆不会露出真实封面，而是锁图标 / 蜡封式占位。

证据：

- [src/components/MemoryCover.tsx](/home/coder/workspaces/yibai/src/components/MemoryCover.tsx)
- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)

### 5.4 图标的角色

事实：

- 图标不是核心数据，而是视图语义层。
- 记录类型、封存、时间线、分享等都用 `Icon.*` 体现。
- `motifForLevel` 是基于标题/`how` 的关键词回退，而不是独立内容资产模型。

推断：

- 当前产品更接近“封面图 + 语义 motif + 类型图标”的三层视觉系统，而不是统一的 icon 字段系统。

## 6. “为什么值得做 / 可以怎么做 / 记录些什么 / 允许的记录方式”如何体现

这是产品定义最关键的一块，App 端不是靠一处字段，而是分散在多层。

### 6.1 为什么值得做

事实：

- 内置事情的 `why` 字段在详情页和首页均可见。
- 首页卡片把 `why` 当作主文案。
- 详情页把 `why` 作为第一段解释。
- 自定义事情的 `why` 允许空值，创建时若不填则落默认文案 `defaultWhy`。

证据：

- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)
- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/i18n/locales/zh.ts](/home/coder/workspaces/yibai/src/i18n/locales/zh.ts)

### 6.2 可以怎么做

事实：

- `how` 是具体玩法 / 方法说明。
- 详情页单独展示 `how` 区块。
- 首页卡片通常不展示 `how`，更多是摘要。

证据：

- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `mapLevel / mapCustomLevel`

### 6.3 记录些什么

事实：

- `record` 字段是对“应该记什么”的明确提示。
- `RecordFlow` 第 0 步直接把它作为引导文案。
- 详情页也会展示 `record`。
- 自定义事情编辑页也提供 `record` 字段。

证据：

- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)

### 6.4 允许的记录方式

事实：

- 录入方式由 `suggest` 约束/推荐，取值是 `photo / video / voice / text`。
- `RecordFlow` 允许用户最终选择任何一种，`suggest` 只是默认和推荐。
- 首页、详情页、自定义事列表都会显示这一项。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)

推断：

- `suggest` 更像“最适合的记录形式”，不是严格校验的唯一允许形式。

## 7. 年龄 / 阶段 / 分类 / 排序 / 启用状态

### 7.1 年龄

事实：

- 孩子年龄由出生年/月计算。
- 首页孩子切换器会显示年龄。
- 推荐权重会使用年龄做折减，年龄过小的事项权重下降。
- 目前 App 侧没有把 `minAge / maxAge` 当成强制筛选 UI 暴露出来。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `kidAge / levelWeightFrom`
- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)

推断：

- `minAge / maxAge` 是候选库数据维度，但真实前台主要是推荐权重，而不是硬拦截。

### 7.2 阶段 / 视角

事实：

- 事情的主阶段维度是 `perspective`：
  - `parent`
  - `child`
  - `together`
- UI 文案分别是“为你 / 为我 / 一起”。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `PERSPECTIVES`
- [src/i18n/locales/zh.ts](/home/coder/workspaces/yibai/src/i18n/locales/zh.ts)

### 7.3 分类

事实：

- 内置库存在 `category / scene / tags / seasons / seasonal` 等维度。
- 但 App 端当前没有显式分类浏览页。
- 这些维度主要影响推荐与标记，而不是前台筛选入口。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)

推断：

- `category / scene / tags` 属于后台或算法侧的元数据，前台尚未产品化。

### 7.4 排序

事实：

- 内置库 `sort_order` 存在于迁移中。
- 首页 feed 使用 `weightedShuffleFrom` 做稳定洗牌。
- 推荐列表由服务端 `get_daily_recommended_levels` 返回。
- 自定义事情列表按创建时间倒序。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)
- [src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx)
- [supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)

### 7.5 启用状态

事实：

- 内置事情库对 App 是可读的活跃库。
- 自定义事情没有显式 `enabled` 开关。
- 记忆有 `sealed` / `sealUntil` / `sealLabel`，这是启用/解锁语义，不是事情启用语义。

推断：

- 如果后台要支持“停用事情”，当前 App 并没有对应 UI 或字段闭环。

## 8. 事情与孩子、家庭、记忆的关系

### 8.1 事情与孩子

事实：

- 一个事情可以被多个孩子重复完成。
- `memories` 通过 `kid` 落到某个孩子或 `all`。
- 首页和日历都可以按孩子过滤。

### 8.2 事情与家庭

事实：

- 自定义事情属于家庭，不属于单个孩子。
- 记忆、孩子、自定义事情都在同一家庭共享数据域内。

### 8.3 事情与记忆

事实：

- 事情是“模板/目标”，记忆是“完成记录”。
- 同一事情可以有多条记忆。
- `MemoryBook` 中同一 `levelNum` 会标“完成过 N 次”。
- `LevelTimeline` 可以查看同一事情的历史。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)

## 9. 封存模型

### 9.1 事实

- 封存不是事情级别的开关，而是记忆级别的状态。
- `RecordFlow` 在保存记忆时可写入 `sealed / sealUntil / sealLabel`。
- `sealKind === 'date'` 时需要用户选未来日期。
- `sealKind === 'age18'` 时按孩子生日自动推导到 18 岁生日。
- 封存中的记忆在时间线中被遮住，内容不可见。

证据：

- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts) 的 `sealDateFor / isMemoryLocked / isMemoryUnsealed`
- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- [src/screens/SealedPage.tsx](/home/coder/workspaces/yibai/src/screens/SealedPage.tsx)

### 9.2 推断

- 封存是“某次记录的时间胶囊”，不是“事情不可做”。

## 10. 静态内容与文案层的真实含义

### 10.1 文案已经明确的事实

- `perspective.parent / child / together` 已经是产品定义，而非纯展示词。
- `home.badgeCustom` 明确把自定义事命名为“我们家自己的事”。
- `record.type*` 明确产品支持四种记录方式。
- `record.photoCountFull` 明确第一张是封面。
- `yearReview`、`memory`、`sealedPage` 说明回看是产品的一部分，不是后补功能。

证据：

- [src/i18n/locales/zh.ts](/home/coder/workspaces/yibai/src/i18n/locales/zh.ts)

### 10.2 需要谨慎对待的文案

- `home.endDaily / endRound / endAllDone` 是引导性文案，不等于强约束。
- `suits.custom / season / evening / weekend / afternoon` 是推荐语义，不代表禁止其他时段。

## 11. 哪些概念是事实，哪些是推断，哪些是缺失

### 11.1 事实

- 内置事情存在，且有完整字段集。
- 自定义事情存在，且只在家庭内有效。
- 记忆是实际记录结果。
- 事情与记忆是一对多关系。
- 记录方式有四种。
- 封存是记忆级状态。
- 自定义事情可带封面图。
- 内置事情可带插画路径，没插画时回退 motif。

### 11.2 推断

- `suggest` 是推荐而非硬限制。
- `minAge / maxAge / category / scene / tags` 目前主要用于推荐和后台数据组织，前台尚未完全产品化。
- 内置库中的 `sort_order` 主要服务于后台治理或数据初始化，不一定是前台主排序。

### 11.3 缺失

- 前台缺少显式的“事情分类浏览 / 筛选”入口。
- 前台缺少显式的“年龄适配说明”页面，只有推荐权重和少量数据维度。
- 前台缺少“启用 / 停用某件内置事”的产品入口。
- 前台缺少“什么是内置事 / 什么是自定义事”的专门说明页，用户只能从界面元素和文案感知。
- 前台没有统一呈现 `category / scene / tags / seasons / qualityScore` 的完整管理视图。

## 12. 管理后台必须支持的实体、字段、操作与约束

以下是从 App 真实需求倒推出的后台最小必需集合。

### 12.1 必须支持的实体

- `levels`：内置事情库
- `custom_levels`：家庭自定义事情
- `memories`：记录内容
- `kids`：孩子
- `families`：家庭
- `family_members`：家庭成员关系
- `notification_templates`：推送模板
- `notification_preferences`：家庭通知偏好

### 12.2 内置事情 `levels` 必须支持的字段

- `num`
- `perspective`
- `tone`
- `title`
- `why`
- `how`
- `record`
- `suggest`
- `sealed`
- `sealKind`
- `sealUntil`
- `sealedOn`
- `seasonal`
- `kid`
- `illustrationPath`
- `category`
- `scene`
- `minAge`
- `maxAge`
- `seasons`
- `tags`
- `qualityScore`
- `sort_order`

约束：

- `num` 必须唯一。
- `perspective` 只能是 `parent / child / together`。
- `suggest` 只能是 `photo / video / voice / text`。
- `tone` 必须与主题色体系一致。
- `illustrationPath` 可能是完整 URL，也可能是公开桶相对路径。
- `sealed`、`sealKind` 需要和实际封存 UX 一致，否则前台会出现无意义状态。

### 12.3 自定义事情 `custom_levels` 必须支持的字段

- `family_id`
- `user_id`
- `num`
- `title`
- `why`
- `how`
- `record_hint`
- `perspective`
- `tone`
- `suggest`
- `illustration_path`

约束：

- `num` 应在家庭内唯一，且保持稳定，否则旧记忆会对不上。
- 删除自定义事时应处理其封面文件清理。
- 修改自定义事时，若未显式改封面，不能自动覆盖已有封面。

### 12.4 记忆 `memories` 必须支持的字段

- `id`
- `family_id`
- `user_id`
- `kid_id`
- `level_num`
- `perspective`
- `type`
- `duration`
- `shots`
- `date`
- `place`
- `title`
- `caption`
- `transcript`
- `tone`
- `sealed`
- `seal_until`
- `seal_label`
- `invite_token_id`
- `invited_role`
- `created_at`

约束：

- `level_num` 必须能回链到现存事情。
- `kid_id` 可以为全家语义值 `all`。
- `type` 必须与实际媒体结构一致。
- `sealed` 记录不能泄露封存内容。
- `caption`、`transcript`、`shots`、`duration` 都是用户回看的关键。

### 12.5 孩子 `kids` 必须支持的字段

- `family_id`
- `user_id`
- `name`
- `birth_year`
- `birth_month`
- `tone`
- `bear`
- `since`
- `accessories`

约束：

- 删除孩子是重操作，会级联清掉该孩子的回忆与相关资产。
- 年龄是推荐和展示的重要来源。

### 12.6 家庭 `families / family_members` 必须支持的操作

- 创建家庭
- 加入家庭
- 离开家庭
- 创建者移除成员
- 读取成员名册
- 读取邀请码

约束：

- 家庭是数据隔离边界。
- 自定义事情、孩子、记忆都必须按 `family_id` 隔离。

### 12.7 推送与通知必须支持的操作

- 按 scene 读取模板
- 发测试推送
- 登记设备
- 标记点击
- 调整家庭通知偏好

## 13. 现有后台明显遗漏

### 13.1 对“事情”主模型的遗漏

- 没有把 `why / how / record / suggest` 作为一等内容管理对象去治理。
- 没有把自定义事情封面与内置插画路径统一成可检视、可追踪的资产管理视图。
- 没有把 `category / scene / tags / seasons / qualityScore` 产品化为可编辑的管理维度。
- 没有显式的 `enabled / disabled` 管控策略。

### 13.2 对“事实库 vs 家庭自定义”的遗漏

- 没有明确区分“全局内置事库”和“家庭级自定义事库”的后台权限边界。
- 没有把“家庭自定义事”按家庭、创建者、封面、修改历史、删除回收做成闭环。

### 13.3 对“记录数据”的遗漏

- 没有面向运营或审核提供 `memories` 的内容级检视能力。
- 没有把封存内容与普通内容分层查看。
- 没有把 `kid / level / family` 三者关系做成可追溯的内容面板。

### 13.4 对“产品定义”的遗漏

- 没有一处能回答“这件事情为什么值得做、怎么做、记什么、为什么推荐这种记录形式”。
- 没有一处能回答“这件事属于内置库还是家庭自定义”。
- 没有一处能回答“这件事有没有封面、封面从哪里来、是否可删”。

## 14. 给后台重设计的直接建议

1. 把 `levels`、`custom_levels`、`memories` 分成三个明确的管理对象，不要混成一个“活动/内容”列表。
2. 给 `levels` 建立内容编辑面板，至少暴露 `title / why / how / record / suggest / perspective / tone / seasonal / minAge / maxAge / category / scene / tags / illustrationPath / sealed / sealKind / sort_order`。
3. 给 `custom_levels` 建立家庭视图和封面资产视图，支持追踪创建者、家庭、更新时间和删除影响。
4. 给 `memories` 建立检索和回看视图，允许按家庭、孩子、事情编号、封存状态、媒体类型过滤。
5. 把“是否启用”“是否封存”“是否季节限定”“适合哪种记录”从隐含逻辑变成显式字段和约束。

## 15. 证据索引

- [App.tsx](/home/coder/workspaces/yibai/App.tsx)
- [src/data/index.ts](/home/coder/workspaces/yibai/src/data/index.ts)
- [src/data/DataProvider.tsx](/home/coder/workspaces/yibai/src/data/DataProvider.tsx)
- [src/screens/HomeFeed.tsx](/home/coder/workspaces/yibai/src/screens/HomeFeed.tsx)
- [src/screens/LevelDetail.tsx](/home/coder/workspaces/yibai/src/screens/LevelDetail.tsx)
- [src/screens/AddOwnLevel.tsx](/home/coder/workspaces/yibai/src/screens/AddOwnLevel.tsx)
- [src/screens/OwnLevels.tsx](/home/coder/workspaces/yibai/src/screens/OwnLevels.tsx)
- [src/screens/RecordFlow.tsx](/home/coder/workspaces/yibai/src/screens/RecordFlow.tsx)
- [src/screens/Memory.tsx](/home/coder/workspaces/yibai/src/screens/Memory.tsx)
- [src/screens/RecordsCalendar.tsx](/home/coder/workspaces/yibai/src/screens/RecordsCalendar.tsx)
- [src/screens/YearReview.tsx](/home/coder/workspaces/yibai/src/screens/YearReview.tsx)
- [src/screens/SealedPage.tsx](/home/coder/workspaces/yibai/src/screens/SealedPage.tsx)
- [src/components/Motifs.tsx](/home/coder/workspaces/yibai/src/components/Motifs.tsx)
- [src/components/MemoryCover.tsx](/home/coder/workspaces/yibai/src/components/MemoryCover.tsx)
- [src/i18n/locales/zh.ts](/home/coder/workspaces/yibai/src/i18n/locales/zh.ts)
- [supabase-docker/migrations/20260723_curated_100_levels.sql](/home/coder/workspaces/yibai/supabase-docker/migrations/20260723_curated_100_levels.sql)
