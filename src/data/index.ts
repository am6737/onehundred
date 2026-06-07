/* ════════════════════════════════════════════════════════════
   一百件事 — data layer (faithful port from prototype data.jsx)
   ════════════════════════════════════════════════════════════ */

export const PERSPECTIVES = {
  parent:   { key: 'parent',   label: '为你', long: '家长 → 孩子', hint: '我想为孩子做的事' },
  child:    { key: 'child',    label: '为我', long: '孩子 → 家长', hint: '孩子想为我做的事' },
  together: { key: 'together', label: '一起', long: '一起做',      hint: '我们一起完成的事' },
};

export const LEVELS = [
  {
    num: '03', perspective: 'parent', tone: 'orange',
    title: '讲一个你小时候做过的最蠢的事',
    why: '他会用一种新的眼光看你，那是他第一次意识到——爸爸妈妈也曾经是个孩子。',
    how: '找一个轻松的晚上，吃完饭赖在沙发上的时候，自然地讲起。不用铺垫，越具体越好。',
    record: '录下孩子听完之后的反应。那一段笑声，未来值很多钱。',
    suggest: 'voice',
  },
  {
    num: '07', perspective: 'together', tone: 'green',
    title: '一起做一顿「完全失败也没关系」的饭',
    why: '让孩子看到你对失败的态度，比任何说教都有用。',
    how: '选一道你也没做过的菜，故意不查太多攻略，全程让孩子参与，包括打翻的那部分。',
    record: '拍下成品，不管多丑。再录一段你们当时手忙脚乱的对话。',
    suggest: 'photo',
  },
  {
    num: '12', perspective: 'parent', tone: 'pink', kid: 'duo',
    title: '给 18 岁的他/她写一封信',
    why: '你今天写下的话，会在他成年那天被印出来，寄到家里。',
    how: '找一个安静的夜晚，手写或打字都行。写你现在最想让那时的他知道的事。',
    record: '信封会被封存，等待开启的那天。在那之前，谁也看不到。',
    suggest: 'text', sealed: true, sealUntil: '朵朵 18 岁生日那天', sealedOn: '2026 年 5 月 12 日',
  },
  {
    num: '21', perspective: 'child', tone: 'green',
    title: '让孩子教你一件他擅长、你不会的事',
    why: '被需要、被请教，是孩子第一次尝到「我也能照顾你」的滋味。',
    how: '认真当一回学生。游戏、折纸、某个 App 怎么用都行，让他当一次老师。',
    record: '让孩子说一句「今天你学得怎么样」，录下来。',
    suggest: 'voice',
  },
  {
    num: '05', perspective: 'together', tone: 'orange',
    title: '在同一个地方，每年拍一张一模一样的合照',
    why: '同一个角度、同一个姿势，时间会替你们说话。',
    how: '选一个对你们有意义的地方，记下机位。明年的今天，再来一次。',
    record: '今年这张，会和往年的并排放在一起。',
    suggest: 'photo',
  },
  {
    num: '09', perspective: 'child', tone: 'pink',
    title: '让孩子带你逛一次他眼中「好玩的地方」',
    why: '你会发现，他眼里的世界和你以为的完全不一样。',
    how: '把决定权完全交给他。路线、停留多久、看什么，都听他的。',
    record: '记下一件他带你看、而你从没注意过的小东西。',
    suggest: 'text',
  },
  {
    num: '18', perspective: 'together', tone: 'orange',
    title: '把手机关掉，一起看完一次完整的日落',
    why: '什么都不做地待在一起，本身就是一件值得做的事。',
    how: '提前查好日落时间，提早十分钟到。然后，只是看着。',
    record: '天黑之后再拍一张你们的剪影就好。',
    suggest: 'photo',
  },
  {
    num: '15', perspective: 'together', tone: 'green', seasonal: true,
    title: '一起种一棵会比他长得慢的树',
    why: '很多年后，树和孩子都长大了，他会记得是谁陪他埋下第一铲土。',
    how: '挑一棵当地能活很久的树苗。让孩子负责浇第一次水。',
    record: '给小树苗拍张照，旁边放上孩子的手作对比。',
    suggest: 'photo',
  },
  {
    num: '02', perspective: 'parent', tone: 'green',
    title: '把他出生那天的故事，完整讲一遍',
    why: '每个孩子都想知道自己来到世上的那一天，到底发生了什么。',
    how: '从天气、你的心情、当时的兵荒马乱讲起。哪怕细节记不全，情绪是真的。',
    record: '录成一段语音，留到他长大那天再听。',
    suggest: 'voice',
  },
  {
    num: '08', perspective: 'parent', tone: 'orange',
    title: '带他回你长大的那条街走一走',
    why: '让他踩一踩你小时候踩过的路，故事就有了落脚的地方。',
    how: '指给他看你上学的路、第一次摔跤的拐角、买零食的小店还在不在。',
    record: '在你小时候常待的地方，拍一张你们俩的合照。',
    suggest: 'photo',
  },
  {
    num: '14', perspective: 'parent', tone: 'pink',
    title: '认真回答他问过、你当时敷衍掉的一个问题',
    why: '孩子记得你哪次没好好听。补上一次，胜过十次说教。',
    how: '想想他最近问过什么被你「等一下」掉的问题，主动找他，好好说一次。',
    record: '写下你重新回答的那句话，和他听完的表情。',
    suggest: 'text',
  },
  {
    num: '23', perspective: 'parent', tone: 'green',
    title: '把你的一个小本领，正式「传」给他',
    why: '吹口哨、打一个绳结、煎一个蛋——被郑重交付的东西，孩子会记一辈子。',
    how: '挑一件你会、他还不会的小事。慢一点，让他自己试到成功为止。',
    record: '录下他第一次成功时那声欢呼。',
    suggest: 'voice',
  },
  {
    num: '29', perspective: 'parent', tone: 'orange',
    title: '为他做一顿「你小时候最爱吃的饭」',
    why: '味道是会遗传的记忆。你爱的那一口，也许会变成他想家的味道。',
    how: '复刻一道你童年的家常菜，边做边讲它的来历。',
    record: '拍下那盘菜，写一句它对你意味着什么。',
    suggest: 'photo',
  },
  {
    num: '11', perspective: 'child', tone: 'orange',
    title: '让孩子给你画一张「你的样子」',
    why: '在孩子的笔下，你才能看到自己在他心里到底什么样。',
    how: '什么都别提示，让他自由画。画歪了、画丑了，都不要纠正。',
    record: '把这张画拍下来，写上日期收好。',
    suggest: 'photo',
  },
  {
    num: '17', perspective: 'child', tone: 'green',
    title: '让孩子安排一次「他说了算」的周末',
    why: '把方向盘交给他一次，他会忽然长大一点点。',
    how: '预算和安全你把关，其余全听他的：去哪、吃什么、几点睡。',
    record: '录一句他当「小队长」时下的命令。',
    suggest: 'voice',
  },
  {
    num: '25', perspective: 'child', tone: 'pink',
    title: '让孩子照顾你一次（你假装生病也行）',
    why: '被照顾惯了的孩子，需要一次「我来保护你」的机会。',
    how: '让他给你倒杯水、盖个毯子。认真接受他的照顾，别笑场。',
    record: '写下他照顾你时说的那句最暖的话。',
    suggest: 'text',
  },
  {
    num: '31', perspective: 'child', tone: 'orange',
    title: '请孩子给你推荐一首「他最近最爱的歌」',
    why: '走进他的世界，从认真听他喜欢的东西开始。',
    how: '让他放给你听，听完认真说说你的感受，别评判。',
    record: '把歌名记下来，写一句你听完的想法。',
    suggest: 'text',
  },
  {
    num: '04', perspective: 'together', tone: 'pink', kid: 'all',
    title: '一起给未来的自己埋一个「时间胶囊」',
    why: '约定一个开启的日子，从此你们之间就有了一个共同的秘密。',
    how: '各自写一张纸条、放一件小东西，封进盒子，定好几年后再开。',
    record: '拍下封箱那一刻，记下约定开启的日期。',
    suggest: 'photo', sealed: true, sealUntil: '2031 年的春天', sealedOn: '2026 年 4 月 6 日',
  },
  {
    num: '13', perspective: 'together', tone: 'green',
    title: '一起在雨天，故意出门踩一次水坑',
    why: '允许一次「弄湿弄脏」，是给孩子最痛快的爱。',
    how: '穿上不怕脏的鞋，挑最大的那个水坑，一起踩下去。',
    record: '拍一张溅起水花的瞬间。',
    suggest: 'photo', seasonal: true,
  },
  {
    num: '19', perspective: 'together', tone: 'orange',
    title: '一起完成一件需要等很久才有结果的事',
    why: '等待本身就是一种陪伴：发豆芽、等月亮、看面团发起来。',
    how: '挑一件需要耐心的小事，每天一起去看它一点点变化。',
    record: '把第一天和最后一天的样子拍下来对比。',
    suggest: 'photo',
  },
  {
    num: '27', perspective: 'together', tone: 'pink',
    title: '一起发明一个只属于你们的「暗号」',
    why: '一个外人看不懂的小手势，会成为你们一生的默契。',
    how: '一起设计一个动作或一句怪话，约定它代表「我爱你」。',
    record: '录下你们第一次对暗号时的傻笑。',
    suggest: 'voice',
  },
];

