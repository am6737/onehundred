# 宠物系统 Sprite Sheet 方案（Codex 风格）

## 概述

参考 Codex 宠物系统的实现方式，将 AI 生成的动画视频抽帧拼成 Sprite Sheet，实现逐帧动画播放。效果接近视频，体积远小于视频，实现简单。

---

## 一、方案对比定位

| | 静态图 MVP | **Sprite Sheet（本方案）** | Rive（终极方案） |
|---|---|---|---|
| 动画效果 | 呼吸/弹跳，比较假 | **逐帧动画，像看视频** | 骨骼驱动，最流畅 |
| 素材来源 | AI 截图 | **AI 视频抽帧** | Rive 编辑器重制 |
| 素材制作 | 0.5 天 | 1 天 | 1-2 周 |
| 文件体积 | ~27 张 PNG，很小 | 每宠物 ~2-5MB | 每宠物 < 1MB |
| 交互性 | 点击弹跳 | 点击切状态播放 | 拖拽、触摸、骨骼响应 |
| 状态过渡 | 淡入淡出 | 播完当前帧再切 | 平滑混合 |

---

## 二、Sprite Sheet 制作流程

### 2.1 从 AI 视频抽帧

每个状态视频抽取 24-48 帧（2 秒 × 12-24fps）：

```bash
# ffmpeg 抽帧（每个状态视频执行一次）
ffmpeg -i bear_happy.mp4 -vf "fps=12,scale=192:192" bear_happy_%03d.png
ffmpeg -i bear_waiting.mp4 -vf "fps=12,scale=192:192" bear_waiting_%03d.png
# ... 其他状态同理
```

### 2.2 拼成 Sprite Sheet

将所有帧拼成一张大图，每行一个动画状态：

```bash
# 用 ImageMagick 拼图（示例：每行 24 帧，共 9 行）
montage bear_happy_*.png -tile 24x1 -geometry 192x192+0+0 row_happy.png
montage bear_waiting_*.png -tile 24x1 -geometry 192x192+0+0 row_waiting.png
# ... 拼完所有行后纵向合并
convert row_happy.png row_waiting.png row_sad.png row_celebrate.png \
        row_sleepy.png row_anxious.png row_expecting.png row_surprised.png \
        row_clingy.png -append bear_spritesheet.webp
```

### 2.3 最终文件结构

每个宠物只需要两个文件（与 Codex Petdex 格式一致）：

```
assets/pets/
  bear/
    pet.json              ← 元数据 + 动画映射
    spritesheet.webp      ← 所有帧拼成一张图
    icon.png              ← 通知用 256×256 静态图标
  dog/
    pet.json
    spritesheet.webp
    icon.png
  cat/
    pet.json
    spritesheet.webp
    icon.png
```

---

## 三、pet.json 格式定义

```json
{
  "name": "团团",
  "nameEn": "Dango",
  "species": "bear",
  "frameSize": { "width": 192, "height": 192 },
  "cols": 24,
  "animations": {
    "happy":      { "startRow": 0, "frames": 24, "fps": 12, "mode": "loop" },
    "waiting":    { "startRow": 1, "frames": 24, "fps": 12, "mode": "loop" },
    "sad":        { "startRow": 2, "frames": 24, "fps": 12, "mode": "loop" },
    "celebrate":  { "startRow": 3, "frames": 24, "fps": 12, "mode": "loop" },
    "sleepy":     { "startRow": 4, "frames": 24, "fps": 12, "mode": "loop" },
    "anxious":    { "startRow": 5, "frames": 24, "fps": 12, "mode": "loop" },
    "expecting":  { "startRow": 6, "frames": 24, "fps": 12, "mode": "loop" },
    "surprised":  { "startRow": 7, "frames": 24, "fps": 12, "mode": "once" },
    "clingy":     { "startRow": 8, "frames": 24, "fps": 12, "mode": "loop" }
  }
}
```

**字段说明：**
- `frameSize`：每帧的像素尺寸
- `cols`：每行的帧数
- `startRow`：该动画在 Sprite Sheet 中的起始行
- `frames`：该动画的总帧数
- `fps`：播放帧率
- `mode`：`loop`（循环播放）或 `once`（播放一次后回到 idle）

