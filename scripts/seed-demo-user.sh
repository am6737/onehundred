#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../supabase-docker/.env"

# Read keys from .env
SERVICE_ROLE_KEY=$(grep '^SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)
API_URL="http://localhost:8000"

echo "Creating demo user..."
RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@yibai.app","password":"demo123456","email_confirm":true}')

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)

if [ -z "$USER_ID" ]; then
  echo "User may already exist. Fetching by email..."
  RESPONSE=$(curl -s "$API_URL/auth/v1/admin/users?filter=demo@yibai.app" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY")
  USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; users=json.load(sys.stdin).get('users',[]); print(next((u['id'] for u in users if u.get('email')=='demo@yibai.app'),''))" 2>/dev/null || true)
fi

echo "User ID: $USER_ID"

echo "Seeding user data..."
docker compose -f "$SCRIPT_DIR/../supabase-docker/docker-compose.yml" exec -T db \
  psql -U postgres -d postgres <<SQL

-- Family (create if not exists)
INSERT INTO public.families (id, created_by, invite_code)
VALUES ('00000000-0000-0000-0000-000000000001', '$USER_ID', 'DEMO2026')
ON CONFLICT DO NOTHING;

INSERT INTO public.family_members (family_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000001', '$USER_ID', 'dad')
ON CONFLICT DO NOTHING;

INSERT INTO public.profiles (id, role)
VALUES ('$USER_ID', 'dad')
ON CONFLICT (id) DO UPDATE SET role = 'dad';

-- Kids
INSERT INTO public.kids (id, family_id, user_id, name, birth_year, birth_month, tone, bear, since, accessories) VALUES
('duo', '00000000-0000-0000-0000-000000000001', '$USER_ID', '朵朵', 2019, 5, 'orange', '团子', '2023 年 9 月', '{scarf,star}'),
('man', '00000000-0000-0000-0000-000000000001', '$USER_ID', '小满', 2022, 9, 'green', '糯米', '2024 年 10 月', '{hat}')
ON CONFLICT DO NOTHING;

-- Memories (2023–2026, wide date span)
INSERT INTO public.memories (id, family_id, user_id, kid_id, level_num, perspective, type, duration, shots, date, place, title, caption, transcript, tone) VALUES
-- ── 2023 ──
('m01','00000000-0000-0000-0000-000000000001','$USER_ID','duo','03','parent','voice','0:48',NULL,'2023-09-17','客厅沙发','爸爸偷穿奶奶高跟鞋的那年','朵朵听到一半笑到打嗝，说「爸爸你好蠢哦」——说这句话的时候，她眼睛是亮的。','那年我大概六岁吧，趁你太奶奶不在家，偷偷穿上她那双红色高跟鞋，在客厅里走来走去，结果一脚踩空摔了个屁股墩……（朵朵笑）哈哈哈爸爸你好蠢哦！……对啊，爸爸小时候也干过很多蠢事呢。','orange'),
('m02','00000000-0000-0000-0000-000000000001','$USER_ID','duo','09','child','text',NULL,NULL,'2023-10-22','小区后面的土坡','她带我去看的「秘密基地」','原来那堵旧墙后面，藏着她和小伙伴攒了一整个春天的弹珠和瓶盖。',NULL,'pink'),
('m03','00000000-0000-0000-0000-000000000001','$USER_ID','duo','21','child','voice','1:12',NULL,'2023-12-03','书桌前','她教我折一只会跳的青蛙','我折坏了四只。她特别耐心地说「没关系，再来一次嘛」——那是我常对她说的话。','爸爸你看，要这样对折，再往回翻……不对啦，你翻反了！（笑）没关系没关系，再来一次嘛。对，就是这样，按一下它的屁股它就会跳……你看你看它跳起来了！','green'),
-- ── 2024 ──
('m04','00000000-0000-0000-0000-000000000001','$USER_ID','all','05','together','photo',NULL,3,'2024-04-06','植物园门口那棵树下','第一年的全家福','第一次全家站在这棵树下。朵朵比树上最低的枝丫矮了半个头。',NULL,'orange'),
('m05','00000000-0000-0000-0000-000000000001','$USER_ID','duo','14','together','video','0:31',NULL,'2024-06-01','小区楼下空地','朵朵第一次甩掉辅助轮','镜头晃得厉害，因为我跟在后面跑。她回头喊「爸爸你松手啦」的那一秒，刚好被录下来了。',NULL,'orange'),
('m06','00000000-0000-0000-0000-000000000001','$USER_ID','man','02','parent','voice','0:53',NULL,'2024-09-22','小满的小床边','讲小满出生那天的兵荒马乱','他听不太懂，只是一直盯着我笑。等他长大，这段录音会替我再讲一遍。','小满啊，你出生那天是个大雨天，凌晨三点妈妈说要生了，爸爸慌得鞋都穿反了……到医院又等了好久好久。等护士把你抱出来，那么小一团，我手都不敢碰。那一刻我才真的明白，从今往后我多了一个要保护一辈子的人。','green'),
('m07','00000000-0000-0000-0000-000000000001','$USER_ID','man','11','child','photo',NULL,NULL,'2024-10-15','茶几上','小满画的「妈妈」','三条腿，一头乱发，笑得很大。他说这就是最爱他的那个人。',NULL,'pink'),
('m08','00000000-0000-0000-0000-000000000001','$USER_ID','duo','15','parent','text',NULL,NULL,'2024-11-10','卧室书架旁','给朵朵读《小王子》最后一章','读到「如果你爱上了一朵生长在星星上的花」，她安安静静地把头靠在我肩膀上。',NULL,'orange'),
('m09','00000000-0000-0000-0000-000000000001','$USER_ID','all','07','together','photo',NULL,4,'2024-12-31','自家厨房','跨年夜的最后一顿饭','四个人围着桌子，碗碟七零八落，小满嘴边还沾着米粒，朵朵举着果汁说「干杯」。',NULL,'green'),
-- ── 2025 ──
('m10','00000000-0000-0000-0000-000000000001','$USER_ID','all','05','together','photo',NULL,3,'2025-04-05','植物园门口那棵树下','第二年的同一张全家福','朵朵已经够到最低那根树枝了。小满第一次自己站着入镜，不用抱。',NULL,'orange'),
('m11','00000000-0000-0000-0000-000000000001','$USER_ID','duo','17','parent','voice','0:38',NULL,'2025-05-28','朵朵房间','给朵朵唱一首我小时候的歌','她听完之后说「再唱一遍」。我唱第二遍的时候声音有点哑了。',NULL,'orange'),
('m12','00000000-0000-0000-0000-000000000001','$USER_ID','man','08','together','video','0:22',NULL,'2025-06-15','小区花园','小满第一次追上蝴蝶','追了好几圈，终于蹲下来，蝴蝶落在他鞋上。他回头朝我笑，那个笑来不及拍但视频里有。',NULL,'green'),
('m13','00000000-0000-0000-0000-000000000001','$USER_ID','duo','13','child','text',NULL,NULL,'2025-08-20','冰箱门上','朵朵贴在冰箱上的纸条','写着「爸爸今天辛苦了」。字歪歪扭扭的，「辛」字少了一横，但我看了好久。',NULL,'pink'),
('m14','00000000-0000-0000-0000-000000000001','$USER_ID','man','04','parent','photo',NULL,NULL,'2025-09-22','阳台','小满三岁生日的清晨','他还没醒，我在阳台上吹好了气球。阳光刚好照进来，金色的。',NULL,'green'),
('m15','00000000-0000-0000-0000-000000000001','$USER_ID','all','12','together','voice','0:45',NULL,'2025-11-09','客厅地毯上','三个人一起讲完了一个故事','朵朵开头，小满加了一只恐龙，我负责结尾。故事乱七八糟但笑声是真的。','朵朵说：从前有一个小女孩住在云朵上……小满：还有恐龙！（大笑）对对对，恐龙也住在云朵上，它的名字叫做……嗯，叫做——「糯米」！然后呢，它们一起滑下来一道彩虹……','orange'),
-- ── 2026 ──
('m16','00000000-0000-0000-0000-000000000001','$USER_ID','all','05','together','photo',NULL,3,'2026-04-06','植物园门口那棵树下','第三年的同一张全家福','朵朵又长高了大半个头，小满终于不再抓着我裤腿。这棵树记得我们每一年的样子。',NULL,'orange'),
('m17','00000000-0000-0000-0000-000000000001','$USER_ID','duo','03','parent','voice','0:35',NULL,'2026-04-20','客厅沙发','讲外公修自行车的故事','朵朵说「你们家的人是不是都很笨啊」然后自己笑得停不下来。','你外公那时候修自行车，轮子拆下来滚到马路上去了，他追着轮子跑了一条街……（朵朵）哈哈哈哈你们家的人是不是都很笨啊！','orange'),
('m18','00000000-0000-0000-0000-000000000001','$USER_ID','man','11','child','photo',NULL,NULL,'2026-05-18','茶几上','小满画的「我们家」','四个人手拉着手，头上有太阳和云。他指着最高的那个说「这是爸爸，最厉害的」。',NULL,'pink'),
('m19','00000000-0000-0000-0000-000000000001','$USER_ID','all','07','together','photo',NULL,4,'2026-05-21','自家厨房','史上最咸番茄炒蛋','咸得离谱的一盘。朵朵皱着眉，小满却抢着吃了三口——这是我们家最热闹的一顿。',NULL,'green'),
('m20','00000000-0000-0000-0000-000000000001','$USER_ID','duo','25','child','text',NULL,NULL,'2026-06-08','学校门口','朵朵第一次自己走进校门没回头','以前每次都要回头看三次。今天她走得很快，背影忽然就不那么小了。',NULL,'orange')
ON CONFLICT DO NOTHING;

-- Mascots
INSERT INTO public.mascots (kid_id, family_id, name, tone, since, stage, grown, items, log) VALUES
('duo','00000000-0000-0000-0000-000000000001','团子','orange','2023 年 9 月',3,12,
 '[{"id":"scarf","name":"小围巾","from":"第 1 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 3 件事","got":true,"tone":"green"},{"id":"hat","name":"小毛帽","from":"第 5 件事","got":true,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":true,"tone":"orange"},{"id":"boat","name":"小纸船","from":"第 12 件事","got":false,"tone":"green"}]',
 '[{"text":"团子学会了第一次挥手","from":"你们一起看完日落那天"},{"text":"团子戴上了奶奶织的小围巾","from":"朵朵教你折青蛙那天"},{"text":"团子的世界里多了一片星空","from":"你讲童年糗事那天"},{"text":"团子收到了一只风筝","from":"朵朵甩掉辅助轮那天"}]'),
('man','00000000-0000-0000-0000-000000000001','糯米','green','2024 年 10 月',2,7,
 '[{"id":"hat","name":"小毛帽","from":"第 1 件事","got":true,"tone":"green"},{"id":"scarf","name":"小围巾","from":"第 3 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 5 件事","got":true,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":false,"tone":"orange"}]',
 '[{"text":"糯米第一次睁开了眼睛","from":"你讲他出生那天的故事时"},{"text":"糯米收到了哥哥姐姐的小毛帽","from":"小满给你画画那天"},{"text":"糯米的世界亮起了星空","from":"小满三岁生日那天"}]')
ON CONFLICT DO NOTHING;

-- Custom levels (recurring spot photo + dumpling tradition)
INSERT INTO public.custom_levels (family_id, user_id, num, title, why, how, record_hint, perspective, tone, suggest, recurring, spot_note, reminder_text) VALUES
('00000000-0000-0000-0000-000000000001','$USER_ID','★1','每年除夕，全家包一次「奇形怪状」的饺子','这是只属于你们家的传统。写下来，它就不会被忘记。','','拍下那只最丑的饺子。','together','pink','photo',NULL,'',''),
('00000000-0000-0000-0000-000000000001','$USER_ID','★2','门口那棵树下的全家福','每年春天回到同一棵树下，站在同样的位置，拍同一张照片。','站到植物园门口的大银杏树下，最矮的人站中间。','拍完之后对比去年那张，你会发现孩子又长高了一截。','together','orange','photo','yearly','植物园正门进去第一棵大银杏，面朝南站','每年清明前后，树刚发新芽的时候')
ON CONFLICT DO NOTHING;

SQL

echo "Done! Demo user seeded."
echo "Login: demo@yibai.app / demo123456"
