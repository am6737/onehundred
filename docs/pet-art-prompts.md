# 宠物形象生成提示词

## 统一风格基底

所有宠物共享同一套风格描述，确保视觉一致性。以下是**风格锚定词**，每个具体提示词都应以此开头：

### Style Anchor（风格锚定）

```
Kawaii-minimal mascot character design for a family journaling app.
Soft rounded 3D clay-render style (claymorphism), matte pastel finish, 
subtle subsurface scattering. Simple geometric body with oversized head 
(head-to-body ratio 1:1), tiny stubby limbs, no fingers. 
Large expressive eyes (Pixar-meets-Sanrio), small dot nose, 
minimal facial features. Solid pastel background, soft diffused studio 
lighting, no hard shadows. Clean vector-friendly silhouette that reads 
well at 64×64px. Suitable for both notification icon and full-screen display. 
No text, no watermark.
```

### 风格参考关键词说明

| 关键词 | 为什么用 |
|-------|---------|
| claymorphism / clay-render | 有质感但不写实，温暖的触感 |
| matte pastel finish | 柔和不刺眼，适合亲子 app |
| head-to-body ratio 1:1 | 头大身小，可爱感的核心比例 |
| Pixar-meets-Sanrio | Pixar 的表情表演力 + Sanrio 的简洁可爱 |
| reads well at 64×64px | 缩小到通知图标仍能辨认 |

---

## 一、团团 🐻（小熊 · 温柔型）

### 基础形象

```
[Style Anchor]
A small bear character. Warm honey-orange body color (#F4A942). 
Round ears with lighter cream inner ear. A tiny cream-colored belly patch. 
Eyes are large, round, and slightly droopy (gentle/sleepy look), 
dark brown iris with a single soft highlight. Small curved smile. 
Sitting in a relaxed, slightly slouched pose with a tiny journal book 
beside it. The overall feeling is warm, cozy, and approachable — 
like a stuffed animal come to life.
Character sheet, front view, 3/4 view, side view.
```

### 表情状态

#### 开心（记录完成时）
```
[Style Anchor]
The honey-orange bear character "Dango". Joyful expression: eyes are 
upward-curved happy arcs (closed-eye smile), small open mouth showing 
excitement, tiny blush circles on cheeks. Both stubby arms raised slightly. 
A few small sparkle particles floating around. Warm honey-orange body, 
cream belly patch. Soft warm lighting. Pastel yellow background.
```

#### 普通/等待（日常状态）
```
[Style Anchor]
The honey-orange bear character "Dango". Neutral gentle expression: 
large round droopy eyes looking slightly upward with warmth, 
small peaceful smile. Sitting calmly, one paw resting on a tiny 
closed journal. Relaxed posture. The feeling is patient and present — 
quietly waiting. Soft warm lighting. Pastel cream background.
```

#### 委屈/想念（用户很久没记录）
```
[Style Anchor]
The honey-orange bear character "Dango". Slightly sad expression: 
eyes are large and glistening with a single tiny tear-sparkle in the corner, 
eyebrows slightly raised in the middle (worried look), small wobbly mouth. 
Hugging the tiny journal close to its chest. The feeling is not angry, 
just genuinely missing someone. Soft blue-tinted lighting. 
Pastel lavender background.
```

#### 骄傲/庆祝（里程碑达成）
```
[Style Anchor]
The honey-orange bear character "Dango". Proud celebratory expression: 
eyes sparkling with star-shaped highlights, confident smile, 
tiny blush on cheeks. Wearing a small party hat. One arm raised holding 
a tiny flag. Confetti particles and small stars floating around. 
Warm golden lighting. Pastel peach background.
```

#### 困困/晚安（免打扰时段 Widget）
```
[Style Anchor]
The honey-orange bear character "Dango". Sleepy expression: 
eyes are heavy half-closed crescents, tiny yawn mouth, 
a small "zzz" implied by posture. Wearing a tiny nightcap. 
Curled up in a cozy sleeping pose, hugging the journal like a pillow. 
Soft moonlit blue lighting. Deep pastel navy background with 
a tiny crescent moon.
```

---

## 二、旺旺 🐶（小狗 · 活泼型）

### 基础形象

