# 🟢 Status & handoff — Drop4

The app is **feature-complete, all tests green, mobile clean** across 11/11 pages
in both themes. What's left is one external setup step (hosted Supabase) so we
can verify the multiplayer flows on a real backend and then deploy to Vercel.

- Repo: **https://github.com/nuradilabyz/drop4** · main is current
- 48 unit tests passing · `npx tsc --noEmit` clean · 21 routes build

## What's done

- **Engine** — bitboard + negamax/αβ + endgame solver in a Web Worker. Pure &
  isomorphic (also used server-side for the coach + anti-cheat finalize).
- **UX** — landing, lobby, solo game vs 4 AI levels, AI coach (template + OpenAI),
  daily puzzle, profile (ELO chart + opening heatmap), city leaderboard, pricing,
  login (magic link + Google).
- **Real-time** — duel by link (`/r/<slug>`), guest play, spectator, rematch,
  reconnect, optimistic move validation.
- **Billing** — Stripe test-mode checkout/portal/webhook → Pro flag → entitlements.
- **Creative** — OG match-card images, `/m/<token>` unfurl page, WebAudio sound
  + mute, theme toggle.
- **Polish (this session)** — Share button now copies the real OG card link
  with a toast, `/r/new` degrades gracefully when backend is unreachable, and a
  full mobile sweep at 390px (fixed coach 355px, lobby 21px, share unfurl 184px
  — all pages now 0 overflow in light + dark).

## What I need from you to do the backend verification (~3 min)

Create a hosted Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard) (free tier is fine; pick a region close to your users — Frankfurt or Singapore both work for KZ). Set a database password and **save it**. Then paste 4 values:

| Where in the Supabase dashboard | What to copy |
|---|---|
| **Settings → API** | `Project URL` (`https://xxxxx.supabase.co`) |
| **Settings → API → Project API keys** | `anon public` key (long JWT) |
| **Settings → API → Project API keys** | `service_role` key (long JWT, **secret**) |
| **Settings → Database → Connection string → Session pooler → URI** | the full URI, with `[YOUR-PASSWORD]` replaced by your real DB password |

`.env.local` is `.gitignore`d — secrets won't end up in the repo. If you'd rather
not paste secrets in chat, tell me and I'll dictate exactly which line of the
file to fill in instead.

### Then I do (no Docker needed)

1. Write the URL + anon + service_role into `drop4/.env.local`.
2. `supabase db push --db-url "<your URI>"` — applies migrations to the cloud
   database (schema + RLS + `handle_new_user` trigger + leaderboard fn + ELO).
3. In the dashboard, enable **Anonymous sign-ins** (Auth → Providers) and
   **Realtime** (Database → Replication, default ON). I'll tell you where the
   toggles are.
4. Run the duel/auth/leaderboard flows live in two browsers — confirm a guest
   can join a duel link, ELO writes after a finalized match, leaderboard
   updates.

## Deploy to Vercel (after backend verification)

I can't log in to your Vercel from here — you click "Import" on
[vercel.com/new](https://vercel.com/new), pick the `drop4` repo, then:

1. **Root Directory:** `drop4` (the app subdir).
2. **Env vars** — paste from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` — your Vercel URL (e.g. `https://drop4.vercel.app`)
   - `OPENAI_API_KEY` *(optional — coach falls back to template without it)*
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_*` *(optional — billing degrades cleanly without)*
3. After first deploy, in Supabase **Auth → URL Configuration**, add your Vercel
   URL to "Redirect URLs" (`https://drop4.vercel.app/auth/callback`).
4. If you set up Stripe, point a webhook at
   `https://<your-domain>/api/stripe/webhook` and copy the signing secret into
   `STRIPE_WEBHOOK_SECRET` in Vercel.

## Running locally right now (no backend needed for most flows)

```bash
cd drop4
npm run dev          # http://localhost:3000
```

Solo vs AI, the coach (template mode), puzzles and all marketing screens work
from the engine + local storage. Duel, auth and leaderboards need Supabase
connected (above). The dev server is currently running on :3000.

## Important commands

```bash
npx tsc --noEmit                 # types
npx vitest run                   # engine (33) + ELO (15) → 48 pass
git log --oneline -8             # recent commits
```

## Recent commits (this session)

```
0e58fcd  fix(share): mobile overflow on /m/<token> unfurl page
d6d2a82  fix(lobby): mobile overflow in Continue/Daily cards
db77e15  fix(coach): mobile overflow — board no longer stretches the shell
0f408f9  fix(duel): graceful /r/new failure + accurate lobby copy
92fb442  feat(share): wire in-game Share to OG match-card link + Toast
b2573d7  docs: product README + progress log
c414dd9  fix(P4): mobile responsive — game + landing no longer overflow
5eb72bd  P4: wire sound + SoundToggle, fix coach mate-eval display
2173d50  fix(P4): board width collapse + coach players shape
d68269c  P2+P3: solo game, duel, billing, AI coach, creative, auth
```
