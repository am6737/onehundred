# 多邻国（Duolingo）推送通知策略深度研究

## 一、核心理念：Duo 不是品牌，是"人"

多邻国把猫头鹰 Duo 当作**有人格的 KOL** 来运营，不是冷冰冰的企业通知。中国市场负责人张初初原话："我们不是品牌，而是一个 KOL。" 通知来自"一个关心你的朋友"，不是一个 app。

不同角色（Duo、Lily、Oscar）有各自的**签名语气**，让通知像是"有人在跟你说话"。

---

## 二、经典推送文案示例（六阶段升级模型）

有研究者逆向工程了多邻国的通知策略，发现它遵循**约六周的升级路径**：

| 阶段 | 时间 | 文案示例 | 心理机制 |
|------|------|---------|---------|
| 温和提醒 | Day 1-3 | "Did you practice Spanish today?" | 简单行为触发 |
| 个人投入 | Day 4-10 | "You're on fire! Continue your 109-day streak" | 成就感 + 损失厌恶 |
| 轻度内疚 | Day 11-20 | "You made Duo sad" / "Don't let Duo down!" | 拟人化内疚 |
| 社交压力 | Day 15-25 | "Your friends are learning!" | 社会比较 |
| 被动攻击 | Day 25-35 | "These reminders don't seem to be working. We'll stop sending them." | 反向心理 |
| 激将法 | Day 35+ | "Looks like Spanish isn't for everyone" / "Some people just aren't language learners" | 身份挑战 |

中文版更直接（PUA 风格）：**"4天没学日语了，你在想什么呢？算了，我懒得管你了"**

那条"我们要停止发送提醒了"的通知火到被做成了 meme，甚至出现在**超级碗广告**里（"No buts, do a lesson now"）。

---

## 三、背后的行为心理学原理

| 原理 | 如何应用 |
|------|---------|
| **损失厌恶** | 连续打卡天数越长，失去的恐惧越大。人对损失的感受是收益的 2 倍 |
| **认知失调** | "我认为自己想学语言" vs "我没有打开 app"——这种不一致让人不舒服 |
| **间歇强化** | 不是每次都给同样奖励，而是变化的——有时是成就徽章、有时是排行榜、有时是社交 |
| **身份认同** | "Looks like Spanish isn't for everyone"——挑战你"我是学习者"的自我认知 |
| **社交压力** | 好友连续打卡提醒——真实社交压力比自我激励更有效 |

---

## 四、技术实现：Bandit 算法 + 遗忘曲线

多邻国不是随机选通知文案，而是用了一套**机器学习系统**：

1. **Recovering Difference SoftMax Algorithm (RDSA)** —— 把通知选择当作多臂赌博机问题，平衡"探索新文案"和"用已验证有效的文案"
2. **新鲜感衰减** —— 同一条通知模板重复使用后点击率下降 0.5%，所以算法用指数衰减（gamma=0.0017, 半衰期 15 天）自动降权最近用过的模板
3. **条件资格** —— 不同通知只对特定用户可用（比如连续打卡通知需要 3 天以上的 streak）
4. **分析 2 亿条通知数据** —— 同一条文案在不同用户群的效果差异可达 1 个百分点以上
5. **按语言本地化** —— 同一模板的英文版、西班牙语版、葡萄牙语版效果完全不同

这套算法发表在 **ACM SIGKDD 2020**（顶级数据挖掘会议）上，论文标题："A Sleeping, Recovering Bandit Algorithm for Optimizing Recurring Notifications"。

---

## 五、五种激励轮换策略（Portfolio Approach）

多邻国不只用一种激励方式，而是**轮换五种钩子**：

1. **连续性（Continuity）** —— 打卡连续天数
2. **竞争（Competition）** —— 排行榜/联赛
3. **完成感（Completion）** —— 成就徽章
4. **奖励（Reward）** —— 段位奖品
5. **归属感（Belonging）** —— 好友互动

通知分两类：
- **Routine notifs** —— 日常温和提醒，在习惯时间窗口发送
- **Save notifs** —— 紧急的，比如"你的连续打卡要断了"

---

## 六、关键运营规则

- **"保护渠道"规则**：团队可以优化通知的时间、文案、图片、本地化，但**不能增加发送数量**——防止通知变成垃圾信息
- **23.5 小时间隔**：在用户上次打开 app 的 23.5 小时后发送——因为同一时间段是用户最可能再次使用的时间
- **放弃用户自选时间**：A/B 测试发现**算法推断的时间**比用户自己设的提醒时间更有效
- **不规则时间**：故意在 7:23、12:34、6:18 这种非整点时间发送——模拟"真人发消息"的感觉
- **小部件（Widget）**：主屏幕上 Duo 的表情随着一天中没学习的时间变长而越来越焦虑

---

## 七、效果数据

| 指标 | 数据 |
|------|------|
| DAU 增长 | 2018-2022 增长 **450%**（Q4 2022: 1630 万 DAU） |
| 通知文案优化 | 仅测试"搞笑 vs 命令式 vs 拟人化"文案，DAU 提升 **5%** |
| 打卡保护（Streak Freeze） | 减少高风险用户流失 **21%** |
| 好友打卡 | 每日完课率提升 **22%** |
| 应用内鼓励语 | "即使犯错也在学习"类成长心态文案，14 天留存率提升 **7.2%** |
| Bandit 算法 | 新用户 D1 留存提升 2.2%，D7 留存提升（持续高于随机对照组 2.5%） |
| 整体留存 | 4 年间 CURR（当前用户留存率）提升 **21%**，核心用户日流失率降低超 **40%** |
| 2025 "Duo 之死"营销 | 2 周内 **17 亿次曝光**，社交提及暴涨 25,560% |
| MAU | Q2 2024 达到 **1 亿**月活跃用户，33% 日活率 |
| 有机获客 | 约 **80%** 用户为自然增长，非付费获客 |

---

## 八、可应用到我们 App 的建议

1. **给通知一个"人格"** —— 不要写"您有新消息"，而是让 app 角色"说话"
2. **文案分层升级** —— 从温和到紧迫，不要一上来就催
3. **轮换激励类型** —— 别总用一种钩子，连续性/竞争/成就/奖励/社交交替使用
4. **限制数量、优化质量** —— "保护渠道"比多发更重要
5. **用算法选文案** —— 即使没有多邻国那么复杂，也可以准备多套模板 A/B 测试
6. **利用损失厌恶** —— 让用户积累的东西（连续天数、等级）有"失去的风险"
7. **发送时间跟随用户行为** —— 不要固定时间，而是在用户上次活跃时间附近发送
8. **不整点发送** —— 7:23 比 7:00 更像"真人在提醒你"

---

## 参考来源

- [Lenny's Newsletter - How Duolingo reignited user growth](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)（Jorge Mazal，前 VP Growth）
- [Duolingo Blog - Streaks](https://blog.duolingo.com/streaks/)
- [KDD 2020 - A Sleeping, Recovering Bandit Algorithm](https://dl.acm.org/doi/10.1145/3394486.3403350)（Yancey & Settles）
- [Medium - I Reverse-Engineered Duolingo's Guilt Algorithm](https://medium.com/@milessightings/i-reverse-engineered-duolingos-guilt-algorithm-6ddf598d2a72)
- [Substack - How Duolingo Perfected the Art of Push Notifications](https://tinomwadeyi.substack.com/p/how-duolingo-perfected-the-art-of)
- [知乎 - 详解 Duolingo](https://zhuanlan.zhihu.com/p/1916536721102844793)