export const KIDS = [
  { id: 'duo', name: '朵朵', y: 2019, m: 5, tone: 'orange', bear: '团子', since: '2023 年 4 月', acc: ['scarf', 'star'] },
  { id: 'man', name: '小满', y: 2022, m: 9, tone: 'green', bear: '糯米', since: '2024 年 10 月', acc: ['hat'] },
];

export const FAMILY = { id: 'all', name: '全家', tone: 'pink' };

export const ROLES = ['爸爸', '妈妈', '爷爷', '奶奶', '外公', '外婆'];
export const DEFAULT_ME = { role: '爸爸', custom: '' };

export function meName(me) {
  if (!me) return '家长';
  return me.role === '其他' ? (me.custom || '我') : me.role;
}

export function meChar(me) {
  const n = meName(me);
  return (me && me.role !== '其他') ? n[n.length - 1] : n[0];
}

export const NOW_YM = { y: 2026, m: 6 };

export function kidAge(k) {
  if (!k || k.id === 'all') return null;
  return Math.max(0, NOW_YM.y - k.y - (NOW_YM.m < k.m ? 1 : 0));
}

export function getKid(id) {
  return KIDS.find(k => k.id === id) || FAMILY;
}

export function kidLabel(id) {
  return id === 'all' ? FAMILY.name : getKid(id).name;
}

