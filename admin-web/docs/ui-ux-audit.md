# 后台管理系统 UI/UX 审计与重构计划

审计范围：`src/App.tsx`、`src/styles.css`、`src/components/**`、`src/features/**`

审计标准：Vercel Web Interface Guidelines（审计时获取最新版本）。

## 严重问题

### 语义结构与导航

- `src/components/ui/sidebar.tsx:304` - `SidebarInset` 使用 `<main>`，功能页面再次渲染 `<main>`，形成嵌套 main；第一阶段已改为普通布局容器。
- `src/components/app-sidebar.tsx:65` - 品牌入口和主导航原使用按钮执行页面跳转，不支持链接语义、复制地址及 Cmd/Ctrl+单击；第一阶段已改为 hash 链接。
- `src/App.tsx:176` - 原布局缺少 skip link；第一阶段已添加“跳到主内容”。
- `src/components/site-header.tsx:53` - 顶栏与功能页面同时使用 `<h1>`，造成标题层级重复；第一阶段已让 Dashboard 顶栏承担主标题，其余页面使用页面内部主标题。

### 表单可访问性

- `src/features/activity-library/index.tsx:425` - 通用文本域标签没有 `htmlFor`，点击标签不能聚焦控件。
- `src/features/activity-library/index.tsx:651` - 标题输入标签没有与输入框关联。
- `src/features/activity-library/index.tsx:692` - 多个治理表单输入缺少 `id`、`name` 和关联标签。
- `src/features/moderation/index.tsx:490` - 新建审核任务表单依赖 placeholder 说明字段，缺少持久可见标签。
- `src/features/auth/AdminAuthGate.tsx:113` - 登录字段需要统一检查 `name`、`autocomplete`、拼写检查和错误聚焦。

## 高优先级问题

### 状态与 URL

- `src/features/users/index.tsx:252` - 搜索、筛选、排序、详情选择主要保存在本地状态，刷新或分享 URL 后无法恢复。
- `src/features/families/index.tsx:224` - 家庭筛选、分页和详情状态未同步到 URL。
- `src/features/moderation/index.tsx:602` - 队列筛选和选中案件未形成可深链状态。
- `src/features/activity-library/index.tsx:1080` - 页面包含大量 tab、筛选和选中项状态，应分批同步到查询参数。

### 文案与输入提示

- `src/features/auth/AdminAuthGate.tsx:146` - `登录中...` 应使用 `登录中…`；纳入第二阶段表单整改。
- `src/features/content/ContentManagementPage.tsx:294` - 加载状态使用三个句点，应使用省略号字符。
- `src/features/activity-library/index.tsx:755` - placeholder 以 `...` 结尾，应使用 `…`。
- `src/features/users/index.tsx:340` - 搜索 placeholder 缺少示例格式与结尾省略号。
- `src/features/notifications/index.tsx:206` - 搜索控件缺少可见或程序化标签的一致实现。

### 交互与焦点

- `src/features/activity-library/index.tsx:866` - 弹窗输入框无条件 `autoFocus`，移动端可能直接弹出键盘；应仅在桌面端明确启用。
- `src/components/nav-user.tsx:67` - “个人资料”和“权限信息”菜单项当前没有行为，形成可聚焦但无结果的控件。
- `src/components/admin/confirm-action-dialog.tsx:74` - 确认操作加载状态原未使用省略号及 live 状态；第一阶段已整改。

### 长列表性能

- `src/components/data-table.tsx:355` - 通用表格直接渲染全部行；数据超过 50 行时需要分页或虚拟化约束。
- `src/features/activity-library/index.tsx:1288` - 事情库列表与详情文件规模大、状态集中，需在后续阶段拆分展示组件并限制一次渲染数量。
- `src/features/moderation/index.tsx:389` - 审核队列需要确认仓储层分页始终生效，避免大数组直接 `.map()`。

## 中优先级问题

### 视觉一致性

- `src/features/dashboard/index.tsx:247` - Dashboard 没有与其他页面一致的页面标题区，当前依赖顶栏标题。
- `src/features/activities/index.tsx:190` - 页面标题、描述和操作区由业务页面自行组合，间距和断点不统一。
- `src/features/notifications/index.tsx:194` - 页面头部结构与活动、审核、用户页面存在细节差异。
- `src/features/users/index.tsx:315` - 列表与详情分别手写页面头部，后续应迁移到统一 `AdminPageHeader`。
- `src/features/families/index.tsx:336` - 页面头部、筛选条和详情返回操作需要统一布局模板。

### 数据展示

- `src/features/users/index.tsx:72` - 标识符截断使用 `...`；应使用 `…` 并保留可复制的完整值。
- `src/features/families/index.tsx:86` - 标识符截断样式同上。
- `src/features/audit/index.tsx:152` - 审计对象标识符截断样式同上。
- `src/components/admin/admin-pagination.tsx:76` - 总数和页码需要 tabular numbers；第一阶段已整改。
- `src/components/chart-area-interactive.tsx:155` - 图表参考日期硬编码为 2026-07-28，应确认是否仅演示数据，避免线上趋势窗口失真。

