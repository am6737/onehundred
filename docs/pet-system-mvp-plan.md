# 宠物系统 MVP 方案

## 目标

用最低成本快速上线宠物系统，验证用户反馈。后续再迁移到 Rive 方案。

## 技术选型

| 层面 | MVP 方案 | 后续 Rive 方案 |
|------|---------|---------------|
| 宠物展示 | **MP4 视频循环播放（expo-video）** | Rive .riv 文件 |
| 状态切换 | **切换视频源 + 淡入淡出** | Rive 状态机平滑过渡 |
| 交互 | **点击触发 Reanimated 弹跳** | Rive onTap/onDrag trigger |
| 通知图标 | **静态 PNG** | 不变 |
| 迁移成本 | — | 替换 PetView 组件内部实现，外部接口不变 |

## 核心原则

**封装 PetView 组件**——对外只暴露 `species` 和 `emotion` 两个 prop。MVP 内部用 MP4 视频 + Reanimated，迁移 Rive 时只改组件内部，其他代码不用动。

---

## 一、素材组织

```
assets/pets/
  bear/
    videos/
      happy.mp4
      waiting.mp4
      sad.mp4
      celebrate.mp4
      sleepy.mp4
      anxious.mp4
      expecting.mp4
      surprised.mp4
      clingy.mp4
    icon.png          ← 通知用 256×256
  dog/
    videos/
      ...同上
    icon.png
  cat/
    videos/
      ...同上
    icon.png
```

每个状态一个 MP4 循环视频（2-3 秒），直接使用 AI 生成的视频文件。

---

## 二、PetView 组件

```tsx
// src/components/PetView.tsx

import { useVideoPlayer, VideoView } from 'expo-video'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated'
import { Pressable, StyleSheet } from 'react-native'
import { useEffect, useMemo } from 'react'

const VIDEOS = {
  bear: {
    happy: require('../../assets/pets/bear/videos/happy.mp4'),
    waiting: require('../../assets/pets/bear/videos/waiting.mp4'),
    sad: require('../../assets/pets/bear/videos/sad.mp4'),
    celebrate: require('../../assets/pets/bear/videos/celebrate.mp4'),
    sleepy: require('../../assets/pets/bear/videos/sleepy.mp4'),
    anxious: require('../../assets/pets/bear/videos/anxious.mp4'),
    expecting: require('../../assets/pets/bear/videos/expecting.mp4'),
    surprised: require('../../assets/pets/bear/videos/surprised.mp4'),
    clingy: require('../../assets/pets/bear/videos/clingy.mp4'),
  },
  dog: { /* 同上 */ },
  cat: { /* 同上 */ },
}

const EMOTIONS = ['happy','waiting','sad','celebrate','sleepy','anxious','expecting','surprised','clingy'] as const
type Emotion = typeof EMOTIONS[number]
type Species = 'bear' | 'dog' | 'cat'

interface PetViewProps {
  species: Species
  emotion: Emotion
  size?: number
  onTap?: () => void
}

export function PetView({ species, emotion, size = 280, onTap }: PetViewProps) {
  const source = VIDEOS[species]?.[emotion] ?? VIDEOS[species]?.waiting

  const player = useVideoPlayer(source, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // 情绪变化时切换视频源
  useEffect(() => {
    const newSource = VIDEOS[species]?.[emotion] ?? VIDEOS[species]?.waiting
    player.replace(newSource)
    player.loop = true
    player.play()
  }, [emotion, species])

  // 点击弹跳动画
  const translateY = useSharedValue(0)
  const handleTap = () => {
    translateY.value = withSequence(
      withTiming(-20, { duration: 100 }),
      withTiming(0, { duration: 200, easing: Easing.bounce }),
    )
    onTap?.()
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Pressable onPress={handleTap}>
      <Animated.View style={animatedStyle}>
        <VideoView
          player={player}
          style={{ width: size, height: size }}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      </Animated.View>
    </Pressable>
  )
}
```

### 使用方式

```tsx
// 宠物页面
<PetView species="bear" emotion="happy" onTap={() => playSound('pat')} />

// 根据 app 状态自动切换情绪
const emotion = usePetEmotion(kidId)
<PetView species={mascot.species} emotion={emotion} />
```

### 迁移到 Rive 时

只改 PetView 内部实现，外部 prop 接口不变：

```tsx
// 迁移后的 PetView
export function PetView({ species, emotion, onTap }: PetViewProps) {
  const { setValue } = useRiveNumber('emotion')
  const { fire } = useRiveTrigger('onTap')
  useEffect(() => setValue(EMOTIONS.indexOf(emotion)), [emotion])
  return <RiveView source={RIV_FILES[species]} onTouchStart={() => { fire(); onTap?.() }} />
}
```

