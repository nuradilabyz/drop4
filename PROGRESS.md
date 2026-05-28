# Drop4 — build progress log

## Status: feature-complete, builds green, core flows verified in-browser.

Repo: https://github.com/nuradilabyz/drop4 · 21 routes · `tsc` + `next build` clean.

### Done
- **P0 Foundation** — Next 16 + TS, two-theme CSS-var system, UI library (Button/Chip/Card/Avatar/Icon/Logo/Input/StatTile/ThemeToggle), interactive Board (drop animation, win glow, threats, fluid), `engine/types` contract, `/playground`.
- **P1 Engine** — bitboard + negamax/αβ + eval + threats + endgame solver + Web Worker; 33 tests pass. Pure & isomorphic (also server-usable).
- **P1 Backend** — Supabase schema + RLS, handle_new_user trigger, leaderboard fn, ELO (15 tests), server-authoritative `/api/match/finalize` (movelist replay), `@supabase/ssr` + `proxy.ts`, auth routes.
- **P1 Screens** — landing, pricing, leaderboard, profile (+ ELO chart, opening heatmap), Nav/Footer/MobileTabBar, `lib/mockData` seam.
- **P2 Solo game + lobby** — GameView/GameControls/WinBanner, `useSoloGame` (engine worker, timers, hint, threats, best-of), matchStore + coach handoff.
- **P2 Duel by link** — `/r/[slug]`, Supabase Realtime channel, optimistic turn validation, reconnection, idle close, spectator, anon guests, rematch.
- **P2 Billing** — Stripe test-mode checkout/portal/webhook + entitlements + Pro gating (degrades without keys).
- **P3 AI Coach** — `analyzeMatch` (engine math + classification) + OpenAI narration (template fallback) + Supabase cache + scrubbable analysis screen.
- **P3 Creative** — OG match-card route + `/m/[token]` share page, WebAudio sound + toggle, daily puzzle page.
- **Auth** — `/login` magic-link + Google.
- **P4 verification + fixes** — played a solo game (AI responds, win detection ✓), exercised the coach (template narration, eval bar, blunder detection ✓). Fixed: board width collapse in centered flex (was unclickable in-game), coach `/api/coach` 400 (players array→{c,a}), mate-eval display "+M9993"→"+M". Wired sound (drop/win) + SoundToggle. Mobile pass: game + landing overflow fixed; all screens fit at 390px.
- **P4 share wiring** — in-game "Share" now copies the real `/m/<token>` OG-card link (solo: result card; duel: invite link live → result card on finish) via `lib/share.copyShareLink`, with a reusable `Toast` ("Share link copied ✦"). Verified: toast fires, `/m/<token>` → 200, `/api/og` → 200 image/png.
- **P4 graceful duel-create** — `/r/new` no longer dumps raw JSON 500 when the backend is unreachable; 303-redirects to `/play?duel=unavailable`, which pops a friendly toast and self-cleans the URL. Lobby copy updated (duel is no longer "coming soon").
- **P4 mobile sweep** — overflow audit at 390px across all 11 user-visible pages in both themes. Found and fixed 3 real defects: coach `355px` (board stretched the shell via `1fr`/min-content), lobby `21px` (Continue card row), share-unfurl `184px` (board at 510px in 333px card). All pages now 0 overflow in light + dark.
- **P4 verification pass** — beyond the build/unit-test gates, exercised live: solo E2E (start → moves → AI responds → counter advances), keyboard a11y on the board (focusable column buttons with 2px coral focus outline, Enter activates), theme toggle (light ⇄ dark, persists to `drop4-theme`), share button → toast → clipboard → live `/m/<token>`, OG card for all 3 result types (`r=c`/`r=a`/`r=draw`) — all 200 image/png, visually verified the loss card renders the correct win-line + headline. Coach loss path correct ("Insane AI won" chip, no hardcoded "You won"). Console-error sweep across 9 backend-less pages → 0 runtime errors.
- **P4 rematch lock-up fix** — user-reported: after a Rematch the AI plays its opening move, then the board locks (human can't click, AI's turn-clock keeps ticking). Root cause: `playerToMove(cells)` hard-coded coral-starts, so on aqua-started games it returned 'a' on every even count → the hook's `current` derivation stayed on 'a' → `humanTurn` was false. Fixed by making `playerToMove(cells, starter='c')` starter-aware (default preserves the engine-internal callers in search/threats unchanged); `useSoloGame` now passes `starter` at the two call sites that can face an aqua-started game. Added 3 regression tests pinning the contract (51 tests pass now). Reproduced + verified live: Rematch → AI opens → human can click → counter advances normally.
- **P4 `/coach` index page** — user-reported: typing `/coach` (or following the Nav tab labeled "Coach") hit Next's default 404 because the route is only defined as `/coach/[matchId]`. Built a real landing at `/coach` that lists every finished match from localStorage (opponent + mode + moves + relative time + result chip), each row clicks through to `/coach/<id>`; friendly empty state with a "Play a game" CTA when there are none. Mobile-clean (0 overflow), respects both themes.

