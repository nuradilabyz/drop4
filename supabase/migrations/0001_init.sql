-- ============================================================================
-- Drop4 — initial schema, RLS, functions, triggers
-- ----------------------------------------------------------------------------
-- Connect Four platform: profiles, matches, daily puzzles, duel rooms,
-- subscriptions, Elo snapshots, and a SECURITY DEFINER leaderboard function.
--
-- Conventions:
--   * Movelists are int[] (column indices, 'c' moves first) — replayable truth.
--   * result is 'p1' | 'p2' | 'draw'; winner_id is the auth user when known.
--   * Ranked Elo writes are server-only (service role) via the finalize route.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto on older PG; harmless if already present.
create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  display_name  text,
  city          text,
  elo           int  not null default 1200,
  is_pro        boolean not null default false,
  pro_tier      text,
  streak        int  not null default 0,
  best_streak   int  not null default 0,
  games         int  not null default 0,
  wins          int  not null default 0,
  losses        int  not null default 0,
  draws         int  not null default 0,
  favorite_col  int,
  avg_game_ms   int,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is 'Public player profile, 1:1 with auth.users.';

create index profiles_elo_idx       on public.profiles (elo desc);
create index profiles_city_elo_idx  on public.profiles (city, elo desc);
create index profiles_username_idx  on public.profiles (lower(username));

-- ── matches ─────────────────────────────────────────────────────────────────
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  mode          text not null check (mode in ('solo','duel','ranked','puzzle')),
  player1_id    uuid references auth.users (id) on delete set null,
  player2_id    uuid references auth.users (id) on delete set null,
  ai_difficulty text,
  result        text check (result in ('p1','p2','draw')),
  winner_id     uuid references auth.users (id) on delete set null,
  elo_delta     int,
  movelist      int[],
  think_ms      int[],
  series        jsonb,
  duration_ms   int,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);

comment on table public.matches is 'Finalized + in-progress games. Ranked Elo deltas written server-side only.';

create index matches_player1_idx on public.matches (player1_id, created_at desc);
create index matches_player2_idx on public.matches (player2_id, created_at desc);
create index matches_ranked_idx  on public.matches (mode, ended_at desc)
  where mode = 'ranked';

-- ── daily_puzzles ─────────────────────────────────────────────────────────────
create table public.daily_puzzles (
  date          date primary key,
  puzzle_number int,
  cells         jsonb,
  to_move       text,
  solution      int[],
  theme         text,
  solved_count  int not null default 0
);

comment on table public.daily_puzzles is 'One puzzle per calendar day; cells is the engine board snapshot.';

-- ── puzzle_solves ─────────────────────────────────────────────────────────────
create table public.puzzle_solves (
  user_id   uuid not null references auth.users (id) on delete cascade,
  date      date not null references public.daily_puzzles (date) on delete cascade,
  solved    boolean not null default false,
  attempts  int not null default 0,
  ms        int,
  primary key (user_id, date)
);

comment on table public.puzzle_solves is 'Per-user attempt record for a daily puzzle.';

-- ── coach_analyses ─────────────────────────────────────────────────────────
create table public.coach_analyses (
  match_id   uuid primary key references public.matches (id) on delete cascade,
  version    int not null default 1,
  analysis   jsonb,
  created_at timestamptz not null default now()
);

comment on table public.coach_analyses is 'AI coach output for a match (jsonb), keyed by match.';

-- ── subscriptions ─────────────────────────────────────────────────────────────
create table public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text,
  tier                   text,
  current_period_end     timestamptz
);

comment on table public.subscriptions is 'Stripe subscription mirror. Writes are service-role only (webhook).';

