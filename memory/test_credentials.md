# Test Credentials — Noshift

## Test Users

| Email | Password | Role | Notes |
|-------|----------|------|-------|
| testuser2@noshift.app | TestPass123! | Regular User | ✅ Active — has focus "Launch my SaaS product" |

## Admin Access

- To promote a user to admin, run in Supabase SQL Editor:
  ```sql
  UPDATE public.profiles SET is_admin = TRUE WHERE email = 'testuser2@noshift.app';
  ```
- Admin PIN (in app Settings → long-press version text for 5 seconds): **2847**

## App URL
https://idea-parking.preview.emergentagent.com