---

## 四、Sprite Sheet 参数规格

| 参数 | 值 | 说明 |
|------|---|------|
| 每帧尺寸 | 192 × 192 px | 在 @2x 屏幕上显示为 96pt，清晰且不过大 |
| 每行帧数 | 24 帧 | 2 秒 × 12fps |
| 行数 | 9 行 | 9 个情绪状态 |
| 总帧数 | 216 帧 | 24 × 9 |
| 图片总尺寸 | 4608 × 1728 px | (192×24) × (192×9) |
| 格式 | WebP | 比 PNG 小 50-70%，RN 原生支持 |
| 预估体积 | 2-5 MB / 宠物 | 取决于画面复杂度 |

---

## 五、PetView 组件实现

### 5.1 方案 A：rn-sprite-sheet

```tsx
// src/components/PetView.tsx

import SpriteSheet from 'rn-sprite-sheet'
import { useRef, useEffect } from 'react'

const SHEETS = {
  bear: require('../../assets/pets/bear/spritesheet.webp'),
  dog: require('../../assets/pets/dog/spritesheet.webp'),
  cat: require('../../assets/pets/cat/spritesheet.webp'),
}

const PET_META = {
  bear: require('../../assets/pets/bear/pet.json'),
  dog: require('../../assets/pets/dog/pet.json'),
  cat: require('../../assets/pets/cat/pet.json'),
}

type Emotion = 'happy' | 'waiting' | 'sad' | 'celebrate' | 'sleepy' |
               'anxious' | 'expecting' | 'surprised' | 'clingy'
type Species = 'bear' | 'dog' | 'cat'

interface PetViewProps {
  species: Species
  emotion: Emotion
  size?: number
  onTap?: () => void
}

export function PetView({ species, emotion, size = 280, onTap }: PetViewProps) {
  const spriteRef = useRef<SpriteSheet>(null)
  const meta = PET_META[species]

  useEffect(() => {
    const anim = meta.animations[emotion]
    spriteRef.current?.play({
      type: emotion,
      fps: anim.fps,
      loop: anim.mode === 'loop',
      onFinish: () => {
        if (anim.mode === 'once') {
          spriteRef.current?.play({ type: 'waiting', fps: 12, loop: true })
        }
      },
    })
  }, [emotion, species])

  // 构建动画定义：从 pet.json 转换为 rn-sprite-sheet 格式
  const animations = Object.fromEntries(
    Object.entries(meta.animations).map(([name, anim]) => {
      const startFrame = anim.startRow * meta.cols
      const frames = Array.from({ length: anim.frames }, (_, i) => startFrame + i)
      return [name, frames]
    })
  )

  return (
    <Pressable onPress={onTap}>
      <SpriteSheet
        ref={spriteRef}
        source={SHEETS[species]}
        columns={meta.cols}
        rows={Object.keys(meta.animations).length}
        width={size}
        height={size}
        animations={animations}
      />
    </Pressable>
  )
}
```

### 5.2 方案 B：@shopify/react-native-skia Atlas（性能更好）

```tsx
// src/components/PetView.tsx

import { Canvas, Atlas, useImage, rect, RSXform } from '@shopify/react-native-skia'
import { useSharedValue, useDerivedValue, useFrameCallback } from 'react-native-reanimated'

type Emotion = 'happy' | 'waiting' | 'sad' | 'celebrate' | 'sleepy' |
               'anxious' | 'expecting' | 'surprised' | 'clingy'
type Species = 'bear' | 'dog' | 'cat'

interface PetViewProps {
  species: Species
  emotion: Emotion
  size?: number
  onTap?: () => void
}

export function PetView({ species, emotion, size = 280, onTap }: PetViewProps) {
  const image = useImage(SHEETS[species])
  const meta = PET_META[species]
  const anim = meta.animations[emotion]

  const frameIndex = useSharedValue(0)
  const elapsed = useSharedValue(0)
  const frameDuration = 1000 / anim.fps

  // UI 线程帧循环
  useFrameCallback((info) => {
    elapsed.value += info.timeSinceFirstFrame
    if (elapsed.value >= frameDuration) {
      elapsed.value = 0
      const next = frameIndex.value + 1
      frameIndex.value = anim.mode === 'loop'
        ? next % anim.frames
        : Math.min(next, anim.frames - 1)
    }
  })

  // 计算当前帧在 sprite sheet 中的位置
  const sprite = useDerivedValue(() => {
    const col = frameIndex.value % meta.cols
    const row = anim.startRow + Math.floor(frameIndex.value / meta.cols)
    return rect(
      col * meta.frameSize.width,
      row * meta.frameSize.height,
      meta.frameSize.width,
      meta.frameSize.height,
    )
  })

  const transform = useDerivedValue(() =>
    RSXform(size / meta.frameSize.width, 0, 0, 0)
  )

  if (!image) return null

  return (
    <Pressable onPress={onTap}>
      <Canvas style={{ width: size, height: size }}>
        <Atlas
          image={image}
          sprites={[sprite]}
          transforms={[transform]}
        />
      </Canvas>
    </Pressable>
  )
}
```

