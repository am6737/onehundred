# 家庭共享 / 邀请加入 — 设计

日期：2026-06-11
状态：已确认，待写实现计划

## 1. 背景与目标

### 场景
爸爸先注册、建好家、填了孩子信息并开始记录。妈妈注册这个 app **只是为了加入这个家**，不应该被强制再填一遍"孩子叫我什么"和"添加孩子"。她加入后应当看到**和爸爸同一个孩子、同一批回忆、同一只小熊**。

### 当前现状（为什么现在做不到）
- 后端**完全按账号隔离**：`kids` / `memories` / `mascots` / `custom_levels` 的 RLS 都是 `auth.uid() = user_id`，没有任何家庭/成员/邀请概念。
- "邀请家人 / 加入"目前是**纯 mock**：`InviteFlow` 里点分享只弹"功能正在打磨"的 Alert；`JoinFlow`（邀请码屏）**没有任何地方导航到它**，是死代码。
- 所有登录路径（邮箱、游客登录）都把用户塞进 `Onboarding`，强制填角色 + 孩子。
- 媒体存储路径是 `${userId}/${memoryId}/…`，storage RLS 只允许本人文件夹 —— 即使数据表共享了，妈妈也看不到爸爸的照片/视频。

### 本次目标
把"家庭共享数据"真正打通，并让引导页支持"创建新家庭 / 加入已有家庭"两条路径。

## 2. 已确认的决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 范围 | 真正打通家庭共享（不是只做前端跳过） |
| 2 | 妈妈加入时的角色 | **要**自己选一次（妈妈/奶奶…）；只跳过"添加孩子" |
| 3 | 成员权限 | 平等：都能看全部、都能记；**只有创建者**能删孩子/移除成员 |
| 4 | 现有本地数据 | 可重置：直接改 `init/schema.sql` 重建库，不写迁移脚本 |
| 5 | RLS 策略 | denormalized `family_id` 列（不每次反查 family_members） |
| 6 | 角色存储 | 源头在 `family_members`；镜像写 `profiles.role` 以减少现有 UI 改动 |
| 7 | 小熊归属 | **属于小朋友**：一个孩子一只，跟孩子走，全家看到**同一只**（成长合并）。**不是**"全家共养一只家庭宠物" |

## 3. 数据模型（重建 `supabase-docker/volumes/db/init/schema.sql`）

### 3.1 新表

```sql
-- families：一个家 = 一份共享数据
CREATE TABLE public.families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- family_members：成员名册 + 每个人自己的角色
CREATE TABLE public.family_members (
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT '爸爸',
  custom_role TEXT NOT NULL DEFAULT '',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);
```

- `invite_code`：短口令，建家时生成（如 8 位大写字母数字），全局唯一。
- `family_members.role` 是花名册的数据源（InviteFlow 显示谁加入了、各自是什么角色）。MVP 下**一个用户只属于一个家**。

### 3.2 现有内容表改动

`kids` / `memories` / `mascots` / `custom_levels` 统一：
- **加列** `family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE`。
- `user_id` **保留**，但语义从"归属"变为"是谁记的"（用于"为你/为我"署名、回忆作者）。
- 主键调整：
  - `kids`：`(id, user_id)` → `(id)`
  - `memories`：`(id, user_id)` → `(id)`
  - `mascots`：`(kid_id, user_id)` → `(kid_id)` —— 一个孩子一只小熊，跟孩子走，全家同一只
  - `custom_levels`：`id SERIAL` 主键不变，加 `family_id`

> 注：`custom_levels` 自定义关卡也是家庭共享的（一家人共用同一套自定义关卡）。

### 3.3 profiles
- 保留现有列。`role` / `custom_role` 成为**冗余镜像**（写角色时同时更新，读"我"仍读它），见 §6。

## 4. 安全 / RLS / 邀请

### 4.1 family 上下文辅助函数（避免 RLS 自引用递归）

```sql
CREATE OR REPLACE FUNCTION public.my_family_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT family_id FROM public.family_members WHERE user_id = auth.uid() LIMIT 1;
$$;
```

