-- ════════════════════════════════════════════════════════════
-- 宠物通知 — 手动测试数据脚本（非迁移，勿在生产跑）
--
-- ⚠️ 破坏性：部分块会 update/delete memories。请仅在 dev 测试家庭上使用。
--
-- 用法：
--   1) 取 family_id：  select id from families;
--   2) 把本文件里所有 __FID__ 替换成它（Studio：选中后 Cmd/Ctrl+D 批量替换）
--   3) 先跑「0. SETUP」一次
--   4) 每测一个场景：跑「清日志」→ 跑该场景数据块 → 调用函数 → 看 results
--
-- 调用函数（任选）：
--   curl -i -X POST "$EXPO_PUBLIC_SUPABASE_URL/functions/v1/send-pet-notifications" \
--     -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
--     -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY" -d '{}'
--   -- 或 Studio：select net.http_post(
--   --   'https://<gateway>/functions/v1/send-pet-notifications','{}'::jsonb,'{}'::jsonb);
--
-- results 状态：sent_<场景>_<n> / nosend_<场景> / no_scene / rate_limited_day
--               / dup_<场景> / no_devices / disabled
-- 优先级：loss > growth > gentle > milestone > capsule > streak > family_activity
-- ════════════════════════════════════════════════════════════


-- ╔═══ 0. SETUP（跑一次）：假设备 + 关免打扰 ═══╗
-- 假设备让函数越过"无设备"直接报出命中场景（DooPush 发它会失败 → nosend_*，但场景已验证）。
-- 想真机收推送：用你登录的真机（已自动写入 push_devices），并先配好 DooPush secrets。
insert into push_devices (device_id, user_id, lang, tz_offset)
select 'TEST-DEVICE-1', user_id, 'zh', 0
from family_members where family_id = '__FID__' limit 1
on conflict (device_id) do update set updated_at = now();

-- quiet_start == quiet_end → 永不免打扰
insert into notification_preferences (family_id, enabled, frequency, quiet_start, quiet_end)
values ('__FID__', true, 'normal', '00:00', '00:00')
on conflict (family_id) do update
  set enabled = true, frequency = 'normal', quiet_start = '00:00', quiet_end = '00:00';

-- 确保该家庭至少有一个孩子：memories.kid_id 是 NOT NULL，没孩子时场景块的 insert 会失败，
-- 且函数走到 kids.length===0 会直接返回 no_kids、根本到不了发送。固定 id 幂等、可重复跑。
-- species 缺省 'bear'（函数取不到 mascot 时用 bear 模板），故无需额外建 mascot。
insert into kids (id, family_id, user_id, name, birth_year, birth_month)
select 'TEST-KID-__FID__', '__FID__', user_id, '测试娃', 2020, 6
from family_members where family_id = '__FID__' limit 1
on conflict (id) do nothing;


-- ╔═══ 清日志（每测一个场景前都先跑）═══╗
delete from notification_log where family_id = '__FID__';


-- ╔═══ 场景 A：gentle_remind（最近记录 4 天前）═══╗  期望 sent_gentle_remind
-- 改 interval：8 days → growth_nudge；15 days → loss_hint（记得先清日志）
update memories set created_at = now() - interval '20 days' where family_id = '__FID__';
insert into memories (id, family_id, user_id, kid_id, level_num, perspective, type, date, title, created_at)
select gen_random_uuid()::text, '__FID__',
       (select user_id from family_members where family_id='__FID__' limit 1),
       (select id from kids where family_id='__FID__' limit 1),
       '01','parent','text', to_char(now(),'YYYY-MM-DD'), 'TEST-gentle', now() - interval '4 days';


-- ╔═══ 场景 B：streak（连续 3 天，同一 level）═══╗  期望 sent_streak
-- ⚠️ 清空家庭记录以保证 done/streak 可控
delete from memories where family_id = '__FID__';
insert into memories (id, family_id, user_id, kid_id, level_num, perspective, type, date, title, created_at)
select gen_random_uuid()::text, '__FID__',
       (select user_id from family_members where family_id='__FID__' limit 1),
       (select id from kids where family_id='__FID__' limit 1),
       '01','parent','text', to_char(now() - (g||' days')::interval,'YYYY-MM-DD'),
       'TEST-streak', now() - (g||' days')::interval
from generate_series(0, 2) g;


-- ╔═══ 场景 C：milestone（done = 最小解锁阈值-2 → remain=2）═══╗  期望 sent_milestone
-- ⚠️ 清空家庭记录
delete from memories where family_id = '__FID__';
insert into memories (id, family_id, user_id, kid_id, level_num, perspective, type, date, title, created_at)
select gen_random_uuid()::text, '__FID__',
       (select user_id from family_members where family_id='__FID__' limit 1),
       (select id from kids where family_id='__FID__' limit 1),
       lpad(g::text, 2, '0'), 'parent','text', to_char(now(),'YYYY-MM-DD'), 'TEST-milestone', now()
from generate_series(1, greatest((select min(at) from wardrobe) - 2, 1)) g;


-- ╔═══ 场景 D：capsule（10 天后开启的时间胶囊）═══╗  期望 sent_capsule
-- ⚠️ 清空家庭记录
delete from memories where family_id = '__FID__';
insert into memories (id, family_id, user_id, kid_id, level_num, perspective, type, date, title, sealed, seal_until, created_at)
select gen_random_uuid()::text, '__FID__',
       (select user_id from family_members where family_id='__FID__' limit 1),
       (select id from kids where family_id='__FID__' limit 1),
       '01','parent','text', to_char(now(),'YYYY-MM-DD'), 'TEST-capsule',
       true, now() + interval '10 days', now();


-- ╔═══ 场景 E：family_activity（24h 内有人记录）═══╗
-- ⚠️ 会排除"记录者本人"的设备。若收件设备属于记录者本人 → nosend_family_activity（场景已命中）。
--    想看到 sent，需记录者 ≠ 收件设备所属用户。
delete from memories where family_id = '__FID__';
insert into memories (id, family_id, user_id, kid_id, level_num, perspective, type, date, title, created_at)
select gen_random_uuid()::text, '__FID__',
       (select user_id from family_members where family_id='__FID__' limit 1),
       (select id from kids where family_id='__FID__' limit 1),
       '01','parent','text', to_char(now(),'YYYY-MM-DD'), 'TEST-family', now();


-- ╔═══ 验证 ═══╗
-- select device_id, user_id, lang, tz_offset from push_devices;
-- select family_id, scene, template_id, sent_at from notification_log order by sent_at desc limit 20;


-- ╔═══ 清理 ═══╗
-- delete from push_devices where device_id = 'TEST-DEVICE-1';
-- delete from memories where family_id = '__FID__' and title like 'TEST-%';
-- delete from notification_log where family_id = '__FID__';
-- delete from kids where id = 'TEST-KID-__FID__';   -- 先删上面的 memories 再删它
