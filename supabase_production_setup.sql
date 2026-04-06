-- ============================================================
-- NOSHIFT — Production Setup SQL
-- Run this ENTIRE script in Supabase SQL Editor once.
-- Dashboard → SQL Editor → New Query → Paste → Run All
-- ============================================================

-- ── 1. wipe_user_data (admin panel "Wipe User Data" feature) ─
-- Needed because RLS blocks direct deletes from one user to another.
-- Only callable by accounts with is_admin = TRUE.

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


-- ── 2. Grant your account admin access ───────────────────────
-- Replace the email below with your own, then run.

UPDATE public.profiles
SET is_admin = TRUE
WHERE email = 'growwithvny@gmail.com';


-- ── 3. Verify ────────────────────────────────────────────────
SELECT email, is_admin FROM public.profiles WHERE is_admin = TRUE;
