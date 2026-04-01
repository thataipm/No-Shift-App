# Noshift PRD — Product Requirements Document

## Overview
**App Name**: Noshift  
**Tagline**: "Your ideas can wait. Your goal can't."  
**Type**: React Native (Expo) mobile app  
**Backend**: Supabase (PostgreSQL + Auth + Realtime)  

## Architecture
- **Frontend**: React Native Expo (SDK 54), expo-router (file-based), StyleSheet.create()
- **Backend**: Supabase (auth, PostgreSQL, RLS, RPC functions)
- **Fonts**: PlayfairDisplay + Manrope (via @expo-google-fonts)
- **Charts**: react-native-gifted-charts
- **Animations**: react-native-reanimated (built-in to Expo)

## User Personas
- **Primary**: Entrepreneurs/creators with shiny object syndrome
- **Secondary**: Students who abandon goals mid-way

## Core Requirements (Static)
1. Users commit to ONE active focus at a time
2. Friction gate shown when trying to add new focus while active
3. Daily check-in tracking (did_work + note + momentum 1-5)
4. Streak calculation based on consecutive did_work=true days
5. Parked ideas to capture new ideas without switching
6. Hidden admin dashboard (PIN 2847, long-press 5s on version)

## Database Schema (Supabase)
- `profiles`: id, email, push_token, reminder_time, is_admin
- `focuses`: id, user_id, title, why, success_criteria, deadline, status, created_at, completed_at, reflection
- `checkins`: id, focus_id, user_id, date, did_work, note, momentum, created_at
- `parked_ideas`: id, user_id, title, created_at, promoted_at, status

## What's Been Implemented (2026-04-01)

### Auth
- Login screen (dark, amber accent)
- Signup screen (with email, password, confirm)
- Supabase auth with AsyncStorage session persistence
- Auth guard in root _layout.tsx

### Onboarding (6 steps)
- Step 1: Welcome screen
- Step 2: Focus title input
- Step 3: Why input
- Step 4: Success criteria input
- Step 5: Deadline date picker (DateTimePicker)
- Step 6: Commitment summary → "I'm Committed" → saves to Supabase

### Home Screen
- Active focus card (title, streak, days in, days remaining)
- 7-day momentum mini bar chart (react-native-gifted-charts)
- Check-in button (disabled if already checked in today)
- Check-in modal (3 steps: yes/no → note → momentum 1-5)
- Mark as Complete → navigates to focus-complete screen
- New Focus button → friction gate if active focus exists
- Friction gate modal (park idea or switch focus with reflection)

### Parking Lot
- List of parked ideas (add, delete, promote to focus)
- Promote flow checks for active focus → friction gate if needed

### Progress
- Streak display (large)
- Full momentum line chart
- Calendar heatmap (49-day grid)
- Totals summary

### History
- All non-active focuses
- Status badges (completed/abandoned)
- Expandable details

### Settings
- User email (read-only)
- Notification toggle (UI only, notifications deferred)
- Logout button
- Version text with 5s long-press → PIN modal → admin dashboard

### Admin Dashboard
- Admin-only (checked via Supabase profiles.is_admin)
- Total users, new today/week/month
- DAU/WAU/MAU
- D7/D30 retention rates
- Focus completion vs abandon stats
- User signups line chart
- Focus outcomes pie chart
- Blue accent (#185FA5) to distinguish from main app
- Powered by Supabase RPC (get_admin_stats SECURITY DEFINER function)

### Focus Complete Screen
- Celebration animation (spring + fade)
- Stats: days worked, final streak, avg momentum
- Reflection input
- Start Next Focus button

### Push Notifications (Added & Deployed 2026-04-01)
- `lib/notifications.ts` — permission request, push token management, Android channel setup
- `_layout.tsx` — auto-registers push token on session start
- `settings.tsx` — toggle reads/writes `profiles.push_token`, calls `enablePushNotifications()` / `disablePushNotifications()`
- `app.json` — `expo-notifications` plugin, iOS `NSUserNotificationUsageDescription`, Android `POST_NOTIFICATIONS` permission
- `supabase/functions/send-checkin-reminders/index.ts` — **DEPLOYED** Deno edge function queries active-focus users without today's check-in, sends via Expo Push API (100-per-chunk), cleans up invalid tokens
- **pg_cron schedule active**: `0 20 * * *` (8 PM UTC daily) via cron job ID 1 in the database
- Edge function URL: `https://duuuhydcmzhyqdsccrkh.supabase.co/functions/v1/send-checkin-reminders`
- Edge function test response: `{"sent": 0, "message": "No users with push tokens"}` ✅

## Prioritized Backlog

### P0 (Critical - Must Fix)
- Run Supabase SQL setup (user action required)
- Disable email confirmation in Supabase (user action required)

### P1 (High Priority)
- Push notifications (Expo Notifications + Supabase Edge Functions) - deferred at user request
- Swipe-to-delete gesture on parking lot items (currently using delete button)
- Real-time Supabase subscription in home screen

### P2 (Nice to Have)
- Reminder time picker (currently UI only)
- Export CSV from admin dashboard
- Focus sharing / social features
- Onboarding returning user detection improvements

## Next Tasks List
1. Ask user to run SQL setup script in Supabase
2. Ask user to disable email confirmation in Supabase Auth
3. Test full flow end-to-end with working tables
4. Add push notification setup (Expo + Supabase Edge Functions)
5. Add real-time subscriptions for multi-device sync
6. Add swipe-to-delete gesture in parking lot
