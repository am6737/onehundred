# 已完成事项首页隐藏 + 回忆删除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当前孩子做过的活动从首页 feed 消失；回忆详情页支持删除，删掉该孩子在该活动上的最后一条回忆后卡片自动回归首页。

**Architecture:** 完成状态纯派生（`memories` 中存在 `levelNum+perspective` 匹配且归属该孩子的记录 = 已完成），不新增字段。删除链路为 `deleteMemory`（Supabase 删行 + best-effort 清 Storage）→ `DataProvider.removeMemory`（更新本地 state）→ `MemoryPage` 删除按钮（Alert 二次确认）。首页在洗牌池处过滤已完成项，全做完时 EndCard 切换为「都做完了」文案。

**Tech Stack:** Expo / React Native（新架构）、Supabase（Postgres + Storage 私有桶 `memories`）、React Context（`DataProvider`）、React Navigation。

**Spec:** `docs/superpowers/specs/2026-06-10-completed-levels-hide-and-delete-design.md`

**测试说明:** 本项目无自动化测试基建（package.json 无任何 test runner），按 spec 约定每个任务用手动验证步骤代替 TDD。开发中修改代码后**不需要**杀死或重启任何进程（项目约定，热更新生效）。

---

### Task 1: 数据层 `deleteMemory(id)`

**Files:**
- Modify: `src/data/index.ts`（在 `insertMemory` 之后，约 L211 处插入）

- [ ] **Step 1: 实现 `deleteMemory`**

在 `src/data/index.ts` 的 `insertMemory`（结束于 L211 的 `}`）之后插入：

```javascript
export async function deleteMemory(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  const { error } = await supabase.from('memories').delete().eq('id', id);
  if (error) throw error;
  // best-effort 清理 Storage 媒体目录，失败不阻塞删除
  try {
    const dir = `${session.user.id}/${id}`;
    const { data: files, error: listErr } = await supabase.storage.from('memories').list(dir);
    if (listErr) throw listErr;
    if (files && files.length > 0) {
      const { error: rmErr } = await supabase.storage
        .from('memories')
        .remove(files.map(f => `${dir}/${f.name}`));
      if (rmErr) throw rmErr;
    }
  } catch (e) {
    console.warn('deleteMemory storage cleanup:', e?.message || e);
  }
}
```

注意：

- `supabase` 已在该文件顶部 import，无需新增 import。
- 风格对齐同文件的 `insertMemory`（先校验 session，错误直接 throw）。
- Storage 目录结构 `${userId}/${memoryId}/<name>.<ext>`，与 `src/lib/media.ts:33` 的读取逻辑一致；桶名为 `memories`。
- 不需要清理 `src/lib/media.ts` 的 `mediaCache`：memory id 以 `m${Date.now()}` 生成不会复用，残留缓存项无害。

- [ ] **Step 2: 语法检查**

Run: `npx tsc --noEmit 2>&1 | head -20`（若项目未配 tsc 报错与本次改动无关即可）；或最低限度 `node --check` 不适用于 ts/jsx 时，确认 Metro 无红屏报错。

Expected: 无与 `src/data/index.ts` 相关的新增错误。

- [ ] **Step 3: Commit**

```bash
git add src/data/index.ts
git commit -m "feat(data): add deleteMemory with best-effort storage cleanup"
```

---

### Task 2: `DataProvider.removeMemory(id)`

**Files:**
- Modify: `src/data/DataProvider.tsx`（import 区 L2-11、`addMemory` 之后 L67、context value L92）

- [ ] **Step 1: import `deleteMemory`**

`src/data/DataProvider.tsx` 顶部 import 中（L5 处，`insertMemory, insertKid, updateProfile,` 一行）加入 `deleteMemory`：

```javascript
  insertMemory, insertKid, updateProfile, deleteMemory,
```

- [ ] **Step 2: 新增 `removeMemory` 并挂到 context value**

在 `addMemory`（L63-67）之后插入：

```javascript
  const removeMemory = useCallback(async (id) => {
    await deleteMemory(id);
    setMemories(prev => prev.filter(m => m.id !== id));
  }, []);
```

并在 context value（L92 `addMemory, addKid, addCustomLevel, updateMe,`）中加入：

```javascript
    addMemory, removeMemory, addKid, addCustomLevel, updateMe,
```

注意：先 `await` 远端删除成功才更新本地 state——删除失败时本地不变，由调用方提示用户（spec「错误处理」节）。完成状态、done 计数、回忆册列表、宠物成长等全部派生自 `memories`，state 更新后自动联动，无需其他改动。

