# 宠物 Rive 制作规格（即插即用契约）

本文是给「在 Rive 编辑器里做宠物 `.riv` 文件」的人（或 AI）的交付规格。
**只要严格按下面的命名与结构做，导出的 `.riv` 丢进项目就能直接动起来，代码一行不用改。**

代码侧已就位：`src/components/pet-renderers/RivePetRenderer.tsx` 用
`rive-react-native` 加载文件、按情绪推状态机输入、拍一拍触发器。契约常量集中在
`src/components/pet-renderers/rive-assets.ts`。

---

## 0. 一句话交付清单

做 3 个文件（bear / dog / cat），每个文件内部结构**完全一致**，只有形象不同：

| 物种 | 文件放这里 |
|------|-----------|
| 小熊 bear | `assets/pets/bear/pet.riv` |
| 小狗 dog  | `assets/pets/dog/pet.riv` |
| 小猫 cat  | `assets/pets/cat/pet.riv` |

> 三个文件的**状态机名、输入名、情绪编号必须一模一样**，只是美术不同 ——
> 这样它们对代码是可互换的。先只交 bear 也行，dog/cat 后补。

---

## 1. 硬契约（必须逐字一致，区分大小写）

代码就靠这几个字符串找东西，**错一个字符就不动**：

| 项 | 必须等于 | 类型 | 说明 |
|----|---------|------|------|
| 状态机名 | `State Machine 1` | State Machine | 注意中间有空格，这是 Rive 默认名，保持默认即可 |
| 情绪输入 | `emotion` | **Number** | 取值 0–8，见第 3 节 |
| 拍一拍输入 | `tap` | **Trigger** | 拍宠物时触发一次 |

- 这两个输入挂在 `State Machine 1` 上。
- 不要改名、不要加前后缀、不要用别的状态机做主入口。
- 代码运行时只会做两件事：
  - 切情绪：`setInputState('State Machine 1', 'emotion', <0-8>)`
  - 拍一拍：`fireState('State Machine 1', 'tap')`

---

## 2. Artboard（画板）规格

代码用 `fit = Contain`、`autoplay = true` 渲染，**不指定画板名**，所以用**默认画板**
（文件里第一个/被设为 default 的画板）。一个文件一个画板即可。

| 项 | 要求 |
|----|------|
| 比例 | **正方形 1:1**（如 1000×1000 或 512×512） |
| 背景 | **透明**——不要铺不透明底色矩形，宠物会叠在 app 的场景上 |
| 构图 | 形象**居中**，四周留约 8–12% 边距，避免动作时（跳跃/伸手）出血被裁 |
| 小尺寸可读性 | 实际会从 **~30px**（进度条小图标）一路用到 **~200px**（主页大图）。轮廓要简洁、对比清楚，**别放小到 30px 就糊掉的细节**。先把画板缩到 32px 预览，确认还认得出是谁 |

---

## 3. 情绪（emotion = Number，0–8）

`emotion` 是一个 Number 输入。代码按下表把整数推进来，状态机要据此切到对应表现。
**编号顺序写死在代码里（`EMOTIONS` 数组下标），不可改、不可重排。**

| 值 | key | 含义 / 表现建议 | 是否循环 | 何处用到 |
|----|-----|----------------|---------|----------|
| 0 | `happy` | 默认开心：轻微呼吸/微笑，最常态 | 循环 | 主页默认、拍一拍后回落 |
| 1 | `waiting` | 中性待机：东张西望、期待感，安静 | 循环 | 小图标默认、选择器展示 |
| 2 | `sad` | 难过：垂头、耳朵/尾巴下垂 | 循环 | 久未互动等场景 |
| 3 | `celebrate` | 庆祝：跳跃、撒花、超兴奋 | 循环（约 1–2s 一轮） | 拍一拍、解锁时刻、年度回顾 |
| 4 | `sleepy` | 困倦/睡着：闭眼、打盹、呼吸起伏 | 循环 | 年度回顾「戴围巾睡觉」卡 |
| 5 | `anxious` | 焦虑：小幅抖动、不安 | 循环 | 提醒类场景 |
| 6 | `expecting` | 期待：眼睛发亮、前倾 | 循环 | — |
| 7 | `surprised` | 惊讶：瞪眼、轻微后仰 | 循环 | — |
| 8 | `clingy` | 黏人/撒娇：蹭、求抱 | 循环 | — |

要点：
- **每个情绪都做成可无限循环的待机动作**（不是一次性播完就停）。
- 切换要平滑：从 `Any State` 用条件 `emotion == N` 过渡到各情绪状态，给短过渡时间（0.1–0.2s）避免硬跳。
- **默认值设为 0（happy）**：代码挂载后会立刻推一次 `emotion`，但把编辑器里 Number 默认值设 0，能保证加载第一帧就是对的。

