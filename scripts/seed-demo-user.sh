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

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "Failed to create user. Response: $RESPONSE"
  echo "User may already exist. Trying to fetch..."
  RESPONSE=$(curl -s "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY")
  USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

echo "User ID: $USER_ID"

echo "Seeding user data..."
docker compose -f "$SCRIPT_DIR/../supabase-docker/docker-compose.yml" exec -T db \
  psql -U postgres -d postgres <<SQL

-- Kids
INSERT INTO public.kids (id, user_id, name, birth_year, birth_month, tone, bear, since, accessories) VALUES
('duo', '$USER_ID', '朵朵', 2019, 5, 'orange', '团子', '2026 年 3 月', '{scarf,star}'),
('man', '$USER_ID', '小满', 2022, 9, 'green', '糯米', '2026 年 4 月', '{hat}')
ON CONFLICT DO NOTHING;

-- Memories
INSERT INTO public.memories (id, user_id, kid_id, level_num, perspective, type, duration, shots, date, place, title, caption, transcript, tone) VALUES
('m1','$USER_ID','duo','03','parent','voice','0:48',NULL,'5 月 28 日','客厅沙发','爸爸偷穿奶奶高跟鞋的那年','朵朵听到一半笑到打嗝，说「爸爸你好蠢哦」——说这句话的时候，她眼睛是亮的。','那年我大概六岁吧，趁你太奶奶不在家，偷偷穿上她那双红色高跟鞋，在客厅里走来走去，结果一脚踩空摔了个屁股墩……（朵朵笑）哈哈哈爸爸你好蠢哦！……对啊，爸爸小时候也干过很多蠢事呢。','orange'),
('m2','$USER_ID','all','07','together','photo',NULL,4,'5 月 21 日','自家厨房','史上最咸番茄炒蛋','咸得离谱的一盘。朵朵皱着眉，小满却抢着吃了三口——这是我们家最热闹的一顿。',NULL,'green'),
('m8','$USER_ID','duo','14','together','video','0:31',NULL,'5 月 20 日','小区楼下空地','朵朵第一次甩掉辅助轮','镜头晃得厉害，因为我跟在后面跑。她回头喊「爸爸你松手啦」的那一秒，刚好被录下来了。',NULL,'orange'),
('m6','$USER_ID','man','11','child','photo',NULL,NULL,'5 月 18 日','茶几上','小满画的「妈妈」','三条腿，一头乱发，笑得很大。他说这就是最爱他的那个人。',NULL,'pink'),
('m3','$USER_ID','duo','09','child','text',NULL,NULL,'5 月 11 日','小区后面的土坡','她带我去看的「秘密基地」','原来那堵旧墙后面，藏着她和小伙伴攒了一整个春天的弹珠和瓶盖。',NULL,'pink'),
('m7','$USER_ID','man','02','parent','voice','0:53',NULL,'4 月 20 日','小满的小床边','讲小满出生那天的兵荒马乱','他听不太懂，只是一直盯着我笑。等他长大，这段录音会替我再讲一遍。','小满啊，你出生那天是个大雨天，凌晨三点妈妈说要生了，爸爸慌得鞋都穿反了……到医院又等了好久好久。等护士把你抱出来，那么小一团，我手都不敢碰。那一刻我才真的明白，从今往后我多了一个要保护一辈子的人。','green'),
('m4','$USER_ID','all','05','together','photo',NULL,3,'4 月 6 日','植物园门口那棵树下','第三年的同一张全家福','朵朵又长高了大半个头，小满第一次自己站着入镜。这棵树记得我们每一年的样子。',NULL,'orange'),
('m5','$USER_ID','duo','21','child','voice','1:12',NULL,'3 月 30 日','书桌前','她教我折一只会跳的青蛙','我折坏了四只。她特别耐心地说「没关系，再来一次嘛」——那是我常对她说的话。','爸爸你看，要这样对折，再往回翻……不对啦，你翻反了！（笑）没关系没关系，再来一次嘛。对，就是这样，按一下它的屁股它就会跳……你看你看它跳起来了！','green')
ON CONFLICT DO NOTHING;

-- Mascots
INSERT INTO public.mascots (kid_id, user_id, name, tone, since, stage, grown, items, log) VALUES
('duo','$USER_ID','团子','orange','2026 年 3 月',2,6,
 '[{"id":"scarf","name":"小围巾","from":"第 1 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 3 件事","got":true,"tone":"green"},{"id":"hat","name":"小毛帽","from":"第 5 件事","got":true,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":false,"tone":"orange"},{"id":"boat","name":"小纸船","from":"第 12 件事","got":false,"tone":"green"}]',
 '[{"text":"团子学会了第一次挥手","from":"你们一起看完日落那天"},{"text":"团子戴上了奶奶织的小围巾","from":"朵朵教你折青蛙那天"},{"text":"团子的世界里多了一片星空","from":"你讲童年糗事那天"}]'),
('man','$USER_ID','糯米','green','2024 年 10 月',1,3,
 '[{"id":"hat","name":"小毛帽","from":"第 1 件事","got":true,"tone":"green"},{"id":"scarf","name":"小围巾","from":"第 3 件事","got":true,"tone":"orange"},{"id":"star","name":"星空背景","from":"第 5 件事","got":false,"tone":"pink"},{"id":"kite","name":"一只风筝","from":"第 8 件事","got":false,"tone":"orange"}]',
 '[{"text":"糯米第一次睁开了眼睛","from":"你讲他出生那天的故事时"},{"text":"糯米收到了哥哥姐姐的小毛帽","from":"小满给你画画那天"}]')
ON CONFLICT DO NOTHING;

-- Custom levels
INSERT INTO public.custom_levels (user_id, num, title, why, how, record_hint, perspective, tone, suggest) VALUES
('$USER_ID','★1','每年除夕，全家包一次「奇形怪状」的饺子','这是只属于你们家的传统。写下来，它就不会被忘记。','','拍下那只最丑的饺子。','together','pink','photo')
ON CONFLICT DO NOTHING;

SQL

echo "Done! Demo user seeded."
echo "Login: demo@yibai.app / demo123456"