### 动效与主题

- `src/components/ui/button.tsx:8` - 基础按钮原使用 `transition-all`；第一阶段已改为显式属性。
- `src/components/ui/badge.tsx:8` - Badge 原使用 `transition-all`；第一阶段已整改。
- `src/components/ui/tabs.tsx:66` - Tabs 原使用 `transition-all`；第一阶段已整改。
- `src/styles.css:270` - 页面进入动画已支持 reduced motion；后续需继续检查图表、抽屉与 loading 动画。
- `index.html:7` - 原 theme-color 只有单一浅色值；第一阶段已增加明暗模式值。

## 统一设计基线

### 布局

- Sidebar：展开宽度 16rem，图标模式 3rem；导航项最小高度 36px，统一 8px 圆角。
- Header：固定 4rem，高对比底边，半透明背景；移动端保留侧栏开关、当前页面名和用户菜单。
- Content：最大宽度 1280px；桌面水平 padding 使用响应式 clamp，移动端 16px；底部兼容 safe area。
- 页面层级：每个页面只有一个 `<h1>`；区域使用 `<section>` + `<h2>`；详情卡片使用 `<h3>`。

### 视觉

- 颜色全部使用现有语义 token：background、card、muted、primary、destructive、border、ring。
- 共享卡片统一 `radius-xl`、细边框和轻量阴影；避免业务页面自定义渐变。
- 主操作使用 default，次操作使用 outline/ghost，危险操作只使用 destructive。
- 数量、页码、金额和对比数字使用 `tabular-nums`。

### 表单

- 每个字段必须有唯一 `id`、稳定 `name`、关联 `Label htmlFor`。
- 搜索字段使用 `type="search"`，非认证搜索设置 `autoComplete="off"`。
- 邮箱使用 `type="email"`、`autoComplete="email"`、`spellCheck={false}`。
- 错误紧邻字段，使用 `aria-invalid`、`aria-describedby`，提交失败后聚焦首个错误。
- 提交开始后显示 `处理中…` 或具体动作，不在请求开始前禁用提交按钮。

### 状态

- 所有数据区域具备 loading、empty、error、ready 四态。
- 异步结果通过 Toast 或区域 `aria-live="polite"` 通知。
- 搜索、筛选、排序、分页、tab 和详情选中状态逐步同步到 URL。
- 删除、封禁、驳回等危险操作必须明确说明对象和不可逆后果。

## 分阶段计划

1. **全局布局、导航和共享基础组件**：语义布局、skip link、链接导航、Header、主题、动效、分页和确认弹窗。
2. **表单与弹窗**：登录、事情编辑、治理理由、新建审核任务；统一 Field、错误状态和自动完成属性。
3. **表格、筛选和 URL 状态**：用户、家庭、记录、审计、通知及审核队列。
4. **Dashboard 和状态组件**：统一 Page Header、指标卡、图表替代文本、Loading/Empty/Error。
5. **高风险治理流程**：审核、内容治理、设置和权限提示；验证确认语义与审计反馈。
6. **性能与最终回归**：大列表分页/虚拟化、键盘巡检、移动端巡检、颜色对比和构建验证。


## 第二阶段实施记录：表单与弹窗

已完成：

- 新增 `src/components/ui/textarea.tsx`，统一 textarea 的焦点、无效、禁用、明暗主题和响应式样式。
- 新增 `src/components/admin/admin-field.tsx`，统一可见标签、必填语义、描述和错误区域。
- `src/features/auth/AdminAuthGate.tsx`：补全 `name`、`autocomplete`、邮箱拼写检查、错误关联、错误焦点、live region 和加载省略号。
- `src/features/moderation/index.tsx`：案件搜索、队列治理理由、新建案件和处理案件全部补全标签、名称、描述、最小长度及原生表单提交语义。
- `src/features/activity-library/index.tsx`：事情草稿、版本内容、高级字段、记录方式、发布目标、复制到家庭和治理理由全部建立标签关联；移除移动端不安全的 `autoFocus`。
- `src/components/admin/governance-access-card.tsx`：治理理由改用共享 Textarea，添加唯一 ID、状态描述和 live region。
- `src/features/records/index.tsx`：列表与详情治理理由增加可见标签、最小长度、状态关联和统一 Textarea。
- `src/components/ui/dialog.tsx`：Dialog Overlay/Content 遵循 reduced motion，关闭图标标记为装饰性。
- 提交按钮不再因字段尚未填满而提前禁用；仅在请求进行中、只读模式或权限不足时禁用，由原生约束和业务校验提供错误反馈。

第二阶段后续仍需在各业务模块持续迁移：

- 用户、家庭、通知、活动配置、系统设置中的搜索与治理字段。
- 表单提交失败后统一聚焦第一个自定义校验错误。
- Drawer/Sheet 内复杂表单的字段描述和未保存离开提醒。
- 将业务页面中的零散操作状态统一迁移到共享 Form Message/Operation Notice。
