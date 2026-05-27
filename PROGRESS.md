# Drop4 — build progress log

## Done
- **P0 — Foundation** (commit `0c8a765`, pushed to GitHub)
  - Next.js 16 + TS scaffold, no Tailwind, App Router
  - Theme system: both themes as CSS variables (verbatim OKLCH), `[data-theme]` toggle with no-flash bootstrap, Geist/Geist Mono via `next/font`
  - UI library: Button, Chip, Card, Avatar, Icon (36 glyphs), Logo, Input, StatTile, ThemeToggle
  - Interactive Board: click-to-drop, hover ghost, falling-disc animation, win glow, threat rings, fluid sizing
  - `engine/types.ts` frozen contract + pure board helpers
  - `/playground` verification page (build ✓, 200 ✓, no console errors ✓)
  - AGENTS.md house rules (Next 16 gotchas + conventions)

## Infra ready
- Private repo: https://github.com/nuradilabyz/drop4
- Supabase CLI installed (`~/.local/bin/supabase` 2.101.0); Docker running → local stack available
- gh authed; brew/Xcode CLT outdated (worked around)

## In progress (parallel agents — P1)
- **A · Engine** — bitboard, negamax+αβ, eval, threats, solver, Web Worker, Vitest
- **B · Backend** — Supabase schema/RLS/auth, ELO, server-authoritative match finalize, leaderboard
- **C · Screens** — landing, pricing, profile (+charts), leaderboard, nav, mobile tab bar

## Next
- Integrate P1 (typecheck + build + apply migrations to local Supabase + screenshot review)
- P2: solo game, realtime duel, Stripe billing
- P3: AI Coach (engine analysis + OpenAI/template narration), creative adds (OG card, spectator, sound, onboarding ELO)
- P4: mobile pass, README, deploy prep