### Backend bring-up (2026-05-28 morning) — hosted Supabase live
- **Project**: `drop4` (id `fdbthmvccnkpddecjaum`, region `eu-central-1`), provisioned via the Supabase MCP. Status `ACTIVE_HEALTHY`.
- **Schema applied**: `0001_init` (8 tables + RLS policies + `handle_new_user` trigger + `leaderboard` SECURITY DEFINER fn) and `harden_handle_new_user_rpc` (revoked EXECUTE so the trigger fn isn't callable as `/rest/v1/rpc/handle_new_user`). Seed: 8 players across Almaty/Astana/Shymkent, 4 finished matches, today's puzzle #101, 8 weekly ELO snapshots.
- **Auth**: Anonymous Sign-Ins enabled via Management API (`external_anonymous_users_enabled=true`); verified live (HTTP 200, `is_anonymous=true`, `handle_new_user` trigger correctly created a profile row for the anon uid).
- **Keys wired** in `.env.local`: hosted URL, anon (legacy JWT), service_role (fetched via Mgmt API + Personal Access Token; user reminded to revoke the token after setup).
- **`types/database.ts`** regenerated from the live schema via MCP `generate_typescript_types`, layered on top of the narrowed `MatchMode`/`MatchResult`/`DuelStatus` unions that the generator strips.
- **Pages flipped from mockData → live Supabase**:
  - `/leaderboard` (`efba7c5`) — fetches via `leaderboard(...)` RPC; city/period switching re-fetches; empty cities fall back to mock with a "demo data" label.
  - `/profile/[username]` (`ffefa1d`) — cloud-first SSR via `getProfileByUsername` + `getRecentMatches`; unknown usernames keep the existing mock so old design deep links stay alive.
  - Landing `LeaderboardPreview` (`3f80358`) — top-5 Almaty cloud rows above the fold.
- **Duel verified end-to-end**: `GET /r/new` → mints an anon session → inserts `duel_rooms` row → 303 to `/r/<slug>`. Test room `silent-panda-85` exists in DB with `host_id = ff43dfa4-...`, `status='open'`.
- **`/puzzle/today`** was already cloud-wired (no code change needed) — now shows the seeded puzzle #101 ("Win in 1: complete the row").
- **Security advisor (post-changes)**: 11 WARN, all reviewed and intentional — the only real issue (`handle_new_user` exposed as RPC) was fixed; the 8 "anonymous access policies" warnings are inherent heads-ups from enabling Anonymous (each policy is correctly scoped by `auth.uid()` where it needs to be), `leaderboard` SECURITY DEFINER is intentionally public, and leaked-password-protection doesn't apply (no email+password sign-up).

### Known / deferred (non-blocking)
- Local Supabase couldn't run overnight (host disk was ~100% full → Docker Desktop failed). The schema/migrations are correct and apply with `supabase start` once disk is freed, OR via `supabase db push --db-url` against a hosted project (no Docker). See MORNING.md.
- Deploy needs the user's Supabase/Vercel accounts + keys (see MORNING.md / README).

### Commits
P0 `0c8a765` · P1 `d10a3f6` · P2/P3 `d68269c` · fixes `2173d50` · sound/eval `5eb72bd` · mobile pass-1 `c414dd9` · docs `b2573d7` · share+toast `92fb442` · graceful /r/new `0f408f9` · coach mobile `db77e15` · lobby mobile `d6d2a82` · share-unfurl mobile `0e58fcd` · handoff doc `e0c501b`.