```
[Style Anchor]
A small dog character (Shiba-Inu-inspired proportions but simplified). 
Soft sage-green body color (#8BC48A). Floppy rounded ears, one slightly 
tilted. Lighter cream muzzle area and belly. Eyes are large, round, 
and bright — wide open with double highlights showing excitement. 
Big open smile with tiny tongue peeking out. Tail is visible and 
slightly curled upward (happy wag implied). Energetic sitting pose, 
leaning forward slightly as if about to jump up. A tiny journal 
beside it with pages flying open. The overall feeling is enthusiastic, 
eager, and playful.
Character sheet, front view, 3/4 view, side view.
```

### 表情状态

#### 开心（记录完成时）
```
[Style Anchor]
The sage-green dog character "Woof". Extremely happy expression: 
mouth wide open in a big grin, tongue out, eyes are sparkling 
upward-curved arcs radiating joy. Tail visibly wagging (motion lines). 
Both paws up in the air, jumping pose. Multiple star and confetti 
particles exploding around. Cream muzzle, green body. 
Energetic warm lighting. Bright pastel yellow-green background.
```

#### 普通/等待（日常状态）
```
[Style Anchor]
The sage-green dog character "Woof". Alert eager expression: 
eyes wide open and bright, head slightly tilted to one side 
(curious dog head-tilt), ears perked, small excited smile, 
tail up. Sitting but visibly ready to spring into action. 
One paw on the journal. The feeling is "ready and waiting!" 
Warm natural lighting. Pastel mint background.
```

#### 委屈/想念（用户很久没记录）
```
[Style Anchor]
The sage-green dog character "Woof". Pleading puppy-eyes expression: 
eyes are enormous and glistening (classic puppy dog eyes), 
eyebrows raised and tilted inward, ears drooped down, 
tiny frown, tail curled around its body. Lying down with chin 
resting on paws, journal pushed toward the viewer as if offering it. 
The feeling is heartbreaking cute — impossible to ignore. 
Soft blue lighting. Pastel sky-blue background.
```

#### 骄傲/庆祝（里程碑达成）
```
[Style Anchor]
The sage-green dog character "Woof". Over-the-top celebration: 
eyes are stars, mouth wide open barking with joy, jumping high 
in the air with all four limbs spread out. Wearing a tiny medal 
around neck. Firework-style sparkles and ribbons everywhere. 
Maximum energy and excitement. Dynamic pose with motion blur hints. 
Bright warm lighting. Pastel gold background.
```

#### 困困/晚安（免打扰时段 Widget）
```
[Style Anchor]
The sage-green dog character "Woof". Reluctantly sleepy: 
eyes fighting to stay open (one eye half-closed, one still trying), 
big yawn, ears completely flopped. Curled up in a dog-bed pose 
but tail still doing a tiny wag. Journal used as a pillow. 
Even asleep, looks like it could wake up any second. 
Soft warm lamplight. Pastel warm-gray background.
```

---

## 三、咪咪 🐱（小猫 · 傲娇型）

### 基础形象

```
[Style Anchor]
A small cat character. Soft rose-pink body color (#E8A0BF). 
Pointed triangular ears with darker pink inner ear. 
Lighter cream chest tuft and paw tips. Eyes are large but 
slightly narrowed — half-lidded with an "I'm not impressed" look, 
amber-gold iris with sharp highlights. Small closed mouth, 
slightly smirking. Sitting upright with perfect posture, 
chin slightly raised (looking down at you). Tail wrapped neatly 
around its body. A tiny journal beside it, pointedly ignored. 
The overall feeling is aloof, elegant, but secretly caring — 
tsundere energy.
Character sheet, front view, 3/4 view, side view.
```

### 表情状态

#### 开心（记录完成时 — 但是傲娇的开心）
```
[Style Anchor]
The rose-pink cat character "Mimi". Trying-not-to-smile expression: 
eyes looking away to the side (avoiding eye contact), 
tiny blush visible on cheeks, mouth is a small pressed line 
fighting a smile — but the tail is raised high and curled 
(betraying happiness). One paw casually placed on the journal 
as if saying "I guess this is acceptable." Small sparkle particles, 
but fewer and more elegant than the other pets. 
Cool soft lighting. Pastel rose background.
```

#### 普通/等待（日常状态）
```
[Style Anchor]
The rose-pink cat character "Mimi". Classic aloof expression: 
half-lidded eyes with a "what do you want" look, 
one ear slightly rotated back. Sitting with perfect posture, 
one paw delicately placed forward. Tail swishing gently. 
The journal is nearby but Mimi is looking in the opposite direction 
(pretending not to care). The feeling is elegant indifference 
that's clearly performed. Cool ambient lighting. 
Pastel dusty-rose background.
```

