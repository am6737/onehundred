SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'check-notification-triggers';

SELECT net.http_post('http://kong:8000/functions/v1/send-pet-notifications','{}'::jsonb,'{}'::jsonb,'{"Content-Type":"application/json"}'::jsonb);

SELECT scene, sent_at FROM notification_log ORDER BY sent_at DESC LIMIT 10;