export const MEMORIES = [
  {
    id: 'm1', kid: 'duo', levelNum: '03', perspective: 'parent', type: 'voice', dur: '0:48',
    date: '5 月 28 日', place: '客厅沙发',
    title: '爸爸偷穿奶奶高跟鞋的那年',
    caption: '朵朵听到一半笑到打嗝，说「爸爸你好蠢哦」——说这句话的时候，她眼睛是亮的。',
    transcript: '那年我大概六岁吧，趁你太奶奶不在家，偷偷穿上她那双红色高跟鞋，在客厅里走来走去，结果一脚踩空摔了个屁股墩……（朵朵笑）哈哈哈爸爸你好蠢哦！……对啊，爸爸小时候也干过很多蠢事呢。',
    tone: 'orange',
  },
  {
    id: 'm2', kid: 'all', levelNum: '07', perspective: 'together', type: 'photo', shots: 4,
    date: '5 月 21 日', place: '自家厨房',
    title: '史上最咸番茄炒蛋',
    caption: '咸得离谱的一盘。朵朵皱着眉，小满却抢着吃了三口——这是我们家最热闹的一顿。',
    tone: 'green',
  },
  {
    id: 'm8', kid: 'duo', levelNum: '14', perspective: 'together', type: 'video', dur: '0:31',
    date: '5 月 20 日', place: '小区楼下空地',
    title: '朵朵第一次甩掉辅助轮',
    caption: '镜头晃得厉害，因为我跟在后面跑。她回头喊「爸爸你松手啦」的那一秒，刚好被录下来了。',
    tone: 'orange',
  },
  {
    id: 'm6', kid: 'man', levelNum: '11', perspective: 'child', type: 'photo',
    date: '5 月 18 日', place: '茶几上',
    title: '小满画的「妈妈」',
    caption: '三条腿，一头乱发，笑得很大。他说这就是最爱他的那个人。',
    tone: 'pink',
  },
  {
    id: 'm3', kid: 'duo', levelNum: '09', perspective: 'child', type: 'text',
    date: '5 月 11 日', place: '小区后面的土坡',
    title: '她带我去看的「秘密基地」',
    caption: '原来那堵旧墙后面，藏着她和小伙伴攒了一整个春天的弹珠和瓶盖。',
    tone: 'pink',
  },
  {
    id: 'm7', kid: 'man', levelNum: '02', perspective: 'parent', type: 'voice', dur: '0:53',
    date: '4 月 20 日', place: '小满的小床边',
    title: '讲小满出生那天的兵荒马乱',
    caption: '他听不太懂，只是一直盯着我笑。等他长大，这段录音会替我再讲一遍。',
    transcript: '小满啊，你出生那天是个大雨天，凌晨三点妈妈说要生了，爸爸慌得鞋都穿反了……到医院又等了好久好久。等护士把你抱出来，那么小一团，我手都不敢碰。那一刻我才真的明白，从今往后我多了一个要保护一辈子的人。',
    tone: 'green',
  },
  {
    id: 'm4', kid: 'all', levelNum: '05', perspective: 'together', type: 'photo', shots: 3,
    date: '4 月 6 日', place: '植物园门口那棵树下',
    title: '第三年的同一张全家福',
    caption: '朵朵又长高了大半个头，小满第一次自己站着入镜。这棵树记得我们每一年的样子。',
    tone: 'orange',
  },
  {
    id: 'm5', kid: 'duo', levelNum: '21', perspective: 'child', type: 'voice', dur: '1:12',
    date: '3 月 30 日', place: '书桌前',
    title: '她教我折一只会跳的青蛙',
    caption: '我折坏了四只。她特别耐心地说「没关系，再来一次嘛」——那是我常对她说的话。',
    transcript: '爸爸你看，要这样对折，再往回翻……不对啦，你翻反了！（笑）没关系没关系，再来一次嘛。对，就是这样，按一下它的屁股它就会跳……你看你看它跳起来了！',
    tone: 'green',
  },
];

