"use client";

/**
 * Duel (human-vs-human over Supabase Realtime) game controller.
 *
 * Mirrors the *shape* of `useSoloGame` (so the same GameView can render it) but
 * shares none of its code: there is no engine, no AI loop, and the source of
 * truth is split between local optimistic state and a peer over a realtime
 * channel, with `matches.movelist` as the durable backstop for reconnection.
 *
 * ── Seats & turn order ──
 *   Host  = player1 = coral ('c') = EVEN plies (0, 2, 4, …).
 *   Guest = player2 = aqua  ('a') = ODD  plies (1, 3, 5, …).
 *   It is your turn iff `movelist.length % 2` equals your seat parity. The
 *   `starter` flips each rematch (we model this by swapping which seat owns the
 *   even plies via `starterSeat`).
 *
 * ── Move flow ──
 *   On your turn you `play(col)`: apply optimistically, append to the movelist,
 *   persist (host writes `matches.movelist`), and broadcast `{move,col,ply}`.
 *   On receiving a peer move we validate `ply === movelist.length` and `canDrop`;
 *   a mismatch triggers a resync request (`hello`) — the peer replies with the
 *   authoritative `sync` snapshot which we replay via `fromMovelist`.
 *
 * ── Lifecycle ──
 *   `phase` walks: connecting → waiting (open, no guest) → playing → finished,
 *   plus terminal `closed` (idle 10-min timeout) and `error`.
 *
 * This hook is intentionally free of view concerns; `DuelRoom` maps its output
 * to `GameViewProps` and renders the waiting-room / closed UI around it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  canDrop,
  columnHeight,
  createBoard,
  fromMovelist,
  isFull,
  winningLineAt,
  type Cells,
  type Coord,
  type GameResult,
  type Movelist,
  type Player,
} from "@/engine/types";
import { createClient } from "@/lib/supabase/client";
import {
  createDuelChannel,
  type DuelChannel,
  type DuelEvent,
  type DuelPresence,
  type Seat,
} from "@/lib/realtime/duel";
import { saveMatch, type MatchPlayer } from "./matchStore";

/** Room rows are read straight off the table; keep the fields we touch. */
interface RoomRow {
  slug: string;
  host_id: string | null;
  guest_id: string | null;
  match_id: string | null;
  status: "open" | "active" | "closed";
  last_activity_at: string;
}

export type DuelPhase =
  | "connecting"
  | "waiting"
  | "playing"
  | "finished"
  | "closed"
  | "error";

/** Idle window before a room auto-closes (matches the lobby copy). */
export const IDLE_CLOSE_MS = 10 * 60 * 1000;

export interface UseDuelGameOptions {
  slug: string;
  /** Read-only watcher: never claims a seat, board input disabled. */
  spectate?: boolean;
  /** Local display name. */
  name?: string;
}

export interface DuelGameState {
  phase: DuelPhase;
  /** Human-readable error / status message for the error + closed states. */
  message: string | null;
  cells: Cells;
  movelist: Movelist;
  /** Side to move (frozen at game end). */
  current: Player;
  /** Chip colour of ply 0 this game ('c' default; flips each rematch). */
  starter: Player;
  /** Local participant's seat. */
  seat: Seat;
  /** Local participant's disc colour ('c' host / 'a' guest), null for spectator. */
  myChip: Player | null;
  winLine: Coord[] | null;
  result: GameResult | null;
  winner: Player | null;
  /** True when it's the local player's turn (false for spectators). */
  myTurn: boolean;
  /** Whether the opponent is currently connected (presence). */
  opponentOnline: boolean;
  /** Opponent display name (best-effort from presence). */
  opponentName: string;
  /** Host display name from presence — used by spectators. Falls back to
   *  "Host" only if presence hasn't synced yet. */
  hostName: string;
  /** Guest display name from presence — used by spectators. Falls back to
   *  "Guest" only if the guest seat hasn't joined yet. */
  guestName: string;
  /** ms remaining before idle-close; counts down while waiting/playing. */
  idleMsLeft: number;
  /** Series score keyed by chip colour. */
  series: { c: number; a: number };
  /** Shareable room URL (resolved client-side), or "" until mounted. */
  shareUrl: string;
  /** Number of spectators currently watching. */
  spectatorCount: number;
  /** Pending rematch offer from the opponent (show an "accept" affordance). */
  rematchOffered: boolean;
  /** We offered a rematch and are waiting for the opponent. */
  rematchPending: boolean;
}

