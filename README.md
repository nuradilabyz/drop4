# Drop4 — *Four in a row. Sharper every drop.*

A modern, competitive web platform for **Connect Four**. Not another clone — a startup-grade product: play a friend by link in real time, drill against an AI **that explains your mistakes**, climb your **city's** ladder, solve a daily puzzle, and go Pro.

🔗 **Live:** **https://drop4-six.vercel.app**  ·  💻 **Repo:** https://github.com/nuradilabyz/drop4

<sub>Next.js 16 · TypeScript · Supabase (Postgres + Auth + Realtime + RLS) · OpenAI · Stripe · Vercel</sub>

---

## 🎯 Что это, для кого и почему ценно

> *Главная цель — не просто сайт для игры, а продукт, который потенциально может стать настоящим сервисом.*

- **Что это.** «Четыре в ряд» как живой онлайн-сервис: **Solo** против ИИ (4 уровня сложности), **Duel по ссылке** (реалтайм 1-на-1 + зрители), **Ranked** с движением ELO, **городские лидерборды**, ежедневные **головоломки** и — главная фишка — **AI-тренер**, который после партии человеческим языком объясняет, где именно ты ошибся и какой ход был выигрышным.

- **Для кого.** Игроки, которые хотят не просто кликать фишки, а **расти**: от новичка до завсегдатая местного рейтинга. И сообщества — клубы, школы, компании (тариф **Team**), где «четыре в ряд» становится поводом для соревнования.

- **Почему это ценно (и почему может стать сервисом).**
  - **Удержание** — рейтинг, серии, достижения, дневные пазлы, история матчей.
  - **Обучение** — AI-тренер превращает поражение в урок. Это ключевой дифференциатор: обычный Connect Four только говорит «ты проиграл», Drop4 говорит **почему**.
  - **Социальный слой** — лидерборды по городам («лучший в Алматы») создают локальную конкуренцию и виральность через шеринг матч-карточек.
  - **Реальная монетизация** — Free / Pro ($4·мес или $36·год) / Team ($12·мес) с рабочим Stripe-чекаутом и вебхуком.

Это попадает в уровень **«Великий»** челленджа и идёт дальше: реалтайм-мультиплеер, AI-коуч, социальный city-leaderboard, понятная ниша и работающий биллинг.

---

## ⚡ Попробовать за 60 секунд

