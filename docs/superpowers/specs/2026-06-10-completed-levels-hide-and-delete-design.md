# 已完成事项首页隐藏 + 回忆删除 设计文档

日期：2026-06-10

## 背景与目标

目前首页 feed（`src/screens/HomeFeed.tsx`）展示全部活动卡片，不区分是否已经做过；回忆详情页（`src/screens/Memory.tsx` 的 `MemoryPage`）只有分享和返回，没有删除能力。

目标：

1. 做完的事（当前选中的孩子已有回忆记录的活动）从首页卡片池中消失。
2. 回忆详情页支持删除该条回忆；若删的是该孩子在这件事上的最后一条记录，活动卡片重新回到首页。
3. 不做「重做」功能（本期明确不要）。

## 核心决策

- **完成状态纯派生，无新字段**：「某孩子做过某活动」= `memories` 中存在 `kid === kidId || kid === 'all'` 且 `levelNum + perspective` 匹配该活动的记录。不新增 completed 字段或独立状态表。
- **按孩子区分**：给娃 A 记录过的事，选中娃 A 时隐藏，选中娃 B 时仍显示。`kid='all'` 的记录对所有孩子都算完成（与现有 `kidDoneFrom` 计数口径一致）。
- **硬删除 + 二次确认**：直接删 `memories` 表行，附带 best-effort 清理 Storage 媒体文件；不做软删除。

## 设计

### 1. 首页过滤（`src/screens/HomeFeed.tsx`）

- 派生完成集合：`doneSet = new Set(memoriesForKid(kidId).map(m => `${m.perspective}|${m.levelNum}`))`。
- 在洗牌池构建处（现 L695-699）过滤：先按 perspective 过滤，再剔除 `doneSet` 命中的活动。自定义活动（num 为 `★` 前缀）同样适用。
- **fallback 语义调整**：现有 `if (!pool.length) pool = allLevels()` 是「该视角没有任何活动」的兜底。加入完成过滤后，若按视角过滤后非空、但剔除已完成后为空，含义是「这个视角的事全做完了」——此时不回退展示全部，而是渲染一张「都做完了」状态卡（复用 end 卡样式，文案引导去回忆册或换视角）。
- 欢迎卡「已做 N 件」计数、翻页 clamp（L725-733）不变。

### 2. 删除链路

**`src/data/index.ts` 新增 `deleteMemory(id)`**：

1. 校验 session（与现有 `insertMemory` 风格一致），无 session 抛错。
2. `supabase.from('memories').delete().eq('id', id)`，出错抛出。
3. best-effort 清理 Storage：`supabase.storage.from('memories')` 下 list `userId/{memoryId}/` 目录文件后 remove；任何失败仅 `console.warn`，不阻塞、不抛出。

**`src/data/DataProvider.tsx` 新增 `removeMemory(id)`**：

- `await deleteMemory(id)` 成功后 `setMemories(prev => prev.filter(m => m.id !== id))`，并加入 context value。
- 完成状态是派生的，因此删除后首页卡片回归、回忆册列表、done 计数、宠物成长等依赖 `memories` 的逻辑全部自动更新，无需额外同步。

### 3. 详情页 UI（`src/screens/Memory.tsx` 的 `MemoryPage`）

- 页面底部操作区新增低调的「删除这条回忆」按钮（次要样式，与分享按钮区分）。
- 点击弹 `Alert.alert` 二次确认：标题「删除这条回忆？」，说明「删掉就找不回来了，这件事会重新回到首页。」，按钮为「取消」+ 红色 destructive「删除」。
- 确认后按钮进入 loading/禁用态防双击 → `removeMemory(m.id)` → 成功 `navigation.goBack()`；失败 `Alert` 提示稍后再试并恢复按钮。

### 4. 边界情况

| 场景 | 行为 |
| --- | --- |
| 一件事有多条回忆 | 删一条仍算完成；删到该孩子最后一条才回首页（派生逻辑天然处理） |
| `kid='all'` 的回忆 | 对每个孩子都算完成；删除后对所有孩子同时回归 |
| 某视角全部做完 | 首页显示「都做完了」状态卡，不回退展示全部 |
| 删除后 feed 长度变化 | 现有 `data.length` clamp 兜底，不会停留在不存在的页 |
| Storage 清理失败 | 仅 warn，不影响删除结果 |

## 错误处理

- 数据库删除失败：详情页 Alert 提示「删除失败，稍后再试」，本地 state 不变。
- Storage 清理失败：静默（warn），允许残留孤儿文件。

## 验证

手动跑通全链路（项目无自动化测试基建）：

1. 记录一件事 → 首页该卡片消失（仅对应孩子）。
2. 切换另一个孩子 → 卡片仍显示。
3. 详情页删除唯一一条回忆 → 返回后卡片回归首页。
4. 同一件事记两条 → 删一条不回归，删第二条回归。
5. 把某视角的事全做完 → 显示「都做完了」状态卡。
