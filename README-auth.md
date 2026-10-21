# Who can sign in

Any **@webengage.com** email address. That is the whole check: the person types their work
email, and if the domain matches they are in. No password, no role, **no list of people**.

## Adding someone

Nothing to do. A new joiner signs in with their work email on their first day.

There is no file to edit, no commit and no deploy. The greeting is derived from the address —
`name.surname@webengage.com` is shown as "Name Surname".

## Why there is no list

There used to be one (`allowed-users.json`, and before that `roles-config.json` with password
hashes). Both were removed, on 21 October 2026 and 7 October 2026.

With no server, the check runs in the visitor's browser, so **any list it compares against has
to be downloaded first**. The file was fetched before the sign-in screen even appeared and was
readable by anyone who opened its URL. Hashing or renaming it would only have changed how much
effort reading it took.

And it was guarding nothing. Each person's projects live in their own browser, under their own
`localStorage` key, so someone signing in with an unexpected address starts an **empty
dashboard** rather than reading anyone else's. The list published the team's addresses in
exchange for no protection at all.

## What this is and is not

A **gate on an internal tool, not security**. Anyone can type any @webengage.com address,
including one that is not theirs, and anyone who opens DevTools can set the session key by hand
and skip the screen. It exists so the app knows who you are and can keep your data under your
own key.

Any WebEngage employee can therefore open the tool. Today that costs nothing, because there is
nothing shared to see.

## When this has to change

**The day projects are shared between people.** That is in `BACKLOG.md` and needs a database
rather than one saved blob per person — and at that point access control starts mattering for
real, because one person's data would be reachable by another.

Only a server can both keep the list private and enforce it. `README-supabase.md` sketches that
route and `supabase/schema.sql` is already written; roles would come back with it.