### 4.2 内容表 RLS
所有内容表（kids/memories/mascots/custom_levels）：
```sql
CREATE POLICY "<t>_family" ON public.<t>
  FOR ALL USING (family_id = public.my_family_id())
  WITH CHECK (family_id = public.my_family_id());
```

### 4.3 families / family_members RLS
- `families`：成员可 SELECT 自己的家（`id = my_family_id()`）；只有 `created_by = auth.uid()` 能 UPDATE/DELETE。
- `family_members`：成员可 SELECT 同家所有行（`family_id = my_family_id()`，用于花名册）；INSERT 只走 `redeem_invite` RPC（直接 INSERT 不开放给 client）；DELETE（移除成员）只允许该家 `created_by`。

### 4.4 加入用 SECURITY DEFINER RPC
沿用现有 `delete_own_account` 的模式：
```sql
CREATE OR REPLACE FUNCTION public.redeem_invite(p_code text, p_role text, p_custom_role text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
  fid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING errcode='28000'; END IF;
  -- 已在某个家则拒绝（MVP 一人一家）
  IF EXISTS (SELECT 1 FROM public.family_members WHERE user_id = uid) THEN
    RAISE EXCEPTION 'already_in_family';
  END IF;
  SELECT id INTO fid FROM public.families WHERE invite_code = upper(trim(p_code));
  IF fid IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  INSERT INTO public.family_members(family_id, user_id, role, custom_role)
    VALUES (fid, uid, p_role, p_custom_role);
  RETURN fid;
END;
$$;
-- 仅 authenticated 可执行
```

建家用 **`create_family` RPC**（SECURITY DEFINER）：生成唯一 invite_code + 建 families + 插入创建者的 family_members 行，原子完成、保证 code 唯一。返回 `{ family_id, invite_code }`。不在 client 端拆两步写。

### 4.5 媒体桶共享（关键）
- 存储路径 `${userId}/${memoryId}/…` → **`${familyId}/${memoryId}/…`**。
- storage RLS：`(storage.foldername(name))[1] = public.my_family_id()::text`。
- 改动点 3 处：
  - `src/screens/RecordFlow.tsx` `uploadToStorage`（line ~105，参数 userId → familyId）
  - `src/lib/media.ts` `fetchMemoryMedia`（line ~33）
  - `src/data/index.ts` `deleteMemory` 清理目录（line ~220）
- 三处都需要拿到当前 familyId，统一通过一个缓存的 `getMyFamilyId()` 解析（首次查 family_members，之后缓存）。

## 5. App 流程

### 5.1 引导分叉（`src/screens/Onboarding.tsx`）
- 欢迎页保持主按钮"好，开始吧"（= 创建路径），下方加一行次要入口：**「已经有家人在用了？输入邀请码加入」**。
- **创建路径**（现有 me→child→done 基本不变）：`enter()` 时
  1. `createFamily()` → 建 families（生成 invite_code）+ 把自己以所选角色加进 family_members
  2. `addKid` 带上 family_id
  3. `replace('Home')`
- **加入路径**（折叠进 Onboarding，新分支：enterCode → pickRole → done）：
  1. 输邀请码 → 选自己的角色
  2. `joinFamily(code, role)` → 调 `redeem_invite` → 镜像写 profile.role → 刷新数据
  3. `replace('Home')`；此时 kids 已非空，不会被 `HomeWithDrawer`（App.tsx:50-54）的"零孩子→强制回引导"弹回。
- **删除死代码**：移除 `JoinFlow` 组件与 App.tsx 的 `Join` 路由（无人导航到它）。

### 5.2 InviteFlow（爸爸侧，`src/screens/InviteFlow.tsx`）
- `inviteCode`、"已加入"花名册从硬编码 → 读真实 `families.invite_code` + `family_members`。
- 三个分享方式里"复制邀请码"真复制到剪贴板；二维码 / 微信暂留"马上就好"（v1 不做）。
- 创建者侧给最小的"移除成员"操作（因为决策 3 创建者可管理）；非创建者不显示。

### 5.3 Settings 口令区（`src/screens/Settings.tsx` ~766 行）
- 显示真实邀请码（"把这串口令发给奶奶… 他们输入后就能加入这个家"）。

