-- ============================================================================
-- Drop4 — local dev seed
-- ----------------------------------------------------------------------------
-- Creates a handful of fake players across a few cities, ranked match history,
-- weekly Elo snapshots (so leaderboard deltas render), and today's daily puzzle.
--
-- NOTE: We insert into auth.users directly (local dev only). The
-- handle_new_user() trigger will auto-create a profile for each; we then UPDATE
-- those profiles with realistic stats. Re-runnable: guarded with ON CONFLICT.
-- ============================================================================

-- Deterministic UUIDs so matches/snapshots can reference players by hand.
-- a-prefixed = Almaty, b- = Astana, c- = Shymkent.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aigerim@example.com',  crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"aigerim","display_name":"Aigerim K.","city":"Almaty"}',   now(), now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'daniyar@example.com',  crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"daniyar","display_name":"Daniyar T.","city":"Almaty"}',   now(), now()),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'madina@example.com',   crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"madina","display_name":"Madina S.","city":"Almaty"}',     now(), now()),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'yerlan@example.com',   crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"yerlan","display_name":"Yerlan M.","city":"Astana"}',     now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gulnara@example.com',  crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"gulnara","display_name":"Gulnara A.","city":"Astana"}',   now(), now()),
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'azamat@example.com',   crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"azamat","display_name":"Azamat B.","city":"Astana"}',     now(), now()),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'aruzhan@example.com',  crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"aruzhan","display_name":"Aruzhan N.","city":"Shymkent"}', now(), now()),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nurlan@example.com',   crypt('password123', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"nurlan","display_name":"Nurlan D.","city":"Shymkent"}',   now(), now())
on conflict (id) do nothing;

-- Identities so Supabase Auth treats these as proper email accounts.
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id,
  u.id,
  u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(), now(), now()
from auth.users u
where u.id in (
  '00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3',
  '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2'
)
on conflict (provider, provider_id) do nothing;

-- The trigger created bare profiles; flesh them out with stats.
-- (Upsert in case the trigger is disabled in some environment.)
insert into public.profiles
  (id, username, display_name, city, elo, is_pro, pro_tier, streak, best_streak, games, wins, losses, draws, favorite_col, avg_game_ms)
values
  ('00000000-0000-0000-0000-0000000000a1', 'aigerim', 'Aigerim K.', 'Almaty',   2034, true,  'pro',  6, 11, 142, 95, 41, 6, 3, 41000),
  ('00000000-0000-0000-0000-0000000000a2', 'daniyar', 'Daniyar T.', 'Almaty',   1876, false, null,   0,  7,  98, 54, 40, 4, 4, 53000),
  ('00000000-0000-0000-0000-0000000000a3', 'madina',  'Madina S.',  'Almaty',   1620, false, null,   2,  5,  61, 33, 25, 3, 2, 60000),
  ('00000000-0000-0000-0000-0000000000b1', 'yerlan',  'Yerlan M.',  'Astana',   2188, true,  'pro',  9, 14, 210, 150, 52, 8, 3, 38000),
  ('00000000-0000-0000-0000-0000000000b2', 'gulnara', 'Gulnara A.', 'Astana',   1745, false, null,   1,  6,  77, 41, 33, 3, 4, 49000),
  ('00000000-0000-0000-0000-0000000000b3', 'azamat',  'Azamat B.',  'Astana',   1502, false, null,   0,  3,  44, 20, 22, 2, 3, 64000),
  ('00000000-0000-0000-0000-0000000000c1', 'aruzhan', 'Aruzhan N.', 'Shymkent', 1933, true,  'team', 4,  9, 119, 74, 40, 5, 4, 45000),
  ('00000000-0000-0000-0000-0000000000c2', 'nurlan',  'Nurlan D.',  'Shymkent', 1410, false, null,   0,  2,  31, 12, 18, 1, 3, 70000)
on conflict (id) do update set
  username     = excluded.username,
  display_name = excluded.display_name,
  city         = excluded.city,
  elo          = excluded.elo,
  is_pro       = excluded.is_pro,
  pro_tier     = excluded.pro_tier,
  streak       = excluded.streak,
  best_streak  = excluded.best_streak,
  games        = excluded.games,
  wins         = excluded.wins,
  losses       = excluded.losses,
  draws        = excluded.draws,
  favorite_col = excluded.favorite_col,
  avg_game_ms  = excluded.avg_game_ms;