export interface DuelGameApi extends DuelGameState {
  /** Play a column. No-ops unless it's your turn, legal, and you hold a seat. */
  play: (col: number) => void;
  /** Resign the current game (counts as a loss for you). */
  resign: () => void;
  /** Offer / accept a rematch. */
  rematch: () => void;
  /** Decline an incoming rematch offer, OR cancel our own pending one. */
  declineRematch: () => void;
  /** Persist the finished game locally + return its id for the coach handoff. */
  saveForCoach: () => string | null;
}

const GUEST_ID_KEY = "drop4:guestId";

/** Stable per-browser guest id used when anonymous auth is unavailable. */
function localGuestId(): string {
  if (typeof window === "undefined") return "guest";
  try {
    const existing = window.localStorage.getItem(GUEST_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `guest-${crypto.randomUUID()}`
        : `guest-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(GUEST_ID_KEY, id);
    return id;
  } catch {
    return `guest-${Math.random().toString(36).slice(2)}`;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres `matches.player*_id` are uuid columns — only store real uuids. */
function asUuid(id: string | null | undefined): string | null {
  return id && UUID_RE.test(id) ? id : null;
}

/** Ply parity that the host owns this game; flips on rematch. */
function chipForPly(ply: number, hostChipParity: 0 | 1): Player {
  // host owns plies whose parity === hostChipParity → coral; the other → aqua.
  return ply % 2 === hostChipParity ? "c" : "a";
}

export function useDuelGame(opts: UseDuelGameOptions): DuelGameApi {
  const { slug, spectate = false, name = "You" } = opts;

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();

  const channelRef = useRef<DuelChannel | null>(null);
  const uidRef = useRef<string>("");
  const seatRef = useRef<Seat>(spectate ? "spectator" : "host");

  // ── State ──
  const [phase, setPhase] = useState<DuelPhase>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [movelist, setMovelist] = useState<Movelist>([]);
  const [cells, setCells] = useState<Cells>(() => createBoard());
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [seat, setSeat] = useState<Seat>(spectate ? "spectator" : "host");
  const [peers, setPeers] = useState<DuelPresence[]>([]);
  const [idleMsLeft, setIdleMsLeft] = useState(IDLE_CLOSE_MS);
  const [series, setSeries] = useState<{ c: number; a: number }>({ c: 0, a: 0 });
  const [shareUrl, setShareUrl] = useState("");
  const [rematchOffered, setRematchOffered] = useState(false);
  const [rematchPending, setRematchPending] = useState(false);
  // Local participant id, resolved during init (auth uid or guest fallback).
  const [uid, setUid] = useState("");
  // 0 → host plays coral on even plies (default); flips to 1 on rematch.
  const [hostChipParity, setHostChipParity] = useState<0 | 1>(0);

  const matchIdRef = useRef<string | null>(null);
  // Initialized to 0 (impure Date.now() must not run during render); set on
  // mount + on each activity bump.
  const lastActivityRef = useRef<number>(0);
  // Mirror state for handlers/closures without stale captures. These are kept
  // in sync via the effect below — never mutated during render (Compiler rule).
  const movelistRef = useRef<Movelist>([]);
  const hostChipParityRef = useRef<0 | 1>(0);
  const phaseRef = useRef<DuelPhase>("connecting");
  const rematchPendingRef = useRef(false);

  // Sync mirror refs after each render (outside the render pass).
  useEffect(() => {
    movelistRef.current = movelist;
    hostChipParityRef.current = hostChipParity;
    phaseRef.current = phase;
    rematchPendingRef.current = rematchPending;
  });

  // ── Derived ──
  const myChip: Player | null =
    seat === "host" ? "c" : seat === "guest" ? "a" : null;
  const current: Player = useMemo(
    () => chipForPly(movelist.length, hostChipParity),
    [movelist.length, hostChipParity],
  );
  const myTurn =
    phase === "playing" && myChip !== null && current === myChip;

  const opponent = useMemo(() => {
    const oppSeat: Seat = seat === "host" ? "guest" : "host";
    return peers.find((p) => p.seat === oppSeat && p.uid !== uid);
  }, [peers, seat, uid]);
  const opponentOnline = Boolean(opponent?.online);
  const opponentName = opponent?.name ?? (seat === "host" ? "Guest" : "Host");

  // Resolve host + guest names from presence regardless of which seat we
  // hold (spectators need both; players use this for the win banner). The
  // generic "Host" / "Guest" fallback only fires before presence has
  // synced or while a seat is still empty.
  const hostName = useMemo(
    () => peers.find((p) => p.seat === "host")?.name ?? "Host",
    [peers],
  );
  const guestName = useMemo(
    () => peers.find((p) => p.seat === "guest")?.name ?? "Guest",
    [peers],
  );
  const spectatorCount = peers.filter((p) => p.seat === "spectator").length;

  // ── Resolve the shareable URL once mounted (deferred so it isn't a
  // synchronous render cascade under the React Compiler lint). ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/r/${slug}`;
    const t = setTimeout(() => {
      setShareUrl((prev) => (prev === url ? prev : url));
    }, 0);
    return () => clearTimeout(t);
  }, [slug]);

  // ── Persistence helpers. ──
  const bumpActivity = useCallback(async () => {
    lastActivityRef.current = Date.now();
    setIdleMsLeft(IDLE_CLOSE_MS);
    try {
      await supabaseRef.current!
        .from("duel_rooms")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("slug", slug);
    } catch {
      /* best effort */
    }
  }, [slug]);

  const persistMovelist = useCallback(async (moves: Movelist) => {
    const matchId = matchIdRef.current;
    if (!matchId) return;
    try {
      await supabaseRef.current!
        .from("matches")
        .update({ movelist: moves })
        .eq("id", matchId);
    } catch {
      /* best effort — realtime + peer sync cover transient failures */
    }
  }, []);

  // ── Apply a fully-validated movelist to local board state. ──
  const applyMovelist = useCallback((moves: Movelist) => {
    let next: Cells;
    try {
      // The starter chip flips on rematch (hostChipParity). Pass it through
      // so the reconstructed cells colour each ply consistently with whose
      // turn `chipForPly` says it is.
      next = fromMovelist(moves, chipForPly(0, hostChipParityRef.current));
    } catch {
      return; // illegal snapshot — ignore
    }
    setMovelist(moves);
    setCells(next);
    // Detect terminal state on the rebuilt board.
    const last = moves[moves.length - 1];
    if (last !== undefined) {
      const row = columnHeight(next, last) - 1;
      const line = winningLineAt(next, last, row);
      if (line) {
        const winnerChip = chipForPly(moves.length - 1, hostChipParityRef.current);
        setWinLine(line);
        setWinner(winnerChip);
        setResult(winnerChip);
        setPhase("finished");
        // Bump the series counter at game-end (not at rematch-acceptance)
        // so both players see W/L update the instant the win is detected
        // — the user explicitly flagged the delayed counter as a bug.
        setSeries((s) =>
          winnerChip === "c"
            ? { ...s, c: s.c + 1 }
            : { ...s, a: s.a + 1 },
        );
        return;
      }
    }
    if (isFull(next)) {
      setWinLine(null);
      setWinner(null);
      setResult("draw");
      setPhase("finished");
      return;
    }
    setWinLine(null);
    setWinner(null);
    setResult(null);
    if (phaseRef.current !== "finished") setPhase("playing");
  }, []);

  // Late-bound rematch starter (its body depends on callbacks defined further
  // down). Kept in a ref so `handleEvent` can call it without a TDZ cycle.
  const startRematchRef = useRef<() => void>(() => {});
  const startRematch = useCallback(() => startRematchRef.current(), []);

  // ── Inbound realtime events. ──
  const handleEvent = useCallback(
    (evt: DuelEvent) => {
      if (evt.by === uidRef.current) return; // ignore our own echoes

      if (evt.type === "hello") {
        // A peer (re)joined → send them the authoritative snapshot if we're a
        // player. Spectators don't answer (a player will).
        if (seatRef.current !== "spectator") {
          channelRef.current?.send({
            type: "sync",
            movelist: movelistRef.current,
            starter: chipForPly(0, hostChipParityRef.current),
            by: uidRef.current,
          });
        }
        return;
      }

      if (evt.type === "sync") {
        // Authoritative snapshot from a peer. Adopt it if it's longer/different
        // (covers reconnection + desync recovery).
        const incoming = evt.movelist;
        const mine = movelistRef.current;
        if (
          incoming.length !== mine.length ||
          incoming.some((c, i) => c !== mine[i])
        ) {
          // The starter encodes the host's parity for this game.
          setHostChipParity(evt.starter === "c" ? 0 : 1);
          applyMovelist(incoming);
        }
        return;
      }

      if (evt.type === "move") {
        const expected = movelistRef.current.length;
        let board: Cells;
        try {
          board = fromMovelist(
            movelistRef.current,
            chipForPly(0, hostChipParityRef.current),
          );
        } catch {
          // Local movelist is corrupt — re-sync from the peer.
          channelRef.current?.send({ type: "hello", by: uidRef.current });
          return;
        }
        if (evt.ply !== expected || !canDrop(board, evt.col)) {
          // Desync (out-of-order / illegal) — ask the peer for the truth.
          channelRef.current?.send({ type: "hello", by: uidRef.current });
          return;
        }
        applyMovelist([...movelistRef.current, evt.col]);
        return;
      }

      if (evt.type === "resign") {
        // The opponent resigned (we ignored our own echo above) → we win.
        // Spectators record the resigner's loss as the *other* seat winning.
        const winnerChip: Player =
          seatRef.current === "spectator"
            ? // resigner is a player; the winner is whichever seat didn't send.
              chipForPly(0, hostChipParityRef.current) // default to host-as-winner view
            : myChipFromSeat(seatRef.current);
        setWinner(winnerChip);
        setResult(winnerChip);
        setWinLine(null);
        setPhase("finished");
        setSeries((s) =>
          winnerChip === "c"
            ? { ...s, c: s.c + 1 }
            : { ...s, a: s.a + 1 },
        );
        return;
      }

      if (evt.type === "rematch") {
        // Stray-event guard: the rematch acceptance handshake echoes back
        // a second `rematch` event to the offerer, which used to set
        // `rematchOffered=true` on the *peer* who already accepted. The
        // peer is now mid-game in "playing" phase, but the stale flag
        // then leaked into the NEXT game's finished state, lighting up
        // the Accept banner with no actual offer behind it. Only treat
        // an incoming offer as real when we're actually at game-over.
        if (evt.accept) {
          if (rematchPendingRef.current) {
            startRematch();
          } else if (phaseRef.current === "finished") {
            setRematchOffered(true);
          }
          // else: stray ack from a completed handshake — ignore.
        } else {
          // accept=false → peer declined an offer (or cancelled their
          // own). Clear both sides of the handshake so the modal closes
          // for everyone and the "Rematch" button is the only path
          // forward from here.
          setRematchOffered(false);
          setRematchPending(false);
        }
        return;
      }
    },
    [applyMovelist, startRematch],
  );

  // ── Subscribe + claim the room on mount. ──
  useEffect(() => {
    let cancelled = false;
    let channel: DuelChannel | null = null;
    const supabase = supabaseRef.current!;

    const init = async () => {
      // 1. Resolve identity (session → anonymous → localStorage fallback).
      let myUid: string | null = null;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        myUid = user.id;
      } else if (!spectate) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (!error && data.user) myUid = data.user.id;
      }
      if (!myUid) myUid = localGuestId();
      uidRef.current = myUid;
      setUid(myUid);

      // 2. Load the room row.
      const { data: room, error: roomErr } = await supabase
        .from("duel_rooms")
        .select("slug, host_id, guest_id, match_id, status, last_activity_at")
        .eq("slug", slug)
        .maybeSingle<RoomRow>();

      if (cancelled) return;
      if (roomErr || !room) {
        setPhase("error");
        setMessage("This room doesn't exist (or has been removed).");
        return;
      }
      if (room.status === "closed") {
        setPhase("closed");
        setMessage("Room closed (idle).");
        return;
      }

      // 3. Determine our seat.
      let mySeat: Seat;
      if (spectate) {
        mySeat = "spectator";
      } else if (room.host_id === myUid || (!room.host_id && !room.guest_id)) {
        // Owner of an open room (or an orphaned room we adopt as host).
        mySeat = "host";
        if (!room.host_id) {
          await supabase
            .from("duel_rooms")
            .update({ host_id: myUid })
            .eq("slug", slug);
        }
      } else if (room.guest_id === myUid) {
        mySeat = "guest";
      } else if (!room.guest_id) {
        // Open seat → claim it + activate the room + create the match.
        mySeat = "guest";
        const { data: match } = await supabase
          .from("matches")
          .insert({
            mode: "duel",
            // uuid columns: store only real auth uids; guest fallbacks → null.
            player1_id: asUuid(room.host_id),
            player2_id: asUuid(myUid),
            movelist: [],
          })
          .select("id")
          .single();
        const matchId = match?.id ?? null;
        matchIdRef.current = matchId;
        await supabase
          .from("duel_rooms")
          .update({
            guest_id: myUid,
            status: "active",
            match_id: matchId,
            last_activity_at: new Date().toISOString(),
          })
          .eq("slug", slug);
      } else {
        // Both seats taken by others → fall back to spectating.
        mySeat = "spectator";
        setMessage("Both seats are taken — you're spectating.");
      }
      if (cancelled) return;
      seatRef.current = mySeat;
      setSeat(mySeat);
      matchIdRef.current = matchIdRef.current ?? room.match_id ?? null;
      // Seed the idle clock from the room's last activity.
      lastActivityRef.current = Date.parse(room.last_activity_at) || Date.now();

      // 4. Rebuild board from the durable movelist (reconnection).
      if (matchIdRef.current) {
        const { data: matchRow } = await supabase
          .from("matches")
          .select("movelist")
          .eq("id", matchIdRef.current)
          .maybeSingle<{ movelist: number[] | null }>();
        if (matchRow?.movelist && matchRow.movelist.length > 0) {
          applyMovelist(matchRow.movelist);
        }
      }

      // 5. Decide the initial phase.
      if (mySeat === "host" && !room.guest_id) {
        if (phaseRef.current !== "finished") setPhase("waiting");
      } else if (phaseRef.current !== "finished") {
        setPhase("playing");
      }

      // 6. Open the realtime channel. We always have a real name now — the
      // host resolves theirs server-side from `profiles.display_name`, the
      // guest types one in `GuestNamePrompt` before the room mounts. The
      // generic "Host"/"Guest"/"Watcher" labels only show up as the
      // fallback in `hostName`/`guestName` for the brief window before
      // presence has synced.
      channel = createDuelChannel({
        client: supabase,
        slug,
        uid: myUid,
        name: name || (mySeat === "spectator" ? "Watcher" : "Player"),
        seat: mySeat,
      });
      channelRef.current = channel;
      channel.onEvent(handleEvent);
      channel.onPresence((next) => setPeers(next));
      try {
        await channel.subscribe();
      } catch {
        if (!cancelled) {
          setPhase("error");
          setMessage("Couldn't connect to the realtime channel.");
        }
        return;
      }
      // Ask any present peer for the authoritative snapshot (catch-up).
      channel.send({ type: "hello", by: myUid });
    };

    void init();

    return () => {
      cancelled = true;
      void channel?.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, spectate]);

  // ── When a guest's presence appears, a waiting host transitions to playing. ──
  const guestPresent = peers.some((p) => p.seat === "guest");
  useEffect(() => {
    if (seat === "host" && phase === "waiting" && guestPresent) {
      // Defer the transition a tick so it's not a synchronous cascade.
      const t = setTimeout(() => {
        setPhase("playing");
        void bumpActivity();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [seat, phase, guestPresent, bumpActivity]);

  // ── Idle countdown + client-side close. ──
  useEffect(() => {
    if (phase !== "waiting" && phase !== "playing") return;
    const tick = () => {
      const left = IDLE_CLOSE_MS - (Date.now() - lastActivityRef.current);
      setIdleMsLeft(Math.max(0, left));
      if (left <= 0) {
        setPhase("closed");
        setMessage("Room closed (idle).");
        // Mark the room closed (best effort; a server cron is out of scope).
        void supabaseRef.current!
          .from("duel_rooms")
          .update({ status: "closed" })
          .eq("slug", slug);
      }
    };
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase, slug]);

  // ── Play a move (local → optimistic → broadcast → persist). ──
  const play = useCallback(
    (col: number) => {
      if (phase !== "playing") return;
      if (seat === "spectator" || myChip === null) return;
      if (current !== myChip) return;
      if (!canDrop(cells, col)) return;

      const ply = movelist.length;
      const nextMoves = [...movelist, col];
      applyMovelist(nextMoves);

      channelRef.current?.send({
        type: "move",
        col,
        ply,
        by: uidRef.current,
      });
      // Each player persists their own move (idempotent overwrite of movelist).
      void persistMovelist(nextMoves);
      void bumpActivity();
    },
    [
      phase,
      seat,
      myChip,
      current,
      cells,
      movelist,
      applyMovelist,
      persistMovelist,
      bumpActivity,
    ],
  );

  // ── Resign. ──
  const resign = useCallback(() => {
    if (phase !== "playing" || myChip === null) return;
    channelRef.current?.send({ type: "resign", by: uidRef.current });
    const oppChip: Player = myChip === "c" ? "a" : "c";
    setWinner(oppChip);
    setResult(oppChip);
    setWinLine(null);
    setPhase("finished");
    setSeries((s) =>
      oppChip === "c" ? { ...s, c: s.c + 1 } : { ...s, a: s.a + 1 },
    );
  }, [phase, myChip]);

  // ── Rematch: offer, then both sides reset on acceptance. ──
  const performReset = useCallback((nextParity: 0 | 1) => {
    setHostChipParity(nextParity);
    setMovelist([]);
    movelistRef.current = [];
    setCells(createBoard());
    setWinLine(null);
    setResult(null);
    setWinner(null);
    setRematchOffered(false);
    setRematchPending(false);
    setPhase("playing");
    void bumpActivity();
  }, [bumpActivity]);

  // Bind the late starter outside render (Compiler rule: no ref writes in render).
  // Note: the series counter is now bumped at game-end (inside `applyMovelist`
  // and `resign`), so the rematch handshake only resets state — it doesn't
  // tally. That's what makes the score update immediately on the winning
  // move instead of waiting for the rematch handshake to complete.
  useEffect(() => {
    startRematchRef.current = () => {
      // Swap the starter each game so both sides get the first move.
      performReset(hostChipParityRef.current === 0 ? 1 : 0);
      // Tell the peer to start too (acceptance handshake completed).
      channelRef.current?.send({
        type: "rematch",
        by: uidRef.current,
        accept: true,
      });
    };
  }, [performReset]);

  const rematch = useCallback(() => {
    if (phase !== "finished") return;
    if (rematchOffered) {
      // Opponent already offered → accept and start now.
      startRematchRef.current();
    } else {
      // We offer first → wait for the opponent to accept.
      setRematchPending(true);
      channelRef.current?.send({
        type: "rematch",
        by: uidRef.current,
        accept: true,
      });
    }
  }, [phase, rematchOffered]);

  // Decline an incoming offer OR cancel our own pending one. Both go through
  // the same `accept: false` broadcast — the peer's handler clears both
  // sides of the handshake so the modal vanishes everywhere.
  const declineRematch = useCallback(() => {
    if (!rematchOffered && !rematchPending) return;
    channelRef.current?.send({
      type: "rematch",
      by: uidRef.current,
      accept: false,
    });
    setRematchOffered(false);
    setRematchPending(false);
  }, [rematchOffered, rematchPending]);

  // ── Coach handoff: persist locally (no ELO for casual duel). ──
  const saveForCoach = useCallback((): string | null => {
    const id = matchIdRef.current;
    if (!id) return null;
    // Convention (frozen): host is always coral, guest is always aqua.
    // The PARITY only flips who STARTS — never who owns which chip.
    // Persist players in chip order ([coral, aqua]) so downstream code can
    // resolve them positionally without re-deriving from seat.
    const hostDisplay = seat === "host" ? name : opponentName;
    const guestDisplay = seat === "guest" ? name : opponentName;
    const players: MatchPlayer[] = [
      { chip: "c", name: hostDisplay, human: seat === "host" },
      { chip: "a", name: guestDisplay, human: seat === "guest" },
    ];
    const outcome: GameResult = result ?? "draw";
    saveMatch({
      id,
      mode: "duel",
      players,
      movelist,
      // The chip that played ply 0 in THIS game — flips between coral and
      // aqua across rematches as `hostChipParity` toggles.
      starter: chipForPly(0, hostChipParity),
      think_ms: [],
      result: outcome,
      createdAt: new Date().toISOString(),
    });
    return id;
  }, [hostChipParity, seat, name, opponentName, result, movelist]);

  // Auto-persist finished duels to the local matchStore so the Coach tab
  // (which lists from there) actually finds them. The user reported duel
  // matches not appearing in history — they only saved when the user
  // explicitly clicked "Open AI Coach" / "Share win" before now.
  // Guard by a ref so the same finished game doesn't save twice on
  // unrelated re-renders.
  const lastSavedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (phase !== "finished") {
      lastSavedAtRef.current = null;
      return;
    }
    const ply = movelistRef.current.length;
    if (lastSavedAtRef.current === ply) return;
    if (saveForCoach()) lastSavedAtRef.current = ply;
  }, [phase, saveForCoach]);

  return {
    phase,
    message,
    cells,
    movelist,
    current,
    starter: chipForPly(0, hostChipParity),
    seat,
    myChip,
    winLine,
    result,
    winner,
    myTurn,
    opponentOnline,
    opponentName,
    hostName,
    guestName,
    idleMsLeft,
    series,
    shareUrl,
    spectatorCount,
    rematchOffered,
    rematchPending,
    play,
    resign,
    rematch,
    declineRematch,
    saveForCoach,
  };
}

/** Local seat → disc colour. */
function myChipFromSeat(seat: Seat): Player {
  return seat === "host" ? "c" : "a";
}