#### 委屈/想念（用户很久没记录 — 傲娇版委屈）
```
[Style Anchor]
The rose-pink cat character "Mimi". Pretending-not-to-care-but-clearly-upset: 
eyes looking away with a slight glisten (one tiny tear-sparkle 
it would deny), ears flattened sideways, tail tip twitching irritably. 
Sitting with back partially turned to the viewer, but head slightly 
turned back — peeking over shoulder. The journal is pushed away 
but one paw is still touching it. The feeling is "I'm not sad, 
YOU'RE sad." Moody purple-tinted lighting. 
Pastel mauve background.
```

#### 骄傲/庆祝（里程碑达成 — 矜持的庆祝）
```
[Style Anchor]
The rose-pink cat character "Mimi". Smugly satisfied expression: 
eyes fully open for once, looking directly at viewer with a 
knowing smirk. Chin raised even higher than usual. 
Wearing a tiny crown tilted at a jaunty angle. 
One paw extended examining its nails casually. 
A few elegant sparkles — gold and silver, arranged symmetrically. 
The feeling is "I knew you could do it. Obviously." 
Regal warm lighting. Pastel champagne-gold background.
```

#### 困困/晚安（免打扰时段 Widget）
```
[Style Anchor]
The rose-pink cat character "Mimi". Elegant sleeping pose: 
classic cat-loaf position, eyes peacefully closed with a 
content expression (the only time Mimi looks truly relaxed 
and unguarded). Tail wrapped around body perfectly. 
Tiny purr-vibration lines near its body. The journal is being 
used as a chin rest. For once, looks genuinely soft and sweet 
without the tsundere act. Gentle moonlit pink lighting. 
Deep pastel plum background with tiny stars.
```

---

## 四、通知图标专用（64×64px 适配）

每个宠物需要一个极简版头像，用于推送通知的 largeIcon：

```
[Style Anchor]
Extreme close-up headshot only (no body). [Pet name] face filling 
90% of frame. [Expression]. Perfectly centered, symmetrical composition. 
Solid [background color] background. Designed to be perfectly readable 
and recognizable at 64×64 pixel display size. Maximum contrast between 
face features and body color. No accessories, no particles, 
just the face. Round canvas crop.
```

分别替换 `[Pet name]` `[Expression]` `[background color]`：
- 团团：gentle droopy eyes + small smile / pastel cream
- 旺旺：bright wide eyes + tongue out / pastel mint  
- 咪咪：half-lidded eyes + slight smirk / pastel rose

---

## 五、生成建议

### 推荐模型与参数

| 模型 | 适合度 | 建议参数 |
|------|-------|---------|
| Midjourney v6.1+ | 最佳 | `--style raw --ar 1:1 --s 250` |
| DALL-E 3 | 好 | 直接使用，强调"no text" |
| Stable Diffusion 3 | 好 | 负面提示词加 `text, watermark, realistic fur, complex background` |
| Flux | 好 | 适合一致性控制 |

### 一致性技巧

1. **先生成一个满意的团团**，然后在后续提示词中加：`same art style, same rendering technique, same lighting setup as the reference`
2. 如果模型支持 character reference（如 Midjourney `--cref`），用第一张满意的图作为参考
3. 三个宠物同时出图测试和谐度：`three mascots standing together: honey-orange bear, sage-green dog, rose-pink cat, same style...`
4. 色板锁定：用具体 hex 值在提示词里，避免模型自由发挥颜色

### 需要生成的完整清单

每个宠物 × 5 个表情 × 1 个通知图标 = **18 张图**

| # | 资源 | 用途 |
|---|------|------|
| 1-5 | 团团 × 5 表情 | 宠物页 + Widget |
| 6 | 团团通知图标 | 推送通知 largeIcon |
| 7-11 | 旺旺 × 5 表情 | 宠物页 + Widget |
| 12 | 旺旺通知图标 | 推送通知 largeIcon |
| 13-17 | 咪咪 × 5 表情 | 宠物页 + Widget |
| 18 | 咪咪通知图标 | 推送通知 largeIcon |

后续可扩展：装扮配件图层、更多表情、其他宠物种类。
