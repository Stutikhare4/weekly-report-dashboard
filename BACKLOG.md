# Backlog

Things deliberately deferred, with enough detail to pick up cleanly.

## 1. Raise a GitHub PR for access changes (dropped — no longer needed)

This was about letting the app open a pull request against the file that listed who could sign
in, using a fine-grained personal access token, so adding someone did not mean a hand-edit and
a push.

**It no longer applies.** The list was deleted on 21 October 2026 — any `@webengage.com` address
signs in, so a new joiner needs no commit, no deploy and no PR. There is nothing left for the
token to edit.

It was deferred for a good reason anyway: a PAT in the browser is a real credential in a place
that cannot protect it — `localStorage`, readable from DevTools by anyone on that machine, and
exposed to any XSS on the deployed site. If access control ever needs to be real, that is a
server's job (see item 2), not a token in a page.

## 2. Real accounts and server-enforced roles

Current sign-in is a browser-side gate: any `@webengage.com` address is let in, nothing is
verified, and DevTools steps straight past it. Fine while each person's data sits in their own
browser and nothing is shared; not fine for real client data on a public URL, and not fine the
moment projects are shared between people (item 3), since one person's data becomes reachable
by another.

The Supabase path is already written: `supabase/schema.sql` (profiles, per-user state,
row-level security, two roles, domain enforcement, admin functions) and
`README-supabase.md`. Turning it on also gives self-service password resets by email,
which removes the manual step in item 1 entirely.

## 3. Shared projects across users

Each account currently has its own isolated dashboard. Roles govern what someone can do
inside their own data, not who can see whose projects. Sharing a project with its team
needs proper `projects` / `updates` / `memberships` tables rather than one JSON blob per
user. The RBAC matrix already in the app carries over unchanged.
