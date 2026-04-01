-- ============================================================
-- Noshift — Push Notification Cron Setup
-- Run this in Supabase SQL Editor AFTER deploying the edge function
-- ============================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Schedule daily check-in reminder at 8pm UTC
-- (Delete old schedule first if re-running)
SELECT cron.unschedule('send-daily-checkin-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'send-daily-checkin-reminders'
);

SELECT cron.schedule(
  'send-daily-checkin-reminders',
  '0 20 * * *',   -- 8:00 PM UTC every day
  $$
  SELECT net.http_post(
    url      := 'https://duuuhydcmzhyqdsccrkh.supabase.co/functions/v1/send-checkin-reminders',
    headers  := '{"Content-Type":"application/json","Authorization":"Bearer sb_publishable_Gn052Rvv32k2PYBnCd_JPw_fGJDkl2t"}'::jsonb,
    body     := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Step 3: Verify the schedule was created
SELECT jobname, schedule, command FROM cron.job;

-- ============================================================
-- DEPLOY THE EDGE FUNCTION FIRST (terminal commands):
--
-- 1. Install Supabase CLI: npm install -g supabase
-- 2. Login: supabase login
-- 3. Link project: supabase link --project-ref duuuhydcmzhyqdsccrkh
-- 4. Deploy function: supabase functions deploy send-checkin-reminders
--
-- The function uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
-- which are auto-injected by Supabase into edge functions.
-- No extra secrets needed unless you want to filter by EXPO_ACCESS_TOKEN.
-- ============================================================
