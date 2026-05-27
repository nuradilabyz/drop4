# ☀️ Доброе утро — статус Drop4

Я работал всю ночь. Это краткая сводка: что готово, что нужно от тебя, как запустить.

## Где лежит
- Приложение: `drop4/` (Next.js 16 + TypeScript)
- Приватный репозиторий: **https://github.com/nuradilabyz/drop4**
- Дизайн-исходники (референс): `../tokens.jsx`, `../screens/*.jsx`

## Что нужно от тебя (5 минут)
`drop4/.env.local` **уже создан** мной с локальными ключами Supabase. Тебе нужно дописать только:

1. **OpenAI** (для живого AI-тренера) — впиши `OPENAI_API_KEY=sk-...` в `.env.local`.
   > Без него тренер работает на шаблонах + движке (анализ настоящий, тексты шаблонные). С ключом — живые объяснения.
2. **Stripe (test mode, опционально для демо)** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ID'шки (из дашборда Stripe, Test mode). Без них раздел Pro показывается, но оплата не проходит.
3. **Деплой (Vercel)** — я не могу залогиниться в твой Vercel. Либо задеплой сам (`Import` репозитория на vercel.com, root = `drop4`, env vars те же — но для деплоя нужен **хостинговый Supabase**, не локальный), либо дай мне Vercel-токен и я задеплою.

### ⚠️ Про диск и локальный Supabase
Твой диск был забит под 100% (`/System/Volumes/Data`, свободно было ~1.6 ГБ), из-за чего Docker не смог скачать образ Postgres ночью. Я освободил немного (сейчас ~7.7 ГБ). Если локальный Supabase не поднялся — **освободи место на диске** и запусти `supabase start` в `drop4/` (CLI установлен в `~/.local/bin`). `.env.local` уже содержит стандартные локальные ключи — менять не нужно, если только `supabase start` не напечатает другие.

### Для деплоя (хостинговый Supabase)
Создай проект на supabase.com → `supabase link` + `supabase db push` (применит `supabase/migrations/`) → впиши `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` в Vercel env.

## Как запустить локально
```bash
cd drop4
# 1) локальный supabase (нужен Docker — он у тебя есть)
supabase start
# 2) скопируй ключи из вывода в .env.local
# 3)
npm run dev
# открой http://localhost:3000
```

## Маршруты (по мере готовности за ночь)
- `/` — лендинг
- `/play` — лобби (Solo / Duel / Ranked)
- `/game/[id]` — игра
- `/r/[slug]` — дуэль по ссылке
- `/coach/[matchId]` — разбор партии AI-тренером
- `/profile/[username]`, `/leaderboard`, `/pricing`
- `/playground` — витрина дизайн-системы (для проверки)

## Что сделано / в процессе
Смотри `git log` и `PROGRESS.md` (обновляю по ходу ночи).