export function kidDone(id) {
  if (id === 'all') return MEMORIES.length;
  return MEMORIES.filter(m => m.kid === id || m.kid === 'all').length;
}

export function memoriesForKid(id) {
  if (id === 'all') return MEMORIES;
  return MEMORIES.filter(m => m.kid === id || m.kid === 'all');
}

export const MASCOTS = {
  duo: {
    kid: 'duo', name: '团子', tone: 'orange', since: '2023 年 4 月', stage: 2,
    grown: 6,
    items: [
      { id: 'scarf', name: '小围巾', from: '第 1 件事', got: true, tone: 'orange' },
      { id: 'star', name: '星空背景', from: '第 3 件事', got: true, tone: 'green' },
      { id: 'hat', name: '小毛帽', from: '第 5 件事', got: true, tone: 'pink' },
      { id: 'kite', name: '一只风筝', from: '第 8 件事', got: false, tone: 'orange' },
      { id: 'boat', name: '小纸船', from: '第 12 件事', got: false, tone: 'green' },
    ],
    log: [
      { text: '团子学会了第一次挥手', from: '你们一起看完日落那天' },
      { text: '团子戴上了奶奶织的小围巾', from: '朵朵教你折青蛙那天' },
      { text: '团子的世界里多了一片星空', from: '你讲童年糗事那天' },
    ],
  },
  man: {
    kid: 'man', name: '糯米', tone: 'green', since: '2024 年 10 月', stage: 1,
    grown: 3,
    items: [
      { id: 'hat', name: '小毛帽', from: '第 1 件事', got: true, tone: 'green' },
      { id: 'scarf', name: '小围巾', from: '第 3 件事', got: true, tone: 'orange' },
      { id: 'star', name: '星空背景', from: '第 5 件事', got: false, tone: 'pink' },
      { id: 'kite', name: '一只风筝', from: '第 8 件事', got: false, tone: 'orange' },
    ],
    log: [
      { text: '糯米第一次睁开了眼睛', from: '你讲他出生那天的故事时' },
      { text: '糯米收到了哥哥姐姐的小毛帽', from: '小满给你画画那天' },
    ],
  },
};

export function getMascot(id) {
  return MASCOTS[id] || MASCOTS.duo;
}

export const PET_BODY = 3;

export const WARDROBE = [
  { id: 'scarf', name: '小围巾', slot: '脖子', at: 1, line: '围上了奶奶织的那条小围巾。' },
  { id: 'star', name: '星空小窝', slot: '场景', at: 5, line: '它的小世界里，亮起了一整片星空。' },
  { id: 'hat', name: '小毛帽', slot: '头顶', at: 12, line: '戴上了一顶它最爱的小毛帽。' },
  { id: 'boat', name: '小纸船', slot: '脚边', at: 25, line: '脚边多了一只随时想出航的小纸船。' },
  { id: 'kite', name: '一只风筝', slot: '手里', at: 45, line: '手里牵起了一只飞得很高的风筝。' },
];

export function wardrobeState(done) {
  return WARDROBE.map(w => ({ ...w, got: done >= w.at }));
}

export function nextUnlock(done) {
  const next = WARDROBE.find(w => done < w.at) || null;
  const unlocked = WARDROBE.filter(w => done >= w.at).length;
  if (!next) return { next: null, remain: 0, ratio: 1, unlocked, total: WARDROBE.length };
  const prevAt = [...WARDROBE].reverse().find(w => done >= w.at)?.at || 0;
  const span = next.at - prevAt || 1;
  return { next, remain: next.at - done, ratio: Math.min(1, (done - prevAt) / span), unlocked, total: WARDROBE.length };
}

export const HELLO = {
  childName: 'duo',
  total: MEMORIES.length,
  togetherFor: '2 年 1 个月',
  bear: MASCOTS.duo.name,
};

