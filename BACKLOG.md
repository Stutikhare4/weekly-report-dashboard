# Backlog

Things deliberately deferred, with enough detail to pick up cleanly.

## 1. Raise a GitHub PR for access changes (deferred — needs a PAT)

**Problem.** `roles-config.json` is the source of truth for who can sign in, their role and
their password hash. The browser cannot write to it, so every change — adding a user,
resetting a password, changing a role — means an admin hand-edits the file, commits and
pushes. The app already generates the exact JSON to paste, but the paste-and-push step is
manual.

**Approach.** With a GitHub fine-grained personal access token, the app can turn a change
into a pull request:

1. `GET /repos/{owner}/{repo}/git/ref/heads/{base}` — head SHA
2. `POST /git/refs` — branch, e.g. `roles/20260902T1730`
3. `GET /contents/roles-config.json` — current content and blob SHA
4. `PUT /contents/roles-config.json` — updated `users`, on the new branch
5. `POST /pulls` — open the PR; merging deploys via Vercel

Hook it to the three places that already produce new config: the role dropdowns, *Add a
user / reset a password*, and *Change password*.

**Token requirements.** Fine-grained PAT, scoped to this one repository, with
*Contents: Read and write* and *Pull requests: Read and write*. Nothing else.

**Why it was deferred.** A PAT in the browser is a real credential in a place that cannot
protect it — stored in `localStorage`, readable from DevTools by anyone on that machine,
and exposed to any XSS on the deployed site. Worth doing, but worth deciding deliberately
rather than as a convenience feature. Decide first:

- who holds the token (probably only the admin, on their own machine)
- whether it is entered per session rather than stored
- whether a short-lived token or a small server-side proxy is the better answer

**Note.** This was built and tested once, then removed before shipping. Rebuilding is
roughly an hour with the steps above.

## 2. Real accounts and server-enforced roles

Current sign-in is a browser-side gate: no server, hashes readable by anyone who can fetch
`roles-config.json`, and bypassable via DevTools. Fine for an internal demo, not for real
client data on a public URL.

The Supabase path is already written: `supabase/schema.sql` (profiles, per-user state,
row-level security, two roles, domain enforcement, admin functions) and
`README-supabase.md`. Turning it on also gives self-service password resets by email,
which removes the manual step in item 1 entirely.

## 3. Shared projects across users

Each account currently has its own isolated dashboard. Roles govern what someone can do
inside their own data, not who can see whose projects. Sharing a project with its team
needs proper `projects` / `updates` / `memberships` tables rather than one JSON blob per
user. The RBAC matrix already in the app carries over unchanged.
