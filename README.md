# Our Little World

A mobile-first private space for two, built with Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, and Supabase.

## Get started

1. Create the two users in Supabase **Authentication → Users** with email/password credentials.
2. Run [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL Editor. The script creates the couple tables, RLS policies, private Storage buckets, and Realtime publication entries.
3. Copy each Auth user's UUID into the `couple_members` seed insert at the bottom of the SQL script, then run that insert. Keep exactly the two intended users in this table.
4. Copy `.env.example` to `.env.local`. Set the Supabase project URL and publishable/anon key. From Supabase **Project Settings → API Keys**, copy the **secret** key (or legacy `service_role` JWT) into `SUPABASE_SERVICE_ROLE_KEY`; this key must stay server-only. Set `USER_A_EMAIL`, `USER_A_PASSWORD`, `USER_B_EMAIL`, and `USER_B_PASSWORD` to the exact credentials of the two Auth users created in step 1.
5. Set the same six-digit PIN for both profiles directly in `.env.local` without storing it in plaintext: pipe it to `node scripts/hash-pin.mjs --set-both`. The helper writes separate salted scrypt hashes to `USER_A_PIN_HASH` and `USER_B_PIN_HASH`. Restart the app after changing environment values.
6. Install and launch:

   ```sh
   npm install
   npm run dev
   ```

Choose a profile and enter its six-digit PIN to establish a normal Supabase Auth session. The Supabase client persists its refreshable session in browser storage. Protect the service-role key, Auth passwords, and PIN hashes as server-only secrets; never use a `NEXT_PUBLIC_` prefix for them. The PIN is a convenience lock, not a strong standalone secret: the login endpoint applies a persistent five-attempt/15-minute limit per profile and source address, so use a private deployment and choose PINs that are not obvious. If the PIN screen lists missing settings, replace sample values in `.env.local`, run `supabase/schema.sql` in the same Supabase project, then stop and restart Next.js.

## Included

- Server-verified profile selection and 6-digit PIN keypad
- Realtime messages, read receipts, typing/online presence, reactions, and private image sharing
- Anniversary day count, shared realtime bucket list, and food picker
- Daily mood check-in with partner updates delivered through Supabase Realtime
- `/memories` private timeline with dated photos, mood tags, and per-partner heart reactions
- Private `chat-media` and `couple-memories` Storage buckets; images load as authenticated downloads and local object URLs (not shareable bearer links)
- Realtime “Miss you” broadcast with gentle browser-generated sounds
- PWA manifest and service-worker notification display/click scaffolding in `public/sw.js`
- Authenticated LINE Messaging API fallback at `POST /api/notify`

Run the complete schema script again when upgrading an existing project or changing the PIN limiter function. It changes `chat-media` from public to private; previous public image URLs stop working as public links, while existing message records that contain the old Supabase public URL are parsed to their object path and downloaded only through the authenticated client.

To enable the LINE fallback, set `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_USER_ID` in the server environment. The browser push worker can display pushed notifications, but sending Web Push requires a push provider/VAPID setup; OneSignal can be added at that integration point. On iOS, web push is available only for an installed home-screen web app on supported versions.

## Deploy

Import the project into Vercel and configure the environment variables from `.env.example`; set all service-role, Auth-password, PIN-hash, and LINE values only as server-side environment variables. Configure Supabase Auth and deployment origins as needed for the project. Verify only the two intended UUIDs are present in `couple_members`.