---

## 4. 拍一拍（tap = Trigger）

- `tap` 是 Trigger。每次拍宠物，代码 `fireState('State Machine 1', 'tap')` 触发一次。
- 表现：一个**短促的一次性反应**（挤压回弹 / 眨眼 / 冒爱心，约 300–500ms），放完**自动回到当前情绪**。
- 实现建议：单独一个 State Machine Layer 放 tap 反应（one-shot），用 Trigger 进入、播完经 Exit 回到待机层；这样它叠在情绪之上，不打断情绪循环。
- **注意重叠**：app 在「拍一拍」时除了触发 `tap`，还会同时把 `emotion` 切到 `celebrate`（3）约 0.9s 再回 `happy`（0）。所以 `tap` 做成**轻量的瞬时反馈**就好，庆祝的大动作交给 `celebrate` 情绪，别让两者打架。

---

## 5. 别做的事 / 已由 app 负责的部分

- **主页大图的上下浮动（bob）由 app 用原生动画叠加**（`Mascot.tsx` 里包了一层 translateY）。
  所以情绪待机里**不必再做大幅整体上下浮动**，做细微的呼吸/局部动作即可，否则会和 app 的浮动叠加显得过头。
- **点击放大/弹跳**也由 `tap` Trigger + app 负责，情绪动作本身不用管点击。
- 不要在 `.riv` 里写死尺寸像素——靠矢量 + `Contain` 自适应。

---

## 6. 运行时兼容（`rive-react-native` 9.x，新架构 Fabric）

请把功能控制在 RN runtime 稳定支持的范围内：

- ✅ 矢量、网格变形(mesh)、骨骼、约束、状态机、Listeners、循环/混合动画 —— 都支持。
- ✅ 单文件单画板，体积尽量小。
- ⚠️ 字体/位图等若要外置成 referenced assets，先和工程确认；**v1 建议纯矢量、不外置资源**，最省事。
- ⚠️ 暂不需要 Data Binding / View Model：本期情绪 + 拍一拍用经典 Inputs 足够。以后做「按孩子换配色/换名字」再上数据绑定（届时会另给路径契约）。

---

## 7. 从图片/Figma 到 Rive 的注意点

- 形象务必**分件**：头、耳朵、眼睛、嘴、身体、四肢、尾巴各自成组并命名，才能绑骨骼做动作。一张合并的描摹图无法做动画。
- Figma → 导出 **SVG** → Rive 导入；保留分组。auto-layout、特效、混合模式、网格渐变不一定干净转换，**保持纯矢量形状 + 分组 + 纯色/线性渐变**最稳。
- 三个物种沿用同一套部件命名和骨骼结构，复用最省力。

---

## 8. 交付前自检清单

- [ ] 文件名 `pet.riv`，按物种放对目录（第 0 节）。
- [ ] 默认画板正方形、背景透明、形象居中留边。
- [ ] 状态机名**正好**是 `State Machine 1`。
- [ ] 有 Number 输入 `emotion`，默认值 0；有 Trigger 输入 `tap`。
- [ ] `emotion` = 0..8 能切到第 3 节对应的 9 个情绪，每个都循环、过渡平滑。
- [ ] 触发 `tap` 有一次性反应并自动回到当前情绪。
- [ ] 在 32px 和 200px 两个尺寸预览都清楚好看。
- [ ] 在 Rive 编辑器的 State Machine 预览里手动改 `emotion` 数值、点 `tap`，行为符合预期。

---

## 9. 文件做好后，工程侧怎么接（给开发看）

1. 把 `pet.riv` 放进对应目录 `assets/pets/<species>/pet.riv`。
2. 编辑 `src/components/pet-renderers/rive-assets.ts`，把对应物种的 `null` 改成 require：
   ```ts
   export const PET_RIVE: Record<Species, number | null> = {
     bear: require('../../../assets/pets/bear/pet.riv'),
     dog:  require('../../../assets/pets/dog/pet.riv'),
     cat:  require('../../../assets/pets/cat/pet.riv'),
   };
   ```
3. `metro.config.js` 已把 `riv` 加入 `assetExts`，无需再动。
4. **首次接入需重建原生 dev client**（Rive 是原生模块，光重启 Metro 不够）。
5. 不需要改任何调用方代码：`<PetView>` / `<Bear>` 已统一走 `RivePetRenderer`，
   `emotion`/`tap` 契约对上即生效；某物种文件未就位时自动回退到占位渲染。