-- ── duel_rooms ────────────────────────────────────────────────────────────────
create table public.duel_rooms (
  slug             text primary key,
  host_id          uuid references auth.users (id) on delete set null,
  guest_id         uuid references auth.users (id) on delete set null,
  match_id         uuid references public.matches (id) on delete set null,
  status           text not null default 'open' check (status in ('open','active','closed')),
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table public.duel_rooms is 'Shareable 1v1 rooms identified by slug (link recipients can read).';

-- ── elo_snapshots ─────────────────────────────────────────────────────────────
-- Records a player's Elo at the start of a leaderboard period so weekly/monthly
-- deltas (and resets) are computable without losing the all-time rating.
create table public.elo_snapshots (
  user_id      uuid not null references auth.users (id) on delete cascade,
  period_start date not null,
  elo          int  not null,
  delta        int  not null default 0,
  city         text,
  primary key (user_id, period_start)
);

comment on table public.elo_snapshots is 'Elo at the start of each leaderboard period for delta/reset math.';

create index elo_snapshots_period_idx on public.elo_snapshots (period_start, city);

-- ============================================================================
-- Trigger: create a profile when a new auth user is inserted
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate     text;
  suffix        int := 0;
begin
  -- Prefer an explicit username from sign-up metadata, else derive from email,
  -- else a random handle. Strip to a safe slug.
  base_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'player'
  );
  base_username := lower(regexp_replace(base_username, '[^a-z0-9_]', '', 'gi'));
  if base_username = '' then
    base_username := 'player';
  end if;

  candidate := base_username;
  -- Ensure uniqueness with a numeric suffix.
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    suffix := suffix + 1;
    candidate := base_username || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, city)
  values (
    new.id,
    candidate,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'city', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Leaderboard (SECURITY DEFINER) — aggregate view without broad row reads
-- ----------------------------------------------------------------------------
-- p_period: 'alltime' (default) ranks by current Elo; 'weekly'/'monthly' rank
-- by the delta gained since the most recent snapshot for that period.
-- weekly_delta is always the current-week movement (0 if no snapshot yet).
-- ============================================================================
create or replace function public.leaderboard(
  p_city   text default null,
  p_period text default 'alltime'
)
returns table (
  rank         bigint,
  user_id      uuid,
  username     text,
  display_name text,
  city         text,
  elo          int,
  weekly_delta int,
  wins         int,
  losses       int
)
language sql
stable
security definer
set search_path = public
as $$
  with week_start as (
    -- ISO week start (Monday) of today.
    select date_trunc('week', now())::date as d
  ),
  period_start as (
    select case
      when p_period = 'weekly'  then (select d from week_start)
      when p_period = 'monthly' then date_trunc('month', now())::date
      else null::date
    end as d
  ),
  snap as (
    -- Per-user snapshot at this period's start (for delta + period ranking).
    select s.user_id, s.elo as start_elo
    from public.elo_snapshots s, period_start ps
    where ps.d is not null and s.period_start = ps.d
  ),
  ranked as (
    select
      p.id          as user_id,
      p.username,
      p.display_name,
      p.city,
      p.elo,
      coalesce(p.elo - sn.start_elo, 0) as delta,
      p.wins,
      p.losses
    from public.profiles p
    left join snap sn on sn.user_id = p.id
    where p_city is null or p.city = p_city
  )
  select
    row_number() over (
      order by
        case when p_period in ('weekly','monthly') then r.delta else r.elo end desc,
        r.elo desc,
        r.username asc
    ) as rank,
    r.user_id,
    r.username,
    r.display_name,
    r.city,
    r.elo,
    r.delta as weekly_delta,
    r.wins,
    r.losses
  from ranked r
  order by rank
  limit 200;
$$;

revoke all on function public.leaderboard(text, text) from public;
grant execute on function public.leaderboard(text, text) to anon, authenticated;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.matches       enable row level security;
alter table public.daily_puzzles enable row level security;
alter table public.puzzle_solves enable row level security;
alter table public.coach_analyses enable row level security;
alter table public.subscriptions enable row level security;
alter table public.duel_rooms    enable row level security;
alter table public.elo_snapshots enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────
-- SELECT public (leaderboards/profiles). Self-only insert/update.
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

create policy "profiles_insert_self"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── matches ───────────────────────────────────────────────────────────────────
-- SELECT: own matches (either seat) OR finished ranked matches (history/boards).
create policy "matches_select_participant_or_ranked"
  on public.matches for select
  using (
    (select auth.uid()) in (player1_id, player2_id)
    or (mode = 'ranked' and ended_at is not null)
  );

-- INSERT/UPDATE only by a participant. Note: authoritative ranked finalize runs
-- under the service role, which bypasses RLS entirely.
create policy "matches_insert_participant"
  on public.matches for insert
  to authenticated
  with check ((select auth.uid()) in (player1_id, player2_id));

create policy "matches_update_participant"
  on public.matches for update
  to authenticated
  using ((select auth.uid()) in (player1_id, player2_id))
  with check ((select auth.uid()) in (player1_id, player2_id));

-- ── coach_analyses ─────────────────────────────────────────────────────────
-- SELECT by either participant of the related match.
create policy "coach_select_match_participant"
  on public.coach_analyses for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = coach_analyses.match_id
        and (select auth.uid()) in (m.player1_id, m.player2_id)
    )
  );
-- Writes are service-role only (no INSERT/UPDATE policy for clients).

-- ── duel_rooms ────────────────────────────────────────────────────────────────
-- SELECT by anyone who knows the slug (link recipients). Host creates; either
-- host or guest may update (e.g. guest joining, status transitions).
create policy "duel_select_any"
  on public.duel_rooms for select
  using (true);

create policy "duel_insert_host"
  on public.duel_rooms for insert
  to authenticated
  with check (host_id = (select auth.uid()));

create policy "duel_update_participant"
  on public.duel_rooms for update
  to authenticated
  using ((select auth.uid()) in (host_id, guest_id))
  with check ((select auth.uid()) in (host_id, guest_id));

-- ── subscriptions ───────────────────────────────────────────────────────────
-- SELECT own row only. No client writes (service-role webhook only).
create policy "subs_select_self"
  on public.subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ── daily_puzzles ───────────────────────────────────────────────────────────
create policy "puzzles_select_public"
  on public.daily_puzzles for select
  using (true);
-- Inserts/updates (rotating the daily puzzle, solved_count) are service-role.

-- ── puzzle_solves ───────────────────────────────────────────────────────────
create policy "solves_select_self"
  on public.puzzle_solves for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "solves_insert_self"
  on public.puzzle_solves for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "solves_update_self"
  on public.puzzle_solves for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── elo_snapshots ─────────────────────────────────────────────────────────────
-- SELECT own snapshots; writes are service-role (period rollover job).
create policy "snapshots_select_self"
  on public.elo_snapshots for select
  to authenticated
  using (user_id = (select auth.uid()));
