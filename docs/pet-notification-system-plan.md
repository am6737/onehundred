# 宠物拟人化通知系统 — 实现方案

## 概述

让用户为孩子选择一个宠物伙伴（小熊/小狗/小猫），由宠物以自己的性格"说话"，发送推送通知。宠物在 App 内以 Rive 交互动画呈现，通知和 Widget 使用静态图片。

---

## 一、三个宠物的性格定义

| 属性 | 小熊 Bear | 小狗 Dog | 小猫 Cat |
|------|----------|---------|---------|
| 名字 | 团团 Dango | 旺旺 Woof | 咪咪 Mimi |
| 默认色 | orange | green | pink |
| 性格 | 温柔、安静、像一个陪伴型朋友 | 热情、活泼、像一个兴奋的小伙伴 | 傲娇、高冷、嘴硬心软 |
| 说话风格 | 轻声细语、用"呢""呀"结尾 | 感叹号多、用"哇""耶"、很激动 | 假装不在意、反话、偶尔漏出关心 |
| emoji 风格 | 🐻 🌙 🍯 | 🐶 ⭐ 🎉 | 🐱 💤 ✨ |

---

## 二、通知场景 × 性格文案模板

### 场景 1：温柔提醒（3 天没记录）

| 宠物 | 中文 | English |
|------|------|---------|
| 小熊 | 团团翻了翻日记本，最近几页还是空白的呢 🐻 | Dango flipped through the journal… the last few pages are still blank 🐻 |
| 小狗 | 旺旺好几天没看到新故事了！今天有什么好玩的吗？🐶 | Woof hasn't seen a new story in days! Anything fun happen today? 🐶 |
| 小猫 | 咪咪才不关心你们有没有记录呢。才没有。✨ | Mimi doesn't care if you haven't been recording. Not at all. ✨ |

### 场景 2：成长唤起（7 天没记录）

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | 这一周宝宝一定又长大了一点吧…团团想听呀 🌙 | The little one must have grown a bit this week… Dango would love to hear about it 🌙 |
| 小狗 | 一整周了！旺旺急死了！快来说说这周都干了什么！🎉 | A whole week!! Woof is dying to know! What happened?! 🎉 |
| 小猫 | 一周了哦。不过咪咪才不会催你呢。只是顺便提一下。💤 | It's been a week. Not that Mimi would rush you. Just mentioning it. 💤 |

### 场景 3：损失暗示（14 天没记录）

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | 有些小事不记下来，真的会忘掉的呢…团团有点担心 🍯 | Little moments can slip away if you don't write them down… Dango is a bit worried 🍯 |
| 小狗 | 两周了！旺旺都快把之前的事忘了，你们也是吧？快记下来！🐶 | Two weeks!! Woof is already forgetting things, aren't you too? Write them down! 🐶 |
| 小猫 | 两周没记了。记忆这种东西，丢了就丢了吧。…真的没关系吗？🐱 | Two weeks with nothing. Memories fade, I guess. …Is that really fine though? 🐱 |

### 场景 4：里程碑庆祝（快解锁新装扮）

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | 已经记了 {{done}} 件事啦！再记 {{remain}} 件，团团就有新衣服穿了呀 🐻 | {{done}} things recorded! Just {{remain}} more and Dango gets a new outfit 🐻 |
| 小狗 | 哇 {{done}} 件了！！还差 {{remain}} 件旺旺就能换新衣服啦！冲冲冲！⭐ | Wow {{done}} done!! Just {{remain}} more for Woof's new outfit! Let's gooo! ⭐ |
| 小猫 | {{done}} 件了。再来 {{remain}} 件的话…咪咪的新衣服就到了。随便你啦。✨ | {{done}} done. {{remain}} more and… Mimi's new outfit arrives. Whatever. ✨ |

### 场景 5：时间胶囊即将开启

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | 那封写给未来的信，还有 {{days}} 天就要自己出现了呢 🌙 | That letter to the future will reveal itself in {{days}} days 🌙 |
| 小狗 | 还有 {{days}} 天！！那封信就要开了！旺旺好期待好期待！🎉 | {{days}} days left!! The letter is about to open! Woof can't wait!! 🎉 |
| 小猫 | {{days}} 天后那封信会打开。咪咪没有在倒数哦。才没有。💤 | That letter opens in {{days}} days. Mimi is NOT counting down. Definitely not. 💤 |

