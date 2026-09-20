# Supabase setup — Treasure Academy website

## What you run (one time, ~3 minutes)

1. Open your Supabase project dashboard.
2. Left sidebar → **SQL Editor** → **New query**.
3. Open the file **`supabase-schema.sql`** (in this workspace), copy ALL of it,
   paste into the SQL Editor, press **Run** (or `Ctrl+Enter`).
4. You should see `Success` + one row: `_probe | {"hello": "treasure-academy"}`.
5. Left sidebar → **Table Editor** → confirm a table named **`school_data`** exists.

## What you send me (so I can probe it)

From Supabase Dashboard → **Project Settings** (gear icon) → **API**:

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public key** — the long key under "Project API keys" labelled `anon` `public`

⚠️ Send ONLY the **anon** key in chat — never the `service_role` (secret) key.

## What I will check when you send them

1. **Ping** — the project URL answers.
2. **Table exists** — `school_data` is readable through the API.
3. **Probe row** — the `_probe` row your SQL run created is there.
4. **Write works** — I write + delete a test row (proves the site can save data).
5. **Rules on** — Row Level Security is enabled (I verify the policies respond correctly).

I will reply with PASS/FAIL on each of the 5, and if anything fails I will tell
you the exact fix.

## Later (not now)

After probing passes, the next backend step is a small `supabase.js` in the site
that syncs the browser database with this table — that is a separate build round
when you approve it.