### 5.3 两种方案对比

| | rn-sprite-sheet | Skia Atlas |
|---|---|---|
| 渲染线程 | JS 线程 | **UI 线程（更流畅）** |
| 依赖 | rn-sprite-sheet（轻量） | @shopify/react-native-skia（较重） |
| 性能 | 够用 | **更好，适合复杂场景** |
| 维护状态 | 不太活跃 | Shopify 维护，活跃 |
| 推荐 | 快速实现 | 长期使用 |

---

## 六、情绪计算 + 交互

与 MVP 方案一致：

```tsx
// src/hooks/usePetEmotion.ts
export function usePetEmotion(kidId: string): Emotion {
  const { records, streak, doneCount, nextUnlock } = useKidData(kidId)
  const daysSinceLastRecord = getDaysSince(records[0]?.created_at)
  const hour = new Date().getHours()

  if (hour >= 22 || hour < 7) return 'sleepy'
  if (streak >= 3) return 'happy'
  if (nextUnlock - doneCount <= 3) return 'expecting'
  if (daysSinceLastRecord >= 14) return 'anxious'
  if (daysSinceLastRecord >= 7) return 'sad'
  if (daysSinceLastRecord >= 3) return 'clingy'
  return 'waiting'
}
```

点击交互：
- 单击 → 播放 `happy` 动画一次 → 回到当前情绪
- 长按 → 播放 `clingy` 动画

---

## 七、数据库 + 后端通知

与完整方案一致，参见 pet-notification-system-plan.md 第四、五节。

---

## 八、实施步骤

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0：抽帧拼图** | ffmpeg 抽帧 + ImageMagick/脚本拼 Sprite Sheet + 写 pet.json | 1 天 |
| **P1：PetView 组件** | Sprite Sheet 播放 + 情绪切换 + 点击交互 | 1-2 天 |
| **P2：宠物选择页** | 3 选 1 UI + 写入 mascots.species | 0.5 天 |
| **P3：Mascot.tsx 改造** | 接入 PetView + 启用 SHOW_MASCOT | 1 天 |
| **P4：数据库 + 后端** | 建表 + 通知模板 + Edge Function | 2 天 |
| **P5：设置页 + 深度链接** | 通知偏好 UI + 通知点击跳转 | 1 天 |
| **总计** | | **约 7 天** |

---

## 九、自定义宠物扩展（后续）

Sprite Sheet 方案天然支持自定义宠物，参考 Codex Petdex 格式：

1. 用户上传一张 Sprite Sheet + 填写 pet.json（或通过 UI 标记每行对应的动作）
2. 服务端校验格式和尺寸
3. 存入宠物商店供其他用户下载
4. 下载后放入本地 assets，PetView 自动识别

---

## 十、迁移到 Rive

与 MVP 方案相同——PetView 组件封装了所有渲染逻辑，迁移时只改内部实现：

```tsx
// 迁移后
export function PetView({ species, emotion, onTap }: PetViewProps) {
  const { setValue } = useRiveNumber('emotion')
  const { fire } = useRiveTrigger('onTap')
  useEffect(() => setValue(EMOTIONS.indexOf(emotion)), [emotion])
  return <RiveView source={RIV_FILES[species]} onTouchStart={() => { fire(); onTap?.() }} />
}
```

外部调用方式完全不变。