- [ ] **Step 3: Commit**

```bash
git add src/data/DataProvider.tsx
git commit -m "feat(data): expose removeMemory in DataProvider"
```

---

### Task 3: 首页过滤已完成 + EndCard「都做完了」态

**Files:**
- Modify: `src/screens/HomeFeed.tsx`（`levels` useMemo L695-699、`data` useMemo L701-716、`EndCard` L609-675、`renderCard` L830-839）

- [ ] **Step 1: 洗牌池过滤已完成活动**

把 `src/screens/HomeFeed.tsx` L695-699 的：

```javascript
  const levels = useMemo(() => {
    let pool = allLevels().filter(l => l.perspective === perspective);
    if (!pool.length) pool = allLevels();
    return weightedShuffle(pool, kidId);
  }, [perspective, shuffleKey, kidId, allLevels, weightedShuffle]);
```

改为：

```javascript
  const levels = useMemo(() => {
    let pool = allLevels().filter(l => l.perspective === perspective);
    if (!pool.length) pool = allLevels();
    // 当前孩子做过的活动不再出现（kid='all' 的记录对每个孩子都算做过）
    const doneSet = new Set(memoriesForKid(kidId).map(m => `${m.perspective}|${m.levelNum}`));
    pool = pool.filter(l => !doneSet.has(`${l.perspective}|${l.num}`));
    return weightedShuffle(pool, kidId);
  }, [perspective, shuffleKey, kidId, allLevels, weightedShuffle, memoriesForKid]);
```

关键点：

- 完成过滤必须放在 `if (!pool.length) pool = allLevels()` **之后**——该 fallback 的语义是「这个视角没有任何活动」；全做完属于过滤后为空，不能回退成显示全部。
- key 用 `perspective|levelNum` 双字段匹配，自定义活动（`num` 为 `★` 前缀字符串）同样适用。
- `memoriesForKid` 来自 `useData()`（L684 已解构），其归属口径自带 `m.kid === id || m.kid === 'all'`。

- [ ] **Step 2: `data` useMemo 标记全做完态**

把 L701-716 的 `data` useMemo 中 `items.push({ type: 'end', key: 'end' });` 一行改为：

```javascript
    items.push({ type: 'end', key: 'end', allDone: !empty && levels.length === 0 });
```

（`empty` 为「该孩子一条回忆都没有」的欢迎态，L689；`!empty && levels.length === 0` 即「做过事且池子被过滤空 = 全做完」。）

- [ ] **Step 3: `EndCard` 支持 `allDone`**

修改 L609 的 `EndCard`：签名加 `allDone` prop，文案按状态切换，全做完时隐藏「换一批」按钮（池子已空，重洗无意义）：

```javascript
function EndCard({ onBook, onReshuffle, onAddOwn, cardHeight, allDone }) {
  const { theme } = useTheme();

  return (
    <View style={{
      height: cardHeight,
      justifyContent: 'center', alignItems: 'center',
      paddingTop: 120, paddingBottom: 70, paddingHorizontal: 36,
    }}>
      <Text style={{
        fontFamily: theme.fonts.hand, fontSize: 21, lineHeight: 38,
        color: theme.ink, textAlign: 'center',
      }}>
        {allDone
          ? '这里的事，你们都做完啦。\n翻翻回忆册，或者加一件你们家自己的事。'
          : '这一轮先到这。\n换一批，也许会遇见刚好想做的那件。'}
      </Text>

      <View style={{ marginTop: 24, width: '100%', maxWidth: 300, gap: 12 }}>
        {/* Reshuffle — 全做完时池子为空，重洗无意义，隐藏 */}
        {!allDone && (
          <TouchableOpacity
            onPress={onReshuffle}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 8, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 999,
              backgroundColor: theme.accent,
              shadowColor: theme.accent, shadowOpacity: 0.4, shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 }, elevation: 6,
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.head, fontSize: 16, color: '#FFFDF7',
            }}>换一批，继续翻</Text>
          </TouchableOpacity>
        )}
        ...（「加一件我们家自己的事」「翻翻已经做过的」两个按钮原样保留，不动）
      </View>
    </View>
  );
}
```

（`...` 处为 L643-671 的现有两个 TouchableOpacity，保持原样；此处省略是为了可读性，执行时不要删除它们。）

- [ ] **Step 4: `renderCard` 透传 `allDone`**

L830-839 的 end 分支改为：

