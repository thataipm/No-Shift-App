import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

serve(async (req) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get all users with a push token who have an active focus
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .not('push_token', 'is', null);

    if (usersError) throw usersError;
    if (!activeUsers?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'No users with push tokens' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Filter to users who have an active focus
    const { data: activeFocusUsers, error: focusError } = await supabase
      .from('focuses')
      .select('user_id')
      .eq('status', 'active');

    if (focusError) throw focusError;

    const activeFocusUserIds = new Set((activeFocusUsers || []).map((f: any) => f.user_id));

    // Filter to users who HAVEN'T checked in today
    const { data: todayCheckins, error: checkinError } = await supabase
      .from('checkins')
      .select('user_id')
      .eq('date', today);

    if (checkinError) throw checkinError;

    const checkedInToday = new Set((todayCheckins || []).map((c: any) => c.user_id));

    // Build list: has token + has active focus + hasn't checked in today
    const toNotify = activeUsers.filter(
      (u: any) => activeFocusUserIds.has(u.id) && !checkedInToday.has(u.id)
    );

    if (!toNotify.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'All users checked in today' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build push messages
    const messages = toNotify.map((u: any) => ({
      to: u.push_token,
      sound: 'default',
      title: 'Time to check in 🎯',
      body: "Keep your streak alive — how did today go?",
      data: { screen: '/(tabs)', type: 'checkin_reminder' },
      badge: 1,
      channelId: 'checkin_reminders',
    }));

    // Send to Expo Push API (in chunks of 100)
    const chunkSize = 100;
    const results = [];
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      });
      const data = await res.json();
      results.push(data);

      // Clean up invalid tokens
      if (data.data) {
        for (let j = 0; j < data.data.length; j++) {
          const ticket = data.data[j];
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const userId = toNotify[i + j]?.id;
            if (userId) {
              await supabase.from('profiles').update({ push_token: null }).eq('id', userId);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: toNotify.length, results }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