### 场景 6：家人记录了新内容

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | {{who}}刚刚记了一件新的事，一起去看看呀 🐻 | {{who}} just recorded something new, let's go see 🐻 |
| 小狗 | {{who}}记了新的了！！快去看快去看！🐶 | {{who}} added something new!! Go look go look! 🐶 |
| 小猫 | {{who}}记了一件事。咪咪看过了。还行吧。✨ | {{who}} recorded something. Mimi already saw it. It's okay I guess. ✨ |

### 场景 7：连续记录鼓励（连续 N 天有记录）

| 宠物 | 中文 | English |
|------|------|------|
| 小熊 | 连续 {{days}} 天都有记录了呢，团团好开心呀 🍯 | {{days}} days in a row! Dango is so happy 🍯 |
| 小狗 | {{days}} 天连续记录！！旺旺骄傲得尾巴都摇断了！🎉 | {{days}} days straight!! Woof's tail is wagging off! 🎉 |
| 小猫 | 连续 {{days}} 天了…好吧，咪咪承认你们还挺厉害的。🐱 | {{days}} days in a row… Fine, Mimi admits that's impressive. 🐱 |

---

## 三、动画技术方案（参考多邻国实现）

### 3.1 多邻国是怎么做的

多邻国使用 **Rive** 作为角色动画引擎，以下信息来自已验证的官方来源：

> **Rive 官方博客**（Creative Technologists at Duolingo）：
> "Before, animators supplied a mockup with technical specifications... But now, Rive lets our animators and creative technologists create the actual asset that is used in the app."

> **Duolingo 工程博客**（World Character Visemes）：
> Rive 是 "a web-based tool for making real-time interactive animations, similar to a game engine"。State Machine 是 "a visual representation of the logic that connects the animations together. It allowed us to programmatically control which animation states are called, how they transition and blend together."

> **Rive 官方博客**（Lily AI Video Call）：
> "The final Rive file is under a megabyte despite the complexity." 8 种头部动画 × 8 种身体动画动态组合，产生 64+ 种变体。

**多邻国的三层技术分工：**

| 用途 | 技术 | 说明 |
|------|------|------|
| 角色交互动画 | **Rive** | Duo、Lily 等角色的表情、肢体、口型同步 |
| UI 动效 | **Lottie** | 转场、庆祝撒花、引导动画（几千个 Lottie 文件） |
| 通知 / Widget / App 图标 | **静态图片** | 预渲染的不同表情插图 |

**参考来源：**
- https://rive.app/blog/creative-technologists-duolingo-s-solution-to-the-designer-to-developer-handoff
- https://blog.duolingo.com/world-character-visemes/
- https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life

### 3.2 我们的动画架构

参考多邻国，采用同样的三层分工：

```
┌─────────────────────────────────────────────────┐
│                   动画技术栈                      │
├─────────────────────────────────────────────────┤
│                                                  │
│  App 内宠物页面 ─── Rive (.riv)                   │
│  │  • 交互动画（点击、拖拽、长按）                  │
│  │  • 状态机驱动情绪切换                           │
│  │  • 多层并行（身体 + 表情 + 配件）                │
│  │  • 状态间平滑过渡                               │
│  │  • 单个文件 < 1MB                              │
│  │                                               │
│  UI 动效 ─── Lottie (.json)                      │
│  │  • 解锁庆祝撒花                                │
│  │  • 装扮切换动画                                 │
│  │  • 页面转场                                    │
│  │                                               │
│  通知 / Widget ─── 静态图片 (.png)                 │
│     • 推送通知 largeIcon（256×256）                │
│     • 桌面小组件表情（512×512）                     │
│     • App 图标变体（如果做动态图标）                 │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 3.3 Rive 宠物文件结构

每个宠物一个 `.riv` 文件，内部包含：

```
bear.riv (< 1MB)
├── 骨骼部件
│   ├── 头部（含耳朵）
│   ├── 身体
│   ├── 四肢
│   ├── 眼睛（左/右，独立控制）
│   ├── 嘴巴
│   └── 尾巴
│
├── 状态机：PetStateMachine
│   ├── 情绪层（Emotion Layer）
│   │   ├── happy（开心）
│   │   ├── waiting（等待）
│   │   ├── sad（委屈）
│   │   ├── celebrate（庆祝）
│   │   ├── sleepy（困困）
│   │   ├── anxious（着急）
│   │   ├── expecting（期待）
│   │   ├── surprised（惊喜）
│   │   └── clingy（撒娇）
│   │
│   ├── 身体层（Body Layer）—— 与情绪层并行
│   │   ├── idle（站立呼吸）
│   │   ├── bounce（蹦跳）
│   │   ├── sit（坐下）
│   │   └── sleep（睡觉蜷缩）
│   │
│   ├── 微表情层（Micro Layer）—— 随机触发，避免看起来假
│   │   ├── blink（眨眼，随机间隔 3-8 秒）
│   │   ├── ear_twitch（耳朵抖动）
│   │   ├── look_around（左右看）
│   │   └── yawn（打哈欠）
│   │
│   └── 配件层（Accessory Layer）
│       ├── hat_slot
│       ├── scarf_slot
│       └── glasses_slot
│
├── 状态机输入
│   ├── emotion (Number 0-8) → 切换情绪状态
│   ├── onTap (Trigger) → 点击摸头反应
│   ├── onDrag (Trigger) → 拖拽反应
│   ├── onLongPress (Trigger) → 长按撒娇
│   ├── hatId (Number) → 当前帽子 ID（0=无）
│   ├── scarfId (Number) → 当前围巾 ID（0=无）
│   └── glassesId (Number) → 当前眼镜 ID（0=无）
│
└── 过渡动画
    └── 任意两个情绪状态之间的混合过渡（0.3s ease-in-out）