-- Weekly Elo snapshots at the start of the current ISO week, so the leaderboard
-- can compute weekly_delta = current elo - snapshot elo.
insert into public.elo_snapshots (user_id, period_start, elo, delta, city)
values
  ('00000000-0000-0000-0000-0000000000a1', date_trunc('week', now())::date, 2002, 0, 'Almaty'),
  ('00000000-0000-0000-0000-0000000000a2', date_trunc('week', now())::date, 1890, 0, 'Almaty'),
  ('00000000-0000-0000-0000-0000000000a3', date_trunc('week', now())::date, 1611, 0, 'Almaty'),
  ('00000000-0000-0000-0000-0000000000b1', date_trunc('week', now())::date, 2140, 0, 'Astana'),
  ('00000000-0000-0000-0000-0000000000b2', date_trunc('week', now())::date, 1760, 0, 'Astana'),
  ('00000000-0000-0000-0000-0000000000b3', date_trunc('week', now())::date, 1495, 0, 'Astana'),
  ('00000000-0000-0000-0000-0000000000c1', date_trunc('week', now())::date, 1908, 0, 'Shymkent'),
  ('00000000-0000-0000-0000-0000000000c2', date_trunc('week', now())::date, 1430, 0, 'Shymkent')
on conflict (user_id, period_start) do nothing;

-- A few finished ranked matches so history/recent-matches views look alive.
-- Movelists are legal Connect Four games; results match the engine replay.
insert into public.matches
  (id, mode, player1_id, player2_id, ai_difficulty, result, winner_id, elo_delta, movelist, think_ms, duration_ms, created_at, ended_at)
values
  -- aigerim beats daniyar: coral wins bottom row 0,1,2,3.
  ('10000000-0000-0000-0000-000000000001', 'ranked',
   '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
   null, 'p1', '00000000-0000-0000-0000-0000000000a1', 12,
   array[0,6,1,5,2,4,3], array[2100,1800,1500,1700,1600,1400,1900], 42000,
   now() - interval '2 days', now() - interval '2 days' + interval '42 seconds'),
  -- yerlan beats gulnara: coral vertical in column 3.
  ('10000000-0000-0000-0000-000000000002', 'ranked',
   '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2',
   null, 'p1', '00000000-0000-0000-0000-0000000000b1', 9,
   array[3,4,3,5,3,6,3], array[1200,1300,1100,1400,1000,1500,900], 36000,
   now() - interval '1 day', now() - interval '1 day' + interval '36 seconds'),
  -- aruzhan (p2) beats nurlan: aqua wins bottom row 0,1,2,3 after coral fills 6,5,4 then drops elsewhere.
  ('10000000-0000-0000-0000-000000000003', 'ranked',
   '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1',
   null, 'p2', '00000000-0000-0000-0000-0000000000c1', -8,
   array[0,1,0,2,0,3,5,4], array[1700,1600,1500,1600,1500,1400,1300,1200], 51000,
   now() - interval '3 days', now() - interval '3 days' + interval '51 seconds'),
  -- A solo (vs AI) game for daniyar, recorded but no ranked Elo.
  ('10000000-0000-0000-0000-000000000004', 'solo',
   '00000000-0000-0000-0000-0000000000a2', null,
   'hard', 'p1', '00000000-0000-0000-0000-0000000000a2', null,
   array[3,2,3,2,3,2,3], array[800,400,900,500,1000,600,1100], 31000,
   now() - interval '5 hours', now() - interval '5 hours' + interval '31 seconds')
on conflict (id) do nothing;

-- Today's daily puzzle. cells is the engine board snapshot (cells[col][row]).
-- 'c' to move can win by completing the bottom row at column 3.
insert into public.daily_puzzles (date, puzzle_number, cells, to_move, solution, theme, solved_count)
values (
  current_date,
  101,
  '[["c"],["c"],["c"],[],["a"],["a"],["a"]]'::jsonb,
  'c',
  array[3],
  'Win in 1: complete the row',
  37
)
on conflict (date) do nothing;
