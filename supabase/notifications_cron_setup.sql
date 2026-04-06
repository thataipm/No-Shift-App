-- ============================================================
-- Noshift — Push Notification Cron Setup
-- Run this in Supabase SQL Editor AFTER deploying the edge function.
--
-- BEFORE running: replace <YOUR_SUPABASE_ANON_KEY> below with your
-- actual anon key from Dashboard → Settings → API → Project API keys.
-- The anon (publishable) key is safe to use here — it is only used as
-- the HTTP Authorization header to invoke the edge function. The
-- function itself uses the auto-injected SERVICE_ROLE_KEY internally.
-- ============================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Remove old schedule if re-running
SELECT cron.unschedule('send-daily-checkin-reminders')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-checkin-reminders'
);

-- Step 3: Schedule daily check-in reminder at 8:00 PM UTC
SELECT cron.schedule(
  'send-daily-checkin-reminders',
  '0 20 * * *',
  format(
    $$
    SELECT net.http_post(
      url     := 'https://duuuhydcmzhyqdsccrkh.supabase.co/functions/v1/send-checkin-reminders',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer %s"}'::jsonb,
      body    := '{}'::jsonb
    ) AS request_id;
    $$,
    (SELECT value FROM vault.secrets WHERE name = 'supabase_anon_key' LIMIT 1)
  )
);

-- Step 4: Verify
SELECT jobname, schedule FROM cron.job;

-- ============================================================
-- DEPLOY THE EDGE FUNCTION FIRST:
--
-- 1. Install CLI:  npm install -g supabase
-- 2. Login:        supabase login
-- 3. Link project: supabase link --project-ref duuuhydcmzhyqdsccrkh
-- 4. Deploy:       supabase functions deploy send-checkin-reminders
--
-- To store the anon key in Vault (optional but recommended):
--   INSERT INTO vault.secrets (name, secret)
--   VALUES ('supabase_anon_key', '<YOUR_ANON_KEY>');
-- ============================================================