```

### 3.4 React Native 接入

使用 `@rive-app/react-native`（官方支持，要求 RN 0.78+ / Expo SDK 53+，我们的 Expo 56 兼容）：

```jsx
import { RiveView, useRiveNumber, useRiveTrigger } from '@rive-app/react-native'

function PetScreen({ species, emotion }) {
  // 情绪控制
  const { setValue: setEmotion } = useRiveNumber('emotion')

  // 交互触发
  const { fire: fireTap } = useRiveTrigger('onTap')
  const { fire: fireLongPress } = useRiveTrigger('onLongPress')

  // 情绪变化时切换状态
  useEffect(() => { setEmotion(emotion) }, [emotion])

  const source = {
    bear: require('./assets/pets/bear.riv'),
    dog: require('./assets/pets/dog.riv'),
    cat: require('./assets/pets/cat.riv'),
  }[species]

  return (
    <RiveView
      source={source}
      stateMachineName="PetStateMachine"
      style={{ width: 300, height: 300 }}
      onTouchStart={() => fireTap()}
      onLongPress={() => fireLongPress()}
    />
  )
}
```

### 3.5 情绪状态映射

| 编号 | 状态 | 触发场景 |
|------|------|---------|
| 0 | happy | 完成记录、连续打卡、被点击 |
| 1 | waiting | 宠物页默认状态 |
| 2 | sad | 3-7 天没记录 |
| 3 | celebrate | 里程碑达成、解锁装扮 |
| 4 | sleepy | 晚间免打扰时段 |
| 5 | anxious | 14+ 天没记录 |
| 6 | expecting | 时间胶囊即将开启 |
| 7 | surprised | 家人记录了新内容 |
| 8 | clingy | 被长按、宠物饿了 |

### 3.6 宠物性格通过动画体现

同一个情绪编号，三个宠物的动画表现不同：

| 情绪 | 团团（温柔） | 旺旺（活泼） | 咪咪（傲娇） |
|------|------------|------------|------------|
| happy | 轻轻摇头微笑 | 蹦跳、吐舌、摇尾巴 | 假装看别处，但尾巴翘起来了 |
| sad | 抱紧日记本，眼角泛光 | 趴下，耳朵耷拉，大眼睛往上看 | 背对你，但偷偷回头看 |
| celebrate | 小幅蹦跳，脸上冒星星 | 原地转圈，全身都在动 | 抬下巴，闭眼微笑，一脸"我早知道" |
| clingy | 伸手，身体前倾 | 翻肚皮打滚 | 头蹭过来，假装不经意 |

---

## 四、数据库变更

### 4.1 mascots 表增加 species 字段

```sql
ALTER TABLE public.mascots
  ADD COLUMN species TEXT NOT NULL DEFAULT 'bear'
  CHECK (species IN ('bear', 'dog', 'cat'));

