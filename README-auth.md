# Sign-in, users and roles

Demo sign-in for the internal team. There is no server — the check runs in the browser
against `roles-config.json`. It identifies who is using the app so it can show the right
view. It is **not** a security control: anyone who can open DevTools can work around it,
and anyone who can load the deployed site can fetch `roles-config.json` and read the
hashes. Don't reuse a password from anywhere else.

Only `@webengage.com` addresses are accepted, and only people listed in `roles-config.json`
can sign in.

## Roles

| | Admin | Viewer |
|---|:-:|:-:|
| create / delete projects | yes | no |
| create / edit / delete weekly reports | yes | no |
| edit the master template | yes | no |
| manage project teams | yes | no |
| clear or import data | yes | no |
| add users, reset passwords | yes | no |
| browse, generate and export reports | yes | yes |

Enforced three ways: controls are hidden, each action re-checks before running, and (if you
ever move to Supabase) row-level security. The first two are what apply today.

---

## Adding a new user

**In the app — Settings → Users & Roles → "Add a user, or reset a password"** (Admin only).

1. Enter their **email**, **first name**, **last name**, and pick **Role**.
2. Click **Suggest strong password** — generates a 10-character password that meets the
   policy — or type one.
3. Click **Generate entry**. You get a ready-to-paste block:

   ```json
   {
     "email": "neha.sharma@webengage.com",
     "firstName": "Neha",
     "lastName": "Sharma",
     "role": "viewer",
     "passwordHash": "…"
   }
   ```

4. Paste it into the `users` array in `roles-config.json`.
5. **Commit and push.** Vercel redeploys and they can sign in.
6. Send them the password — Slack DM or a password manager. It is shown **once** and
   cannot be recovered from the hash.

Prefer the command line? `python3 tools/hash-password.py 'Their@Pass1'` prints just the
hash; build the rest of the entry by hand.

### Field rules
- `firstName` / `lastName` — separate fields, no spaces in either.
- `role` — `admin` or `viewer`. Anything else is treated as `viewer`.
- `passwordHash` — SHA-256 of the password. Never store the plaintext.

---

## Resetting someone's password

Same flow: **Settings → Users & Roles**, enter their email and the new password, generate,
and replace **only** their `passwordHash` in `roles-config.json`. Commit and push.

Their existing session stops working as soon as the new hash is deployed — the session
stores a fingerprint of the hash, so it stops matching and they are signed out on their
next load. Removing a user, or changing their role, takes effect the same way.

## Changing your own password

**Settings → Account → Change password.** It verifies your current password, enforces the
policy, and gives you the new hash. Someone with repo access still has to paste it into
`roles-config.json` and push — the browser cannot write to that file. Your old password
keeps working until they do.

## Signing out

Two places: the **avatar menu, top-right → Sign out**, or **Settings → Account → Sign out**.

---

## Password policy

Set under `passwordPolicy` in `roles-config.json`. Currently: 10+ characters with an
uppercase letter, a lowercase letter, a number and a symbol. Enforced at sign-in, when
changing a password, in the admin generator, and by `tools/hash-password.py`. The
suggest button always produces a password of exactly the minimum length.

## After editing roles-config.json

| | Needed? |
|---|---|
| Commit and push | **Yes** — this is what makes it live on Vercel |
| `python3 build-standalone.py` | Only if you hand out the single-file `weekly-report-dashboard.html`, which inlines this config |
| Anything else | No |

## If you outgrow this

Real accounts, self-service password resets by email, and server-enforced roles need a
backend. The Supabase path is still in the repo: `supabase/schema.sql` and
`README-supabase.md`.
