# Who can sign in

Sign-in is **email only**. Someone types their work email; if that address is listed in
`allowed-users.json`, they are in. There is no password, no role and no server.

Every signed-in person has **full access** — there is no Admin/Viewer split. Data stays in
each person's own browser (`localStorage`), so two people signed in on two machines do not
see each other's projects.

## Adding someone

1. Edit `allowed-users.json` and add an entry:

   ```json
   { "email": "name.surname@webengage.com", "firstName": "Name", "lastName": "Surname" }
   ```

2. Commit and push. Vercel redeploys and they can sign in.

The browser cannot write this file, so there is no in-app "add a user" screen — adding or
removing someone is a commit. Removing an entry takes effect on that person's **next page
load**: a stored session is re-checked against the list every time, so it stops working.

Only `@webengage.com` addresses are accepted; the domain is `allowedDomain` in the same file.
An unlisted address sees: *"This email doesn't have access. Ask Stuti to add you."*

## What this is and is not

It is a **gate on an internal tool, not security**. The file is publicly readable on the
deployed site, anyone can type any address, and anyone who opens DevTools can set the session
key by hand and walk straight past it. It exists so the app knows who you are and can put your
name on what you enter.

That is a deliberate trade for a demo used by one internal team. If real access control is ever
needed, it needs a server — `README-supabase.md` sketches the accounts route, and the schema is
already written.

## What used to be here

Passwords (SHA-256 hashes in `roles-config.json`), two roles with a ten-capability permission
matrix, Settings → Change password, and Settings → Users & Roles. All removed on 7 October
2026: hashes in a publicly readable file protect nothing, and a role split is overhead for a
team where everyone needs to edit. `tools/hash-password.py` went with them.