COMMENT ON COLUMN public.mascots.species IS '宠物种类：bear/dog/cat';
```

### 4.2 新建 notification_templates 表

```sql
CREATE TABLE public.notification_templates (
  id          SERIAL PRIMARY KEY,
  scene       TEXT NOT NULL,       -- 'gentle_remind', 'growth_nudge', 'loss_hint', 'milestone', 'capsule', 'family_activity', 'streak'
  species     TEXT NOT NULL,       -- 'bear', 'dog', 'cat'
  lang        TEXT NOT NULL,       -- 'zh', 'en'
  title       TEXT NOT NULL,       -- 通知标题
  body        TEXT NOT NULL,       -- 通知正文，支持 {{done}}, {{remain}}, {{days}}, {{who}} 等变量
  sort_order  INT DEFAULT 0,      -- 同场景同宠物多条模板时的轮换序号
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_templates_lookup ON notification_templates (scene, species, lang);
```

### 4.3 新建 notification_log 表（防重复 + 数据分析）

```sql
CREATE TABLE public.notification_log (
  id           BIGSERIAL PRIMARY KEY,
  kid_id       TEXT NOT NULL REFERENCES public.kids(id),
  family_id    TEXT NOT NULL,
  scene        TEXT NOT NULL,
  template_id  INT REFERENCES public.notification_templates(id),
  sent_at      TIMESTAMPTZ DEFAULT now(),
  clicked      BOOLEAN DEFAULT false,
  clicked_at   TIMESTAMPTZ
);

CREATE INDEX idx_notif_log_kid ON notification_log (kid_id, sent_at DESC);
```

### 4.4 新建 notification_preferences 表

```sql
CREATE TABLE public.notification_preferences (
  family_id    TEXT PRIMARY KEY REFERENCES public.families(id),
  enabled      BOOLEAN DEFAULT true,
  frequency    TEXT DEFAULT 'normal' CHECK (frequency IN ('gentle', 'normal', 'frequent')),
  quiet_start  TIME DEFAULT '22:00',
  quiet_end    TIME DEFAULT '08:00',
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

---

## 五、后端调度（Supabase Edge Function + pg_cron）

### 5.1 定时任务：每小时检查一次需要发送通知的用户

```sql
SELECT cron.schedule(
  'check-notification-triggers',
  '0 * * * *',
  $$SELECT net.http_post(
    'https://<project>.supabase.co/functions/v1/send-pet-notifications',
    '{}',
    '{}'::jsonb
  )$$
);
```

### 5.2 Edge Function 逻辑（send-pet-notifications）

```
输入: 无（自动扫描）

流程:
1. 查询所有启用通知的家庭
2. 对每个家庭，计算：
   - days_since_last_record（距上次记录天数）
   - current_streak（连续记录天数）
   - done_count / next_unlock_threshold（里程碑进度）
   - upcoming_capsules（即将开启的时间胶囊）
   - recent_family_records（家人最近记录）
3. 根据条件匹配场景：
   - days_since >= 3 且 < 7  → gentle_remind
   - days_since >= 7 且 < 14 → growth_nudge
   - days_since >= 14        → loss_hint
   - next_unlock - done <= 3 → milestone
   - capsule_days <= 30      → capsule
   - family_record < 24h     → family_activity
   - streak >= 3             → streak
4. 查 notification_log 防止同场景 24h 内重复发送
5. 按宠物 species + lang 从 notification_templates 选模板
6. 同场景多模板时，选最久没用过的（简单版遗忘曲线）
7. 替换变量 → 调 DooPush API 发送
8. 写入 notification_log
```

### 5.3 发送频率控制

| 频率设置 | gentle_remind | growth_nudge | loss_hint |
|---------|--------------|-------------|-----------|
| gentle（轻柔） | 5天触发 | 10天触发 | 21天触发 |
| normal（正常） | 3天触发 | 7天触发 | 14天触发 |
| frequent（积极） | 2天触发 | 5天触发 | 10天触发 |

全局规则：
- 每个家庭每天最多 1 条推送
- 免打扰时段不发送（延迟到次日）
- 同一场景 48h 内不重复

---

## 六、前端改动

### 6.1 宠物选择页面（新增）

入口：首次创建孩子时 / 设置页"更换宠物"

```
┌─────────────────────────────────────┐
│       选一个小伙伴陪你们             │
│       记录每一件小事吧               │
│                                     │
│  ┌─────┐  ┌─────┐  ┌─────┐        │
│  │ 🐻  │  │ 🐶  │  │ 🐱  │        │
│  │ 团团 │  │ 旺旺 │  │ 咪咪 │        │
│  │ 温柔 │  │ 活泼 │  │ 傲娇 │        │
│  └─────┘  └─────┘  └─────┘        │
│                                     │
│  选中时播放该宠物的 Rive idle 动画    │
│  + 性格描述文字                      │
│                                     │
│         [ 就选团团吧 ]               │
└─────────────────────────────────────┘
```

### 6.2 Mascot.tsx 改造

- 用 `RiveView` 替换现有的静态渲染
- 根据 `species` 加载对应 `.riv` 文件
- 现有的拍拍交互改为触发 Rive `onTap` trigger
- 装扮系统通过 Rive 配件层的 Number 输入控制
- 启用 `SHOW_MASCOT = true`

### 6.3 设置页增加通知偏好

```
┌─────────────────────────────────────┐
│  🔔 宠物提醒                        │
│                                     │
│  提醒频率    [ 正常 ▼ ]              │
│  免打扰      22:00 - 08:00          │
│  更换宠物    团团 🐻 >               │
└─────────────────────────────────────┘
```

### 6.4 通知点击深度链接

点击通知 → 打开 app → 跳转到对应页面：
- gentle_remind / growth_nudge / loss_hint → 首页（开始记录）
- milestone → 宠物页（查看进度）
- capsule → 时间胶囊页
- family_activity → 对应记录详情
- streak → 宠物页（庆祝动画）

---

## 七、美术资源清单

### 7.1 Rive 文件（App 内交互动画）

| 文件 | 内容 | 预估大小 |
|------|------|---------|
| bear.riv | 团团全部骨骼 + 9 情绪 + 交互 + 配件 | < 1MB |
| dog.riv | 旺旺全部骨骼 + 9 情绪 + 交互 + 配件 | < 1MB |
| cat.riv | 咪咪全部骨骼 + 9 情绪 + 交互 + 配件 | < 1MB |

### 7.2 静态图片（通知 + Widget）

| 资源 | 尺寸 | 数量 | 用途 |
|------|------|------|------|
| 通知大图标 | 256×256 PNG | 3（每宠物 1 个） | Android largeIcon |
| 通知小图标 | 96×96 PNG 白色轮廓 | 1（通用） | Android smallIcon |
| Widget 表情 | 512×512 PNG | 每宠物 5 个（开心/普通/委屈/困/着急） | 桌面小组件 |

### 7.3 Lottie 文件（UI 动效）

| 文件 | 用途 |
|------|------|
| unlock_celebrate.json | 解锁新装扮时的撒花庆祝 |
| streak_fire.json | 连续打卡火焰特效 |
| confetti.json | 通用庆祝撒花 |

### 7.4 制作方式

1. 用 AI 生成的图片和视频作为**设计参考稿**
2. 在 Rive 编辑器（rive.app）中照着参考稿重新制作骨骼动画
3. 拆分身体部件 → 绑定骨骼 → 做关键帧动画 → 设置状态机 → 导出 `.riv`
4. 通知用静态图片直接从 AI 生成的结果中截取

---

## 八、实施步骤

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0：Rive 制作** | 在 Rive 编辑器中制作 3 个宠物的 .riv 文件 | 1-2 周（或外包） |
| **P1：数据库 + 后端** | 建表、写模板数据、Edge Function 调度逻辑 | 2-3 天 |
| **P2：宠物选择 + Mascot 改造** | 选择页 UI、RiveView 接入、mascots.species 写入 | 2-3 天 |
| **P3：通知偏好 + 深度链接** | 设置页、通知点击跳转 | 1-2 天 |
| **P4：数据验证** | notification_log 分析点击率、按场景/宠物优化文案 | 持续 |

---

## 九、后续迭代方向

1. **AI 动态文案**：接入 LLM，结合孩子名字、最近记录内容、季节生成个性化文案
2. **模板轮换算法**：参考多邻国的 Bandit 算法，自动选择点击率最高的模板
3. **桌面小组件**：宠物表情随记录状态变化（静态图片，参考多邻国 Widget 实现）
4. **动态 App 图标**：iOS `setAlternateIconName` 根据状态切换宠物表情图标
5. **宠物成长**：记录越多宠物长越大，增加视觉反馈
6. **更多宠物**：兔子、熊猫等作为解锁/付费内容
7. **自定义宠物**：参考 Codex Petdex 的两文件格式（pet.json + spritesheet），开放用户上传
