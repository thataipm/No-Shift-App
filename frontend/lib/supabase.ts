import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types
export type Focus = {
  id: string;
  user_id: string;
  title: string;
  why: string | null;
  success_criteria: string | null;
  deadline: string;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
  completed_at: string | null;
  reflection: string | null;
};

export type Checkin = {
  id: string;
  focus_id: string;
  user_id: string;
  date: string;
  did_work: boolean;
  note: string | null;
  momentum: number | null;
  created_at: string;
};

export type ParkedIdea = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  promoted_at: string | null;
  status: 'parked' | 'promoted' | 'deleted';
};

export type Profile = {
  id: string;
  email: string;
  push_token: string | null;
  reminder_time: string | null;
  is_admin: boolean;
  created_at: string;
};

// Utility: calculate streak from checkins
export function calculateStreak(checkins: Checkin[]): number {
  if (!checkins || checkins.length === 0) return 0;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const workedDates = new Set(checkins.filter(c => c.did_work).map(c => c.date));
  let checkDate = new Date(today);
  if (!workedDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  let streak = 0;
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (workedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }
  return streak;
}

// Utility: days elapsed since focus started
export function getDaysInto(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

// Utility: days remaining until deadline
export function getDaysRemaining(deadline: string): number {
  const end = new Date(deadline);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

// Utility: get today's date string
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}