```javascript
    if (item.type === 'end') {
      return (
        <EndCard
          onBook={handleOpenBook}
          onReshuffle={reshuffle}
          onAddOwn={() => setAddOwnVisible(true)}
          cardHeight={cardHeight}
          allDone={item.allDone}
        />
      );
    }
```

- [ ] **Step 5: 手动验证首页过滤**

在已运行的 app 中（不需重启）：

1. 选中某孩子，给某活动走完记录流程 → 回首页翻卡，该活动不再出现。
2. 顶部切换到另一个孩子 → 该活动卡片仍出现。
3. 欢迎卡「已做 N 件」计数正常、翻页无卡死或空白页。

Expected: 三条全部符合。

- [ ] **Step 6: Commit**

```bash
git add src/screens/HomeFeed.tsx
git commit -m "feat(home): hide completed levels per kid; all-done end card"
```

---

### Task 4: 回忆详情页删除按钮

**Files:**
- Modify: `src/screens/Memory.tsx`（import L1-14、`MemoryPage` L255 起、分享按钮之后 L519-532）

- [ ] **Step 1: 补 import**

L2-5 的 react-native import 中加入 `Alert`：

```javascript
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Dimensions, Image, Alert,
} from 'react-native';
```

（`useData` 已在 L10 import，无需改动。）

- [ ] **Step 2: `MemoryPage` 内加状态与处理函数**

在 `MemoryPage`（L255）函数体内、`const [shareVisible, ...]`（L259）附近加入：

```javascript
  const { removeMemory } = useData();
  const [deleting, setDeleting] = useState(false);
```

并在 `if (!m) return null;`（L266）之后加入：

```javascript
  const confirmDelete = () => {
    Alert.alert(
      '删除这条回忆？',
      '删掉就找不回来了，这件事会重新回到首页。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await removeMemory(m.id);
              navigation.goBack();
            } catch (e) {
              setDeleting(false);
              Alert.alert('删除失败', '网络好像不太好，稍后再试试。');
            }
          },
        },
      ],
    );
  };
```

- [ ] **Step 3: 分享按钮下方加删除入口**

在 `PrimaryButton`（「做成一张卡片」，L520-532）之后、`</View>` 之前插入低调的文字按钮：

```javascript
          {/* ── Delete (低调入口，二次确认) ── */}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            activeOpacity={0.7}
            style={{
              marginTop: 14, paddingVertical: 12,
              alignItems: 'center',
              opacity: deleting ? 0.4 : 1,
            }}
          >
            <Text style={{
              fontFamily: theme.fonts.body, fontSize: 14, color: '#C25B4E',
            }}>{deleting ? '正在删除…' : '删除这条回忆'}</Text>
          </TouchableOpacity>
```

样式说明：与主行动「做成一张卡片」明确区分（无底色纯文字、偏暗的砖红 `#C25B4E` 贴合纸质暖色盘）；`deleting` 时禁用 + 降透明度防双击。

- [ ] **Step 4: 手动验证删除链路**

1. 回忆册 → 打开一条回忆 → 点「删除这条回忆」→ 弹确认框，「取消」无事发生。
2. 再点删除并确认 → 返回回忆册，该条消失；Supabase `memories` 表该行已删，Storage `userId/memoryId/` 目录文件已清（控制台无报错或仅 cleanup warn）。
3. 断网状态下删除 → 弹「删除失败」，回忆仍在列表中。

Expected: 三条全部符合。

- [ ] **Step 5: Commit**

```bash
git add src/screens/Memory.tsx
git commit -m "feat(memory): add delete with confirm on memory detail page"
```

---

### Task 5: 全链路手动验收

**Files:** 无代码改动。

- [ ] **Step 1: 按 spec 验证清单跑通五条**

1. 记录一件事 → 首页该卡片消失（仅对应孩子）。
2. 切换另一个孩子 → 卡片仍显示。
3. 详情页删除唯一一条回忆 → 返回后首页卡片回归。
4. 同一件事记两条 → 删一条不回归，删第二条回归。
5. 把某视角的事全做完 → 首页显示「都做完啦」状态卡，且无「换一批」按钮，「加一件自己的事」「翻翻已经做过的」可用。

Expected: 五条全部通过。任何一条不过 → 回到对应 Task 修复后重验。

- [ ] **Step 2: 最终检查与收尾**

```bash
git log --oneline -5   # 确认 4 个 feature commit 都在
git status             # 工作区干净（common.tsx 的既有未提交改动除外，不属于本计划范围）
```