let CUSTOM_LEVELS = [
  {
    num: '★1', perspective: 'together', tone: 'pink', custom: true,
    title: '每年除夕，全家包一次「奇形怪状」的饺子',
    why: '这是只属于你们家的传统。写下来，它就不会被忘记。',
    how: '', record: '拍下那只最丑的饺子。', suggest: 'photo',
  },
];

export function customLevels() { return CUSTOM_LEVELS; }

export function allLevels() { return [...CUSTOM_LEVELS, ...LEVELS]; }

export function addCustomLevel({ title, why = '', perspective = 'together', tone = 'pink', suggest = 'photo' }) {
  const lv = {
    num: '★' + (CUSTOM_LEVELS.length + 1), perspective, tone, custom: true,
    title, why: why || '这是你们家自己的事，记下来就不会忘。', how: '', record: '', suggest,
  };
  CUSTOM_LEVELS = [lv, ...CUSTOM_LEVELS];
  return lv;
}

export function throwback(kidId = 'all') {
  const list = memoriesForKid(kidId);
  if (list.length < 2) return null;
  const m = list[list.length - 1];
  return { m, label: '去年的这个时候', sub: '你们一起做的第 1 件事' };
}

export function yearReview(kidId = 'all') {
  const list = memoriesForKid(kidId);
  const byP = { parent: 0, child: 0, together: 0 };
  const byType = { voice: 0, photo: 0, text: 0 };
  const places = {};
  list.forEach(m => {
    byP[m.perspective] = (byP[m.perspective] || 0) + 1;
    byType[m.type] = (byType[m.type] || 0) + 1;
    if (m.place) places[m.place] = (places[m.place] || 0) + 1;
  });
  const top = Object.entries(places).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  const mascot = kidId === 'all' ? MASCOTS.duo : getMascot(kidId);
  return {
    total: list.length, byP, byType,
    voiceCount: byType.voice,
    topPlace: top ? top[0] : null,
    grown: kidId === 'all' ? kidDone('duo') : mascot.grown,
    unlocked: nextUnlock(kidId === 'all' ? kidDone('all') : mascot.grown).unlocked,
    firstTitle: list.length ? list[list.length - 1].title : null,
    lastTitle: list.length ? list[0].title : null,
  };
}

const LEVEL_AGE = { '12': 6, '04': 4, '17': 5, '31': 5, '23': 4 };

export function nowCtx() {
  const d = new Date();
  const h = d.getHours(), wd = d.getDay(), m = d.getMonth() + 1;
  return {
    hour: h, weekend: wd === 0 || wd === 6, month: m,
    season: m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter',
    slot: h < 11 ? 'morning' : h < 14 ? 'noon' : h < 18 ? 'afternoon' : h < 21 ? 'evening' : 'night',
  };
}

export function levelWeight(l, kid) {
  let w = 1;
  const ctx = nowCtx();
  if (l.custom) w *= 2.4;
  if (l.seasonal) w *= 2.0;
  const minA = LEVEL_AGE[l.num];
  const age = kid && kid !== 'all' ? kidAge(getKid(kid)) : null;
  if (minA != null && age != null && age < minA) w *= 0.3;
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) w *= 1.5;
  if ((ctx.weekend || ctx.slot === 'afternoon') && l.suggest === 'photo') w *= 1.4;
  return w;
}

export function weightedShuffle(arr, kid) {
  return arr
    .map(l => ({ l, k: Math.pow(Math.random(), 1 / Math.max(0.0001, levelWeight(l, kid))) }))
    .sort((a, b) => b.k - a.k)
    .map(x => x.l);
}

export function suitsNow(l) {
  const ctx = nowCtx();
  if (l.custom) return '你们家自己的事';
  if (l.seasonal && (ctx.season === 'spring' || ctx.season === 'summer')) return '这个季节正合适';
  if ((ctx.slot === 'evening' || ctx.slot === 'night') && (l.suggest === 'voice' || l.suggest === 'text')) return '安静的晚上，适合慢慢说';
  if (ctx.weekend && l.suggest === 'photo') return '周末，适合出门做';
  if (ctx.slot === 'afternoon' && l.suggest === 'photo') return '光线正好，适合拍';
  return null;
}

export function frameLabel(perspective, kidId, meLabel = '家长') {
  if (perspective === 'together' || kidId === 'all') return PERSPECTIVES[perspective].long;
  const name = getKid(kidId).name;
  if (perspective === 'parent') return `${meLabel} → ${name}`;
  if (perspective === 'child') return `${name} → ${meLabel}`;
  return PERSPECTIVES[perspective].long;
}