## 6. 数据层

### 6.1 DataProvider（`src/data/DataProvider.tsx`）
- 新增状态 `family`：`{ id, inviteCode, isCreator, members: [{userId, role, customRole}] }`。
- 新增动作：`createFamily()`、`joinFamily(code, role)`、（创建者）`removeMember(userId)`。
- `loadAll` 多拉一次"我的家 + 花名册"。

### 6.2 index.ts 写入带 family_id
- `insertKid` / `insertMemory` / `insertCustomLevel` 写入时带上 `family_id`（通过 `getMyFamilyId()`）。
- `insertCustomLevel` 的 `★N` 序号当前按"本用户已有数量"算（`.eq('user_id', …)`）；家庭共享后应改为按**本家庭**已有数量算（`.eq('family_id', …)`），否则不同成员会产生重复 `★` 编号。
- `mascots` 的 upsert（成长）冲突键是主键 `kid_id`；写入时一并带上 `family_id`。

### 6.3 角色镜像（决策 6）
- 源头：`family_members.role` / `.custom_role`。
- 写角色（建家 / 加入 / Settings 改角色）时**同时**更新 `profiles.role` / `.custom_role`。
- 读"我自己"的角色仍读 `profile`（App.tsx:58 等不动）；读花名册读 `family_members`。
- 这是有意为之的小冗余，已记录在此。

## 7. 范围

### v1 做
- 创建 / 加入家庭，数据 + 媒体共享
- 真实邀请码（建家生成、InviteFlow & Settings 显示）
- 真实花名册（每人自己的角色）
- 小熊跟孩子走、全家同一只
- 创建者专属删除权限（删孩子 / 移除成员），最小"移除成员"UI

### v1 不做（YAGNI）
- 二维码 / 微信分享
- 一个用户加入多个家庭（MVP 一人一家）
- 复杂成员管理 / 角色转让 / 退出家庭 UI
- 现有数据迁移脚本（直接重置库）

## 8. 边界与风险

- **零孩子→强制回引导** 的守卫（App.tsx:50-54）：加入成功后 kids 已非空，安全；但加入流程中途退出会被弹回引导（可接受，等同未完成引导）。
- **媒体 RLS 改错 = 妈妈看不到照片**：3 处路径 + storage policy 必须一致用 familyId，需重点测试。
- **RLS 递归**：family_members 的策略不能直接子查询 family_members；用 `my_family_id()` SECURITY DEFINER 绕开。
- **invite_code 唯一性**：用 RPC 生成并处理冲突重试。
- **一人一家约束**：`redeem_invite` 里检查；建家时也应保证创建者不会重复建。
- **游客（匿名）用户**：建家 / 加入都基于 `auth.uid()`，匿名同样可用；后续绑定邮箱后 user_id 不变，家庭关系保留。

## 9. 实现阶段（供写计划参考）

1. **Schema 重建**：families / family_members / 内容表加 family_id / 改主键 / RLS / my_family_id / create_family / redeem_invite / 媒体 RLS。重置本地库验证。
2. **数据层**：getMyFamilyId 缓存；insert* 带 family_id；DataProvider 的 family 状态 + createFamily / joinFamily / removeMember；loadAll 拉家庭。
3. **媒体路径**：RecordFlow 上传 / media.ts 读取 / deleteMemory 清理 三处切到 familyId。
4. **引导分叉**：Onboarding 创建路径接 createFamily；新增加入分支；删 JoinFlow + Join 路由。
5. **InviteFlow / Settings**：真实邀请码 + 花名册 + 最小移除成员。
6. **联调测试**：两账号（爸爸建家、妈妈加入）端到端验证数据 + 媒体共享、权限边界。

## 10. 测试要点
- 爸爸建家 → 拿到邀请码；妈妈新账号 → 加入 → 看到同一孩子/回忆/小熊。
- 妈妈记一条带照片的回忆 → 爸爸能看到，且媒体能签名显示。
- 小熊成长：爸爸喂 → 妈妈侧同一只长大。
- 权限：妈妈不能删孩子 / 不能移除成员；爸爸可以。
- 错误码：错误邀请码、已在家中再加入，给出友好提示。