---

## 三、情绪计算 Hook

```tsx
// src/hooks/usePetEmotion.ts

type Emotion = 'happy' | 'waiting' | 'sad' | 'celebrate' | 'sleepy' |
               'anxious' | 'expecting' | 'surprised' | 'clingy'

export function usePetEmotion(kidId: string): Emotion {
  const { records, capsules, streak, doneCount, nextUnlock } = useKidData(kidId)

  const daysSinceLastRecord = getDaysSince(records[0]?.created_at)
  const hour = new Date().getHours()

  // 优先级从高到低
  if (hour >= 22 || hour < 7) return 'sleepy'
  if (streak >= 3) return 'happy'
  if (nextUnlock - doneCount <= 3) return 'expecting'
  if (daysSinceLastRecord >= 14) return 'anxious'
  if (daysSinceLastRecord >= 7) return 'sad'
  if (daysSinceLastRecord >= 3) return 'clingy'

  return 'waiting'
}
```

---

## 四、数据库变更

与完整方案一致，参见 pet-notification-system-plan.md 第四节。

```sql
-- 1. mascots 表加 species
ALTER TABLE public.mascots
  ADD COLUMN species TEXT NOT NULL DEFAULT 'bear'
  CHECK (species IN ('bear', 'dog', 'cat'));

-- 2. 通知模板表
CREATE TABLE public.notification_templates (
  id          SERIAL PRIMARY KEY,
  scene       TEXT NOT NULL,
  species     TEXT NOT NULL,
  lang        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_templates_lookup ON notification_templates (scene, species, lang);

-- 3. 通知日志表
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

-- 4. 通知偏好表
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

## 五、前端页面

### 5.1 宠物选择页

入口：首次创建孩子时 / 设置页"更换宠物"

选择界面展示三个宠物的 waiting 状态视频循环播放，选中时弹跳动画 + 显示性格描述。

### 5.2 宠物主页面（Mascot.tsx 改造）

- 顶部：PetView 组件展示当前宠物 + 情绪视频
- 点击宠物：弹跳 + 播放爱心粒子（沿用现有 pat 交互）
- 中部：装扮格子（沿用现有 wardrobe 系统）
- 底部：成长日记（沿用现有 growth diary）

### 5.3 设置页通知偏好

```
┌─────────────────────────────────────┐
│  宠物提醒                            │
│                                     │
│  提醒频率    [ 正常 ▼ ]              │
│  免打扰      22:00 - 08:00          │
│  更换宠物    团团 🐻 >               │
└─────────────────────────────────────┘
```

### 5.4 通知点击深度链接

与完整方案一致，参见 pet-notification-system-plan.md 第六节。

---

## 六、后端通知调度

与完整方案一致，参见 pet-notification-system-plan.md 第五节。

Edge Function 通过 pg_cron 每小时触发，扫描各家庭记录状态，匹配场景，选模板，调 DooPush 发送。

---

## 七、实施步骤

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0：素材准备** | 将 AI 生成的视频放入 assets/pets/ 对应目录 + 截取通知图标 | 0.5 天 |
| **P1：PetView 组件** | 封装 expo-video 循环播放 + Reanimated 弹跳 + usePetEmotion hook | 1 天 |
| **P2：宠物选择页** | 3 选 1 UI + 写入 mascots.species | 0.5 天 |
| **P3：Mascot.tsx 改造** | 接入 PetView 替换现有渲染 + 启用 SHOW_MASCOT | 1 天 |
| **P4：数据库 + 后端** | 建表 + 通知模板数据 + Edge Function | 2 天 |
| **P5：设置页 + 深度链接** | 通知偏好 UI + 通知点击跳转 | 1 天 |
| **总计** | | **约 6 天** |

---

## 八、MVP → Rive 迁移路径

MVP 上线后，根据用户反馈决定是否迁移到 Rive：

| 步骤 | 内容 |
|------|------|
| 1 | 在 Rive 编辑器中制作 3 个 .riv 文件（导入 AI 图片做骨骼动画） |
| 2 | 安装 @rive-app/react-native |
| 3 | 替换 PetView 组件内部实现（外部 prop 接口不变） |
| 4 | 删除 assets/pets/ 下的视频文件（通知图标保留） |
| 5 | 测试状态切换、交互、装扮功能 |

**迁移时不影响其他代码**——因为 PetView 封装了所有渲染逻辑，外部只传 species 和 emotion。
