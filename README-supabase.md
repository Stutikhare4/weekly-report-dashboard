# Turning on accounts

The dashboard runs local-only out of the box. These steps add email login and give every
person their own dashboard.

## 1. Create the project
1. Sign up at <https://supabase.com> and create a project (free tier is enough for a small team).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   This creates `profiles`, `user_state`, the row-level security policies, and the
   `usage_stats()` / `touch_last_seen()` functions.

## 2. Point the app at it
**Project Settings → API**, copy the **Project URL** and the **anon / public** key into
`supabase-config.json`:

```json
{ "url": "https://xxxx.supabase.co", "anonKey": "eyJhbGciOi..." }
```

The anon key is designed to sit in client code — row-level security is what protects the
data, not the key.

Then run `python3 build-standalone.py` if you also use the single-file build.

## 3. Enable Google sign-in
Sign-in is **Google only** — there is no password form.

1. **Authentication → Providers → Google → Enable.**
2. Create an OAuth client in the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
   (Web application), and paste its Client ID and Secret into Supabase.
3. In Google Cloud, add Supabase's callback as an **Authorized redirect URI** — Supabase shows
   the exact URL on that provider page, of the form
   `https://<project>.supabase.co/auth/v1/callback`.
4. In Supabase **Authentication → URL Configuration**, set **Site URL** to wherever you host
   the app, and add it under **Redirect URLs**.

To restrict to WebEngage accounts only, use an **Internal** OAuth consent screen in Google
Cloud, or add a domain check — ask and I will add one.

## 4. Host it
`localStorage` is per-origin, so everyone must use the *same* URL. Any static host works —
Netlify, Vercel, GitHub Pages, or an internal WebEngage host. Drop the folder in and point
the team at it.

## Seeing who uses it
Settings → Account shows total accounts plus 7- and 30-day active counts. `last_seen_at` is
stamped on each sign-in. For more detail, query in Supabase:

```sql
select email, created_at, last_seen_at from public.profiles order by last_seen_at desc;
```

## What is NOT included
- **No sharing between users.** Each account is an island; there is no shared project or team
  visibility across accounts. That needs a different schema — ask if you want it.
- **No admin role.** Anyone signed in can see the aggregate counts (not other people's data).
- **No migration of existing local data** beyond the first sign-in on the browser that holds
  it: whatever is in that browser is pushed up once, then the server copy wins.
