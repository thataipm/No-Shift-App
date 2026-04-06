-- ============================================================
-- NOSHIFT — Supabase Database Setup
-- Run this ENTIRE script in your Supabase SQL Editor
-- Project Settings → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLES ──────────────────────────────────────────────────

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email        TEXT,
  push_token   TEXT,
  reminder_time TIME DEFAULT '20:00',
  is_admin     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Focuses
CREATE TABLE IF NOT EXISTS public.focuses (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title            TEXT NOT NULL,
  why              TEXT,
  success_criteria TEXT,
  deadline         DATE NOT NULL,
  status           TEXT DEFAULT 'active' CHECK (status IN ('active','completed','abandoned')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  reflection       TEXT
);

-- Check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  focus_id   UUID REFERENCES public.focuses ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  date       DATE NOT NULL,
  did_work   BOOLEAN NOT NULL,
  note       TEXT,
  momentum   INTEGER CHECK (momentum BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(focus_id, date)
);

-- Parked ideas
CREATE TABLE IF NOT EXISTS public.parked_ideas (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  promoted_at TIMESTAMPTZ,
  status      TEXT DEFAULT 'parked' CHECK (status IN ('parked','promoted','deleted'))
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focuses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parked_ideas ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Focuses policies
CREATE POLICY "focuses_all"    ON public.focuses     FOR ALL USING (auth.uid() = user_id);

-- Checkins policies
CREATE POLICY "checkins_all"   ON public.checkins    FOR ALL USING (auth.uid() = user_id);

-- Parked ideas policies
CREATE POLICY "parked_all"     ON public.parked_ideas FOR ALL USING (auth.uid() = user_id);

-- ── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ── ADMIN STATS FUNCTION (bypasses RLS) ─────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON LANGUAGE PLPGSQL SECURITY DEFINER AS $$
DECLARE
  result JSON;
  caller_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE)
    INTO caller_is_admin;
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT json_build_object(
    'total_users',          (SELECT count(*) FROM auth.users),
    'new_today',            (SELECT count(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '1 day'),
    'new_this_week',        (SELECT count(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
    'new_this_month',       (SELECT count(*) FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days'),
    'dau',                  (SELECT count(DISTINCT user_id) FROM public.checkins WHERE date = CURRENT_DATE),
    'wau',                  (SELECT count(DISTINCT user_id) FROM public.checkins WHERE date >= CURRENT_DATE - 6),
    'mau',                  (SELECT count(DISTINCT user_id) FROM public.checkins WHERE date >= CURRENT_DATE - 29),
    'total_focuses',        (SELECT count(*) FROM public.focuses),
    'completed_focuses',    (SELECT count(*) FROM public.focuses WHERE status = 'completed'),
    'abandoned_focuses',    (SELECT count(*) FROM public.focuses WHERE status = 'abandoned'),
    'active_focuses',       (SELECT count(*) FROM public.focuses WHERE status = 'active'),
    'avg_checkins_per_user',(SELECT COALESCE(ROUND(avg(cnt)::numeric, 1), 0) FROM (SELECT user_id, count(*) AS cnt FROM public.checkins GROUP BY user_id) t),
    'total_parked_ideas',   (SELECT count(*) FROM public.parked_ideas WHERE status = 'parked'),
    'signups_per_day', (
      SELECT COALESCE(json_agg(json_build_object('date', day::text, 'count', cnt) ORDER BY day), '[]'::json)
      FROM (
        SELECT date_trunc('day', created_at)::date AS day, count(*) AS cnt
        FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days' GROUP BY day
      ) t
    ),
    'd7_retention', (
      SELECT CASE WHEN count(*) = 0 THEN 0
        ELSE ROUND(count(*) FILTER (WHERE last_active >= CURRENT_DATE - 7) * 100.0 / count(*), 1) END
      FROM (
        SELECT u.id, max(c.date) AS last_active FROM auth.users u
        LEFT JOIN public.checkins c ON c.user_id = u.id
        WHERE u.created_at >= NOW() - INTERVAL '14 days' AND u.created_at < NOW() - INTERVAL '7 days'
        GROUP BY u.id
      ) t
    ),
    'd30_retention', (
      SELECT CASE WHEN count(*) = 0 THEN 0
        ELSE ROUND(count(*) FILTER (WHERE last_active >= CURRENT_DATE - 30) * 100.0 / count(*), 1) END
      FROM (
        SELECT u.id, max(c.date) AS last_active FROM auth.users u
        LEFT JOIN public.checkins c ON c.user_id = u.id
        WHERE u.created_at >= NOW() - INTERVAL '60 days' AND u.created_at < NOW() - INTERVAL '30 days'
        GROUP BY u.id
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ── HOW TO MAKE A USER ADMIN ─────────────────────────────────
-- Run: UPDATE public.profiles SET is_admin = TRUE WHERE email = 'your@email.com';

-- ── ADMIN: WIPE USER APP DATA (bypasses RLS) ─────────────────
-- Called by the Admin screen "Wipe User Data" feature.
-- Direct table deletes from the client are blocked by RLS (admin's uid ≠
-- target user_id), so this SECURITY DEFINER function is required.

CREATE OR REPLACE FUNCTION public.wipe_user_data(p_email text)
RETURNS text LANGUAGE PLPGSQL SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_id UUID;
  caller_is_admin BOOLEAN;
BEGIN
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), FALSE)
    INTO caller_is_admin;
  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT id INTO target_id FROM public.profiles WHERE lower(email) = lower(p_email);
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  DELETE FROM public.checkins     WHERE user_id = target_id;
  DELETE FROM public.focuses      WHERE user_id = target_id;
  DELETE FROM public.parked_ideas WHERE user_id = target_id;

  RETURN 'ok';
END;
$$;