| Хочу… | Куда идти |
|-------|-----------|
| Сыграть против ИИ | [/play](https://drop4-six.vercel.app/play) → выбери сложность → **Start training** |
| Позвать друга | [/play](https://drop4-six.vercel.app/play) → **Create room link** → отправь URL |
| Решить головоломку дня | [/puzzle/today](https://drop4-six.vercel.app/puzzle/today) |
| Посмотреть рейтинг города | [/leaderboard](https://drop4-six.vercel.app/leaderboard) |
| Увидеть разбор от AI-тренера | [/coach](https://drop4-six.vercel.app/coach) (появляется после сыгранной партии) |
| Тарифы | [/pricing](https://drop4-six.vercel.app/pricing) (переключатель Monthly/Yearly) |

---

## ✨ Что внутри

| Область | Что сделано |
|---------|-------------|
| **Движок** | Bitboard-движок Connect-4 (negamax + alpha-beta, transposition table, endgame solver) в **Web Worker** — мгновенно и без серверных затрат. Сложности Easy → Insane. |
| **Solo** | Игра против ИИ с таймерами на ход, **подсказкой лучшего хода** (Pro), **подсветкой угроз**, сериями best-of, свечением выигрышной линии, анимацией падающих фишек, продолжением с места остановки. |
| **Duel по ссылке** | Один URL → пошаговый матч в реальном времени поверх **Supabase Realtime** (broadcast + presence). Гостевой вход (анонимная авторизация), переподключение, **режим зрителя**, авто-закрытие по простою, реванш. |
| **AI-тренер** 🏆 | Прогоняет партию через движок → точность по ходам, классификация blunder / brilliant / fork, eval-bar, поиск упущенных угроз → затем **OpenAI** пишет разбор человеческим языком («ты упустил диагональную угрозу — ход в 1-ю колонку был вынужденным»). Без API-ключа работает детерминированный шаблон. Перемотка партии по ходам. |
| **Социалка** | ELO, серии побед, достижения, история матчей, **городские лидерборды** (за неделю / за всё время, месячный сброс), профили с ELO-графиком и тепловой картой дебютов. |
| **Монетизация** | Free / Pro ($4·мес / $36·год) / Team ($12·мес) с реальным **Stripe** (test mode) чекаутом + вебхук → Pro-флаг. Pro открывает безлимит подсказок, полного тренера, скины, корону у имени. |
| **Креатив** | Шеринговые **OG-карточки матчей** + страница-анфолд `/m/<token>`, фоновый lo-fi с честным авто-стартом, ежедневные пазлы, светлая/тёмная темы, самоиграющая доска на лендинге. |

---

## 🧱 Технологии

- **Next.js 16** (App Router) + **TypeScript** — деплой на **Vercel**
- **Supabase** — Postgres + Auth (email/пароль, брендированное восстановление, анонимный гость для дуэлей) + Realtime + **Row Level Security**
- **OpenAI** — нарратив AI-тренера (провайдер сменный; есть шаблонный fallback)
- **Stripe** (test mode) — биллинг (checkout + portal + webhook)
- **Дизайн-система** — CSS custom properties (light/dark) + **CSS Modules**, шрифты Geist / Geist Mono через `next/font`. Без UI-фреймворков, без Tailwind.

## 🗂 Архитектура

```
app/         16 маршрутов: / play game/[id] r/[slug] coach coach/[matchId]
             profile/[username] leaderboard pricing puzzle/[date] login
             m/[token] account/password privacy terms playground
             + api/{coach, match/finalize, stripe/{checkout,portal,webhook}, og}
             + auth/{callback,signout}, r/new (route handlers)
components/  ui/ (Button, Chip, Card, Avatar, Icon …) board/ game/ coach/ charts/ layout/ billing/ duel/
engine/      bitboard · search · eval · threats · solver · analyze · worker · types
lib/         supabase/ · game/ · coach/ · realtime/ · audio/ · elo · entitlements · share · theme
supabase/    миграции + seed + config (схема, RLS, leaderboard-функция, ELO-finalize)
```

**Ключевые решения:**
- Движок **чистый и изоморфный** — крутится и в воркере (игра), и на сервере (тренер + анти-чит валидация матча).
- **ELO пишется только на сервере** после переигрывания списка ходов — клиент не может подделать результат.
- Контракт доски (`cells[col][row]`, `'c'`/`'a'`) заморожен в `engine/types.ts`.
- **Realtime-дуэли:** место гостя занимается **атомарно** (`UPDATE … WHERE guest_id IS NULL`) — гонок за место и «двух гостей» быть не может; третий заходящий становится зрителем.

---

## ✅ Качество

- **54 unit-теста** (`vitest`): движок, ELO-математика, state-machine аудио. Строгая типизация (`tsc --noEmit`, без `any`).
- Перед сдачей проект прогонялся **флотом из ~15 параллельных QA-агентов** (headless Playwright): каждая страница и каждая кнопка протестированы отдельно на **desktop и mobile** — цены, навигация, реалтайм-дуэли (3 контекста), чекаут, все API-эндпоинты (0 пятисоток). Найденные баги исправлены и перепроверены вживую на проде.

```bash
npx vitest run     # 54 теста
npx tsc --noEmit   # типы
```

---

## 🛠 Запуск локально

Нужны Node 20.9+ и Docker (для локального Supabase).

```bash
# 1) Бэкенд (Postgres + Auth + Realtime) — применит миграции + seed
supabase start          # CLI: https://supabase.com/docs/guides/cli
supabase db reset

# 2) Env — .env.local уже содержит стандартные ключи локального Supabase.
#    OPENAI_API_KEY — для живого разбора тренера (опционально; без него работает шаблон).
#    STRIPE_* (test) — для биллинга (опционально).

# 3) Приложение
npm install
npm run dev             # http://localhost:3000
```

Без Docker/Supabase всё равно работают **Solo, AI-тренер (шаблонный режим), пазлы и все витрины** — они держатся на движке + localStorage. Авторизация, дуэли и лидерборды требуют Supabase.

**Переменные окружения** (`.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_*`, `NEXT_PUBLIC_SITE_URL`.

## 🚀 Деплой (Vercel + Supabase)

1. **Supabase:** создать hosted-проект → `supabase link` → `supabase db push` → включить **Anonymous sign-ins** и **Realtime**; Auth redirect URL → `https://<домен>/auth/callback`.
2. **Vercel:** импортировать репозиторий, **Root Directory = `drop4`**, добавить все env (ключи Supabase, OpenAI, Stripe **test**), `NEXT_PUBLIC_SITE_URL` = адрес деплоя.
3. **Stripe:** вебхук на `https://<домен>/api/stripe/webhook`, секрет → `STRIPE_WEBHOOK_SECRET`.

---

## 🧭 Roadmap (куда это растёт как сервис)

- **Живой PvP-матчмейкинг** по очереди около твоего ELO (сейчас Ranked — калиброванный бот с честной пометкой).
- Реальная per-column статистика дебютов в профиле (тепловая карта уже готова к данным).
- Турниры и клубы (Team-тариф — фундамент).
- Push-уведомления о ходе соперника в дуэли.
- Расширение тренера: интерактивные «попробуй лучший ход прямо здесь».

---

<sub>Сделано для челленджа nFactorial по Connect Four. Дизайн экспортирован из Claude Design и реализован здесь. Lo-fi трек — HoliznaCC0 (CC0 1.0). Лицензия — MIT.</sub>
