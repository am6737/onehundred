# 推送通知设计文档

## 一、多邻国推送策略研究

### 1.1 核心理念

多邻国把猫头鹰 Duo 当作**有人格的 KOL** 来运营。中国市场负责人张初初原话："我们不是品牌，而是一个 KOL。"

不同角色（Duo、Lily、Oscar）有各自的**签名语气**，通知来自"一个关心你的朋友"，不是一个 app。

### 1.2 六阶段升级模型

| 阶段 | 时间 | 文案示例 | 心理机制 |
|------|------|---------|---------|
| 温和提醒 | Day 1-3 | "Did you practice Spanish today?" | 简单行为触发 |
| 个人投入 | Day 4-10 | "You're on fire! Continue your 109-day streak" | 成就感 + 损失厌恶 |
| 轻度内疚 | Day 11-20 | "You made Duo sad" / "Don't let Duo down!" | 拟人化内疚 |
| 社交压力 | Day 15-25 | "Your friends are learning!" | 社会比较 |
| 被动攻击 | Day 25-35 | "These reminders don't seem to be working. We'll stop sending them." | 反向心理 |
| 激将法 | Day 35+ | "Looks like Spanish isn't for everyone" | 身份挑战 |

中文版：**"4天没学日语了，你在想什么呢？算了，我懒得管你了"**

### 1.3 行为心理学原理

| 原理 | 应用方式 |
|------|---------|
| **损失厌恶** | 连续打卡天数越长，失去的恐惧越大（损失感受 = 收益的 2 倍） |
| **认知失调** | "我想学语言" vs "我没打开 app"——不一致让人不舒服 |
| **间歇强化** | 不同类型的奖励交替出现——徽章、排行榜、社交 |
| **身份认同** | "Looks like Spanish isn't for everyone"——挑战自我认知 |
| **社交压力** | 好友打卡提醒——真实社交压力比自我激励更有效 |

### 1.4 技术实现

**Recovering Difference SoftMax Algorithm (RDSA)**：
- 把通知选择当作多臂赌博机问题
- 同一模板重复使用后点击率下降 0.5%，用指数衰减（gamma=0.0017, 半衰期 15 天）自动降权
- 不同通知有条件资格（如连续打卡通知需 3 天以上 streak）
- 基于 2 亿条通知数据训练
- 发表于 ACM SIGKDD 2020

**多邻国三层技术栈**（已验证的官方来源）：

| 用途 | 技术 | 说明 |
|------|------|------|
| 角色交互动画 | Rive | Duo、Lily 等角色表情、肢体、口型同步 |
| UI 动效 | Lottie | 转场、庆祝撒花、引导动画 |
| 通知 / Widget / App 图标 | 静态图片 | 预渲染的不同表情插图 |

来源：
- https://rive.app/blog/creative-technologists-duolingo-s-solution-to-the-designer-to-developer-handoff
- https://blog.duolingo.com/world-character-visemes/
- https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life

### 1.5 关键运营规则

- **"保护渠道"规则**：可以优化文案/时间/图片，但**不能增加发送数量**
- **23.5 小时间隔**：在用户上次打开 app 的 23.5 小时后发送
- **放弃用户自选时间**：算法推断的时间比用户自己设的更有效
- **不规则时间**：7:23、12:34、6:18——模拟"真人发消息"
- **五种激励轮换**：连续性 / 竞争 / 完成感 / 奖励 / 归属感
- **通知分两类**：Routine notifs（日常温和提醒）和 Save notifs（紧急，如"连续打卡要断了"）

### 1.6 效果数据

| 指标 | 数据 |
|------|------|
| DAU 增长 | 2018-2022 增长 **450%** |
| 通知文案优化 | "搞笑 vs 命令式 vs 拟人化"测试，DAU 提升 **5%** |
| Streak Freeze | 减少高风险用户流失 **21%** |
| 好友打卡 | 每日完课率提升 **22%** |
| 成长心态文案 | 14 天留存率提升 **7.2%** |
| Bandit 算法 | 新用户 D1 留存提升 2.2%，D7 留存高于对照组 2.5% |
| 整体留存 | CURR 提升 **21%**，日流失率降低超 **40%** |
| MAU | Q2 2024 达到 **1 亿**月活，33% 日活率 |
| 有机获客 | 约 **80%** 用户为自然增长 |

