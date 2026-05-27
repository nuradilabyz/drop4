<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Drop4 — project house rules

**Product:** "Drop4", a modern Connect Four platform (Level «Великий»+). Brand line: *"Four in a row. Sharper every drop."* Competitive city-leaderboard Connect Four with an AI coach. Stack: Next.js 16 (App Router) + TS, Supabase, OpenAI (coach), Stripe test-mode, Vercel.

## Next.js 16 gotchas (verified — do NOT regress)
- **`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are Promises.** Always `await` them. Pages: `export default async function Page(props: PageProps<'/route/[id]'>) { const { id } = await props.params }`. Route handlers: `(req: Request, ctx: RouteContext<'/api/x/[id]'>) => { const { id } = await ctx.params }`.
- **`middleware.ts` is renamed to `proxy.ts`** with an exported `proxy()` function; runtime is `nodejs` (no edge). Use this for Supabase session refresh.
- Turbopack is the default for `dev` and `build` (no flag). ESLint is flat-config (`eslint.config.mjs`); `next lint` is removed — run `eslint` / `npx tsc --noEmit`.
- OG images: `import { ImageResponse } from "next/og"` (no `@vercel/og` install). `params`/`id` in image fns are Promises.
- Web Workers: `new Worker(new URL("./worker.ts", import.meta.url))` — Turbopack supports this.

## Design system (source of truth)
- Tokens are **CSS custom properties** in `app/globals.css`, switched via `[data-theme]` on `<html>`. Reference colors as `var(--coral)`, `var(--text)`, `var(--surface-2)`, etc. Never hardcode hex/oklch in components.
- Styling = **CSS Modules** (`*.module.css`) referencing the vars. No Tailwind, no inline-style color literals.
- Reusable primitives live in `components/ui/` (Button, Chip, Card, Avatar, Icon, Logo, Input, StatTile, ThemeToggle) — import from `@/components/ui`. The Board is `components/board/Board.tsx`.
- Original design mockups (read-only reference) are at the parent dir: `../tokens.jsx`, `../screens/*.jsx`. Match them closely.
- Fonts: Geist + Geist Mono via `next/font`, exposed as `--font-sans` / `--font-mono`. Use `.mono` or `var(--font-mono)` for numerics (ELO, timers, scores, room codes).

## Core contracts (frozen — do not change shapes)
- Board/cells: `engine/types.ts` — `cells[col][row]`, row 0 = bottom, value `'c'` (coral=P1) | `'a'` (aqua=P2) | `null`. Moves serialize as `number[]` (column indices), starting player `'c'`.
- Import shared pure helpers from `@/engine/types` (`createBoard`, `drop`, `fromMovelist`, `winningLineForMovelist`, `playerToMove`, …). Don't re-implement board logic.

## Conventions
- Dependencies are pre-installed (supabase-js, @supabase/ssr, openai, stripe, zod, vitest). Don't add new deps without flagging; if one is truly needed, note it.
- Do NOT run `next dev` / `next build` (a lockfile blocks concurrent runs). Verify with `npx tsc --noEmit` and, for the engine, `npx vitest run`.
- TypeScript strict. No `any` without cause. Keep files focused.
- Env vars: see `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `STRIPE_*`/`OPENAI_API_KEY` are server-only — never import into client components.
