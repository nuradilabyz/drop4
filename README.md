# Drop4 — *Four in a row. Sharper every drop.*

A modern, competitive web platform for Connect Four. Not another clone — a startup-grade product: play a friend by link, drill against an AI **that explains your mistakes**, climb your **city's** ladder, and go Pro.

**Live demo:** **https://drop4-six.vercel.app** · **Repo:** https://github.com/nuradilabyz/drop4

---

## Что это, для кого и почему ценно

- **Что:** «Четыре в ряд» как живой сервис — Solo против ИИ (4 уровня), Duel по ссылке (реалтайм), Ranked с ELO, городские лидерборды, ежедневные головоломки и **AI-тренер**, который после партии на человеческом языке объясняет, где ты ошибся.
- **Для кого:** игроки, которые хотят не просто кликать фишки, а **расти** — от новичка до завсегдатая местного рейтинга; и сообщества/клубы/школы (тариф Team).
- **Почему ценно:** удержание (рейтинги, серии, достижения, daily-пазлы), обучение (AI-тренер — главный дифференциатор), социальный слой (лидерборды по городам — «лучший в Алматы»), и реальная монетизация (Free / Pro $4 / Team $12, Stripe). Это прототип, который может стать сервисом.

This hits the challenge's **Level «Великий»** and goes beyond it: real-time multiplayer, an AI coach, a social/city leaderboard layer, a clear niche, and a working billing flow.

---

## Feature highlights

| Area | What's built |
|------|--------------|
| **Engine** | Bitboard Connect-4 engine (negamax + alpha-beta, transposition table, endgame solver) in a **Web Worker** — instant, zero server cost. Difficulties Easy → Insane. 33 unit tests. |
| **Solo** | Play vs AI with per-move timers, **best-move hint** (Pro), **threat highlighting**, best-of series, win-line glow, falling-disc animation, resume from where you left off. |
| **Duel by link** | Share one URL → real-time turn-based match over **Supabase Realtime** (broadcast + presence). Guest play (anonymous auth), reconnection, **spectator mode**, 10-min idle close, rematch. |
| **AI Coach** 🏆 | Replays the game through the engine → per-move accuracy, blunder/brilliant/fork classification, eval bar, missed-threat detection → then **OpenAI** writes the narrative ("you missed the diagonal threat — col 1 was forced"). Falls back to a deterministic template with no API key. Scrub the whole game move-by-move. |
| **Social** | ELO, win streaks, achievements, match history, **city leaderboards** (weekly / all-time, monthly reset), profiles with an ELO chart + opening heatmap. |
| **Monetization** | Free / Pro ($4·mo / $36·yr) / Team ($12·mo) with a real **Stripe** test-mode checkout + webhook → Pro flag. Pro unlocks unlimited hints, full coach, skins, crown badge. |
| **Creative** | Shareable **OG match-card** images + `/m/<token>` unfurl page, synthesized **sound design** (WebAudio, no assets), daily puzzles, light/dark themes. |

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**, deployed on **Vercel**
- **Supabase** — Postgres + Auth (magic link + Google + anonymous) + Realtime + Row Level Security
- **OpenAI** for the AI-coach narration (swappable provider; template fallback)
- **Stripe** (test mode) for billing
- Design system ported from a Claude Design export: **CSS custom properties** (light/dark) + **CSS Modules**, Geist / Geist Mono via `next/font`. No UI framework.

## Architecture at a glance

```
app/            routes: / play game/[id] r/[slug] coach/[matchId] profile leaderboard
                pricing puzzle login m/[token] + api/{coach,match/finalize,stripe,og}
components/     ui/ (Button, Chip, Card, Avatar, Icon, …), board/, game/, coach/, charts/, layout/
engine/         bitboard, search, eval, threats, solver, analyze, worker, index (+ tests)
lib/            supabase/, game/, coach/, realtime/, elo, entitlements, sound, share, theme
supabase/       migrations + seed + config (schema, RLS, leaderboard fn, ELO finalize)
```

Key design decisions: the engine is **pure & isomorphic** (runs in the worker *and* server-side for the coach + anti-cheat match validation); ELO is written **server-side only** after replaying the movelist (clients can't forge results); the board contract (`cells[col][row]`, `'c'`/`'a'`) is frozen in `engine/types.ts`.

---

## Run it locally

Requires Node 20.9+ and Docker (for local Supabase).

```bash
# 1) Backend (Postgres + Auth + Realtime) — applies migrations + seed
supabase start          # CLI: https://supabase.com/docs/guides/cli
supabase db reset

# 2) Env — .env.local already has the standard local Supabase keys.
#    Add OPENAI_API_KEY for live coach narration (optional; template works without).
#    Add STRIPE_* test keys for billing (optional).

# 3) App
npm install
npm run dev             # http://localhost:3000
```

Without Docker/Supabase you can still run `npm run dev` and use **Solo play, the AI Coach (template mode), puzzles, and all marketing screens** — those work from the engine + local storage. Auth, duel, and leaderboards need Supabase.

### Environment variables (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_*`, `NEXT_PUBLIC_SITE_URL`.

## Tests

```bash
npx vitest run        # engine (33) + ELO (15)
npx tsc --noEmit      # types
npm run build         # production build (21 routes)
```

## Deploy (Vercel + Supabase)

1. **Supabase:** create a hosted project → `supabase link` → `supabase db push` (applies migrations) → enable **Anonymous sign-ins** and **Realtime**. Set Auth redirect URL to `https://<your-domain>/auth/callback`.
2. **Vercel:** import this repo, set **Root Directory = `drop4`**, add all env vars (use Supabase project keys, OpenAI key, Stripe **test** keys), set `NEXT_PUBLIC_SITE_URL` to the deployed URL.
3. **Stripe:** point a webhook at `https://<your-domain>/api/stripe/webhook` and copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

---

Built for the nFactorial Connect Four challenge. Design exported from Claude Design (`/screens`, `/tokens.jsx` in the parent folder) and implemented here.