### 1.7 参考来源

- [Lenny's Newsletter - How Duolingo reignited user growth](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)
- [Duolingo Blog - Streaks](https://blog.duolingo.com/streaks/)
- [KDD 2020 - A Sleeping, Recovering Bandit Algorithm](https://dl.acm.org/doi/10.1145/3394486.3403350)
- [Medium - I Reverse-Engineered Duolingo's Guilt Algorithm](https://medium.com/@milessightings/i-reverse-engineered-duolingos-guilt-algorithm-6ddf598d2a72)
- [Substack - How Duolingo Perfected the Art of Push Notifications](https://tinomwadeyi.substack.com/p/how-duolingo-perfected-the-art-of)
- [知乎 - 详解 Duolingo](https://zhuanlan.zhihu.com/p/1916536721102844793)

---

## 二、我们的宠物性格定义

| 属性 | 小熊 团团 | 小狗 旺旺 | 小猫 咪咪 |
|------|----------|---------|---------|
| 名字 | 团团 Dango | 旺旺 Woof | 咪咪 Mimi |
| 默认色 | orange | green | pink |
| 性格 | 温柔、安静、陪伴型 | 热情、活泼、兴奋型 | 傲娇、高冷、嘴硬心软 |
| 说话风格 | 轻声细语，用"呢""呀"结尾 | 感叹号多，用"哇""耶"，很激动 | 假装不在意，反话，偶尔漏出关心 |
| emoji | 🐻 🌙 🍯 | 🐶 ⭐ 🎉 | 🐱 💤 ✨ |
| 对标多邻国 | 像温柔版的 Duo | 像热情版的 Duo | 像 Lily（傲娇角色） |

---

## 三、通知场景与文案模板

### 场景 1：温柔提醒

**触发条件**：3 天没记录（frequency=normal）
**对应情绪**：clingy（撒娇）
**多邻国对标**：六阶段模型第 1 阶段（温和提醒）

| 宠物 | 中文 | English |
|------|------|---------|
| 团团 | 团团翻了翻日记本，最近几页还是空白的呢 🐻 | Dango flipped through the journal… the last few pages are still blank 🐻 |
| 旺旺 | 旺旺好几天没看到新故事了！今天有什么好玩的吗？🐶 | Woof hasn't seen a new story in days! Anything fun happen today? 🐶 |
| 咪咪 | 咪咪才不关心你们有没有记录呢。才没有。✨ | Mimi doesn't care if you haven't been recording. Not at all. ✨ |

### 场景 2：成长唤起

**触发条件**：7 天没记录
**对应情绪**：sad（委屈）
**多邻国对标**：第 2-3 阶段（个人投入 + 轻度内疚）

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | 这一周宝宝一定又长大了一点吧…团团想听呀 🌙 | The little one must have grown a bit this week… Dango would love to hear about it 🌙 |
| 旺旺 | 一整周了！旺旺急死了！快来说说这周都干了什么！🎉 | A whole week!! Woof is dying to know! What happened?! 🎉 |
| 咪咪 | 一周了哦。不过咪咪才不会催你呢。只是顺便提一下。💤 | It's been a week. Not that Mimi would rush you. Just mentioning it. 💤 |

### 场景 3：损失暗示

**触发条件**：14 天没记录
**对应情绪**：anxious（着急）
**多邻国对标**：第 4-5 阶段（社交压力 + 被动攻击）
**心理机制**：损失厌恶——"有些瞬间不记下来，真的会忘掉"

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | 有些小事不记下来，真的会忘掉的呢…团团有点担心 🍯 | Little moments can slip away if you don't write them down… Dango is a bit worried 🍯 |
| 旺旺 | 两周了！旺旺都快把之前的事忘了，你们也是吧？快记下来！🐶 | Two weeks!! Woof is already forgetting things, aren't you too? Write them down! 🐶 |
| 咪咪 | 两周没记了。记忆这种东西，丢了就丢了吧。…真的没关系吗？🐱 | Two weeks with nothing. Memories fade, I guess. …Is that really fine though? 🐱 |

### 场景 4：里程碑庆祝

**触发条件**：距离下一个装扮解锁 ≤ 3 件
**对应情绪**：expecting（期待）
**多邻国对标**：完成感（Completion）激励钩子
**变量**：`{{done}}`（已完成数）、`{{remain}}`（剩余数）

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | 已经记了 {{done}} 件事啦！再记 {{remain}} 件，团团就有新衣服穿了呀 🐻 | {{done}} things recorded! Just {{remain}} more and Dango gets a new outfit 🐻 |
| 旺旺 | 哇 {{done}} 件了！！还差 {{remain}} 件旺旺就能换新衣服啦！冲冲冲！⭐ | Wow {{done}} done!! Just {{remain}} more for Woof's new outfit! Let's gooo! ⭐ |
| 咪咪 | {{done}} 件了。再来 {{remain}} 件的话…咪咪的新衣服就到了。随便你啦。✨ | {{done}} done. {{remain}} more and… Mimi's new outfit arrives. Whatever. ✨ |

### 场景 5：时间胶囊即将开启

**触发条件**：封信距开启 ≤ 30 天
**对应情绪**：expecting（期待）
**变量**：`{{days}}`（剩余天数）

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | 那封写给未来的信，还有 {{days}} 天就要自己出现了呢 🌙 | That letter to the future will reveal itself in {{days}} days 🌙 |
| 旺旺 | 还有 {{days}} 天！！那封信就要开了！旺旺好期待好期待！🎉 | {{days}} days left!! The letter is about to open! Woof can't wait!! 🎉 |
| 咪咪 | {{days}} 天后那封信会打开。咪咪没有在倒数哦。才没有。💤 | That letter opens in {{days}} days. Mimi is NOT counting down. Definitely not. 💤 |

### 场景 6：家人记录了新内容

**触发条件**：其他家庭成员在 24h 内有新记录
**对应情绪**：surprised（惊喜）
**多邻国对标**：归属感（Belonging）激励钩子
**变量**：`{{who}}`（记录者称呼）

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | {{who}}刚刚记了一件新的事，一起去看看呀 🐻 | {{who}} just recorded something new, let's go see 🐻 |
| 旺旺 | {{who}}记了新的了！！快去看快去看！🐶 | {{who}} added something new!! Go look go look! 🐶 |
| 咪咪 | {{who}}记了一件事。咪咪看过了。还行吧。✨ | {{who}} recorded something. Mimi already saw it. It's okay I guess. ✨ |

### 场景 7：连续记录鼓励

**触发条件**：连续 ≥ 3 天有记录
**对应情绪**：happy（开心）
**多邻国对标**：连续性（Continuity）激励钩子 + Streak 通知
**变量**：`{{days}}`（连续天数）

| 宠物 | 中文 | English |
|------|------|------|
| 团团 | 连续 {{days}} 天都有记录了呢，团团好开心呀 🍯 | {{days}} days in a row! Dango is so happy 🍯 |
| 旺旺 | {{days}} 天连续记录！！旺旺骄傲得尾巴都摇断了！🎉 | {{days}} days straight!! Woof's tail is wagging off! 🎉 |
| 咪咪 | 连续 {{days}} 天了…好吧，咪咪承认你们还挺厉害的。🐱 | {{days}} days in a row… Fine, Mimi admits that's impressive. 🐱 |

---

## 四、通知调度规则

### 4.1 场景触发条件

| 场景 | gentle 频率 | normal 频率 | frequent 频率 |
|------|-----------|-----------|-------------|
| gentle_remind | 5 天触发 | 3 天触发 | 2 天触发 |
| growth_nudge | 10 天触发 | 7 天触发 | 5 天触发 |
| loss_hint | 21 天触发 | 14 天触发 | 10 天触发 |
| milestone | 距解锁 ≤ 3 | 距解锁 ≤ 3 | 距解锁 ≤ 5 |
| capsule | ≤ 30 天 | ≤ 30 天 | ≤ 30 天 |
| family_activity | 24h 内 | 24h 内 | 24h 内 |
| streak | ≥ 3 天 | ≥ 3 天 | ≥ 3 天 |

### 4.2 全局规则（参考多邻国"保护渠道"原则）

- 每个家庭**每天最多 1 条**推送
- 免打扰时段不发送（默认 22:00-08:00），延迟到次日
- 同一场景 **48h 内不重复**
- 同场景有多条模板时，选**最久没用过的**（简单版遗忘曲线，参考多邻国 RDSA）
- 发送时间：在用户上次活跃时间附近（参考多邻国 23.5 小时间隔）
- 使用**非整点时间**发送（如 7:23、18:47），模拟真人感

### 4.3 通知分类

参考多邻国的 Routine / Save 分类：

| 类型 | 场景 | 紧迫度 |
|------|------|-------|
| **Routine**（日常提醒） | gentle_remind、growth_nudge、milestone | 低——可延迟到合适时间 |
| **Save**（紧急提醒） | loss_hint、capsule（≤ 7 天）、streak（即将断） | 高——优先发送 |
| **Social**（社交触发） | family_activity | 中——实时性强但非紧急 |

### 4.4 深度链接

| 场景 | 点击通知后跳转 |
|------|--------------|
| gentle_remind / growth_nudge / loss_hint | 首页（开始记录） |
| milestone | 宠物页（查看进度） |
| capsule | 时间胶囊页 |
| family_activity | 对应记录详情 |
| streak | 宠物页（庆祝动画） |

---

## 五、后续迭代方向

1. **AI 动态文案**：接入 LLM，结合孩子名字、最近记录内容、季节生成个性化文案
2. **模板轮换算法**：参考多邻国 RDSA，自动选择点击率最高的模板
3. **桌面小组件**：宠物表情随记录状态变化（静态图片，参考多邻国 Widget）
4. **动态 App 图标**：iOS `setAlternateIconName` 根据状态切换宠物表情
5. **更多文案模板**：每个场景增加到 3-5 条，增加轮换丰富度
6. **A/B 测试框架**：跟踪每条模板的点击率，用数据驱动文案优化

---

## 六、v2 已落地（2026-07 · 智能推送第一批）

针对「文案发腻 + 像固定定时器」两大痛点，已实现（迁移 `migrations/20260713_smart_push.sql` +
函数 `send-pet-notifications/index.ts`）：

1. **文案扩容 + 最近不重复轮播** —— 每个场景补到 3 条果果文案；`pickTemplate()` 读
   `notification_log.template_id` 历史，避开最近用过的 (候选数−1) 条并在剩余里随机 →
   走完全部变体才可能重复，直接消除「反复同一句」。（落地上述方向 5、部分 2）
2. **个性化发送时段** —— `computeSendHour()` 从 `memories.created_at` 按家庭本地时区取
   习惯记录时段众数，只在其 2 小时窗口内评估发送（默认 19:00，夜间/数据不足回退）；
   替代原先全员扎堆免打扰结束的 ≈08:00。（部分落地 §4.2「贴近上次活跃时间」）
3. **新场景 `on_this_day`（那年今天）** —— 把 N 年前今天、当前可见（未被封存锁住）的旧记录
   翻出来做正向回忆唤起，置于场景优先级最顶：用真实回忆再互动替代内疚 nag，
   打破「全是催记录」的单调。周年天然稀疏 + 48h 去重，自限流。
4. **点击回写 + CTR 闭环**（迁移 `migrations/20260713_push_ctr.sql`）—— 发送侧改为
   「先落 `notification_log` 拿 id → 写进 push payload」；客户端点击/打开推送时调
   `mark_notification_clicked(id)` 回写 `clicked/clicked_at`（`App.tsx` +
   `src/data.markNotificationClicked`）。`pickTemplate()` 升级为 **RDSA-lite**：在「避重」候选里
   按平滑点击率 `(clicks+1)/(sent+2)` 加权随机选取（视图 `notification_ctr` 汇总近 45 天），
   高 CTR 文案更常被选、新文案仍被探索，数据积累后自动收敛。（落地上述方向 2、6）

**尚未做（下一批）**：用 CTR/点击时刻进一步优化**发送时段**（当前时段仅由记录直方图推断，
未纳入点击反馈）；接入 `smart-plan` LLM 代理生成**动态文案**（结合孩子名字/上次记录内容/季节）；
`on_this_day` 客户端**深链到具体记录**（现降级到首页，payload 已带 `memId`）。
