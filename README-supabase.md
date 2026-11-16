# Shared projects with Supabase

Google sign-in, projects stored in a shared database, sharing per project, three roles.
Project: `dkiqptehifzxwejsduhy` — URL and publishable key are already in `supabase-config.json`.

## Who can do what

| | Sees | Creates | Edits | Deletes | Shares |
|---|---|---|---|---|---|
| **Team member** (default) | own + shared with them | ✓ | own + shared *can edit* | own | own |
| **Manager** | **every project** | ✓ | own + shared *can edit* | own | own |
| **Admin** | every project | ✓ | every project | every project | every project, plus roles and usage |

The database enforces all of it (row-level security in `supabase/schema.sql`); the app only
hides what someone cannot do. Anyone listed in `bootstrap_admins` (stuti.khare@webengage.com)
becomes admin on first sign-in; everyone else starts as Team member and the admin promotes
managers in **Settings → Users & usage**.

## 1. Create the tables
**SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. Safe to re-run.

## 2. Google sign-in
1. In [Google Cloud console](https://console.cloud.google.com/apis/credentials) (ideally a
   project in the WebEngage Google Workspace):
   - **OAuth consent screen**: user type **Internal** — only WebEngage accounts can then
     sign in at all. App name "Weekly Report".
   - **Credentials → Create credentials → OAuth client ID** → *Web application*.
     **Authorized redirect URI**: `https://dkiqptehifzxwejsduhy.supabase.co/auth/v1/callback`
2. In Supabase **Authentication → Sign In / Providers → Google**: enable, paste the Client ID
   and Client Secret, save.
3. In Supabase **Authentication → URL Configuration**:
   - **Site URL**: `https://weekly-report-dashboard-one.vercel.app`
   - **Redirect URLs**: `https://weekly-report-dashboard-one.vercel.app/**` and
     `http://localhost:8000/**`

Even without an Internal consent screen, the database rejects any non-@webengage.com
account at sign-up.

## 3. Try it
Run the app locally (`/serve`, then http://localhost:8000), click **Sign in with Google**.
Settings shows your role; as admin you also get **Users & usage**.

## How it behaves
- **Saving**: every change is saved to the database about a second after you make it.
- **Seeing others' changes**: when the tab regains focus, and every minute.
- **Two people editing the same project at once**: the second save is refused, the project
  reloads with the first person's changes, and a banner asks to re-apply. Nothing is silently
  overwritten.
- **Sharing**: owner opens the project → **Share** → email + *Can view* / *Can edit*. Works
  for people who have never signed in yet.
- **Usage**: Settings → Users & usage (admin only) — people, last seen, sign-ins and changes in
  the last 30 days, projects owned, and a role picker.

## Not included yet
- The master plan (Templates screen) and personal settings stay in each browser.
- No live push: others' changes appear on focus / within a minute, not instantly.
- The single-file `weekly-report-dashboard.html` stays local-only (a `file://` page cannot
  receive the Google redirect).
