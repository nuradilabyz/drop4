/**
 * Realtime channel wrapper for "duel by link" — a thin, typed facade over a
 * single Supabase Realtime channel (`room:<slug>`) used by `useDuelGame`.
 *
 * Two transports run on the channel:
 *   1. **Broadcast** — discrete game events between the two players:
 *        - `{ type:'move',    col, ply, by }`  a disc dropped at `col`; `ply` is
 *           the index of this move in the movelist (0-based), `by` the sender uid.
 *        - `{ type:'resign',  by }`            a player conceded.
 *        - `{ type:'rematch', by, accept }`    rematch offer / acceptance.
 *        - `{ type:'sync',    movelist, by }`  authoritative movelist snapshot,
 *           sent on request or after a desync to bring a peer back in line.
 *        - `{ type:'hello',   by }`            "I just (re)subscribed — please
 *           send me a sync" — drives reconnection catch-up.
 *   2. **Presence** — liveness + seat metadata `{ uid, name, online, seat }` so
 *      each side can render "opponent online / left" and a turn indicator.
 *
 * The wrapper is deliberately transport-only: it knows nothing about Connect
 * Four rules. Turn validation, board rebuilds and persistence live in
 * `useDuelGame`. Everything is best-effort; senders never throw on a closed
 * channel (the promise from `send` is swallowed).
 */

import { REALTIME_LISTEN_TYPES } from "@supabase/supabase-js";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/client";
import type { Movelist } from "@/engine/types";

/** Which side of the board a participant holds. Host = coral, guest = aqua. */
export type Seat = "host" | "guest" | "spectator";

/** Broadcast event union sent over the channel. */
export type DuelEvent =
  | { type: "move"; col: number; ply: number; by: string }
  | { type: "resign"; by: string }
  | { type: "rematch"; by: string; accept: boolean }
  | { type: "sync"; movelist: Movelist; starter: "c" | "a"; by: string }
  | { type: "hello"; by: string };

/** Presence payload tracked per connected client. */
export interface DuelPresence {
  uid: string;
  name: string;
  online: boolean;
  seat: Seat;
}

type SupabaseBrowserClient = ReturnType<typeof createClient>;

const EVENT = "duel"; // single broadcast event name; the payload carries `type`

export interface DuelChannelOptions {
  client: SupabaseBrowserClient;
  slug: string;
  /** Local participant's stable id (auth uid or localStorage guest id). */
  uid: string;
  /** Display name shown to the peer. */
  name: string;
  /** Local seat. Spectators never broadcast game events. */
  seat: Seat;
}

export interface DuelChannel {
  /** Subscribe + start tracking presence. Resolves once SUBSCRIBED. */
  subscribe: () => Promise<void>;
  /** Broadcast a game event (no-op for spectators except `hello`). */
  send: (event: DuelEvent) => void;
  /** Register a handler for inbound game events. Returns an unsubscribe fn. */
  onEvent: (handler: (event: DuelEvent) => void) => () => void;
  /** Convenience: only move events. Returns an unsubscribe fn. */
  onMove: (
    handler: (m: { col: number; ply: number; by: string }) => void,
  ) => () => void;
  /** Register a presence handler (called on every sync). Returns unsubscribe. */
  onPresence: (handler: (peers: DuelPresence[]) => void) => () => void;
  /** Latest known presence snapshot. */
  peers: () => DuelPresence[];
  /** Tear down the channel + presence. */
  unsubscribe: () => Promise<void>;
}

/**
 * Build a duel channel facade. Call `subscribe()` to go live. Multiple handlers
 * may register via `onEvent` / `onMove` / `onPresence`; each returns its own
 * detach function.
 */
export function createDuelChannel(opts: DuelChannelOptions): DuelChannel {
  const { client, slug, uid, name, seat } = opts;

  const channel: RealtimeChannel = client.channel(`room:${slug}`, {
    config: {
      // `key` keys presence by uid so reconnects replace rather than duplicate.
      presence: { key: uid },
      // Receive our own broadcasts too — harmless (handlers ignore `by === uid`)
      // and keeps optimistic/echo logic simple.
      broadcast: { self: false },
    },
  });

  const eventHandlers = new Set<(event: DuelEvent) => void>();
  const presenceHandlers = new Set<(peers: DuelPresence[]) => void>();
  let lastPeers: DuelPresence[] = [];
  let subscribed = false;

  channel.on<DuelEvent>(
    REALTIME_LISTEN_TYPES.BROADCAST,
    { event: EVENT },
    (payload) => {
      const evt = payload.payload;
      if (!evt || typeof evt !== "object") return;
      for (const h of eventHandlers) h(evt);
    },
  );

  const syncPeers = () => {
    const state = channel.presenceState<DuelPresence>();
    const peers: DuelPresence[] = [];
    for (const key of Object.keys(state)) {
      const metas = state[key];
      if (metas && metas.length > 0) {
        // Last meta wins (most recent track for this key).
        peers.push(metas[metas.length - 1]);
      }
    }
    lastPeers = peers;
    for (const h of presenceHandlers) h(peers);
  };

  channel.on(REALTIME_LISTEN_TYPES.PRESENCE, { event: "sync" }, syncPeers);
  channel.on(REALTIME_LISTEN_TYPES.PRESENCE, { event: "join" }, syncPeers);
  channel.on(REALTIME_LISTEN_TYPES.PRESENCE, { event: "leave" }, syncPeers);

  const subscribe = () =>
    new Promise<void>((resolve, reject) => {
      if (subscribed) {
        resolve();
        return;
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          // Spectators also announce presence so players see watcher count, but
          // they advertise the spectator seat.
          void channel.track({
            uid,
            name,
            online: true,
            seat,
          } satisfies DuelPresence);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(new Error(`Realtime channel ${status}`));
        }
        // CLOSED happens on teardown — not an error.
      });
    });

  const send = (event: DuelEvent) => {
    // Spectators may only say hello (to request a sync); never play.
    if (seat === "spectator" && event.type !== "hello") return;
    void channel
      .send({ type: "broadcast", event: EVENT, payload: event })
      .catch(() => {
        /* channel closing / offline — best effort */
      });
  };

  const onEvent = (handler: (event: DuelEvent) => void) => {
    eventHandlers.add(handler);
    return () => {
      eventHandlers.delete(handler);
    };
  };

  const onMove = (
    handler: (m: { col: number; ply: number; by: string }) => void,
  ) =>
    onEvent((evt) => {
      if (evt.type === "move") {
        handler({ col: evt.col, ply: evt.ply, by: evt.by });
      }
    });

  const onPresence = (handler: (peers: DuelPresence[]) => void) => {
    presenceHandlers.add(handler);
    // Emit the current snapshot immediately so late subscribers aren't blank.
    if (lastPeers.length > 0) handler(lastPeers);
    return () => {
      presenceHandlers.delete(handler);
    };
  };

  const unsubscribe = async () => {
    eventHandlers.clear();
    presenceHandlers.clear();
    try {
      await channel.untrack();
    } catch {
      /* ignore */
    }
    await client.removeChannel(channel);
    subscribed = false;
  };

  return {
    subscribe,
    send,
    onEvent,
    onMove,
    onPresence,
    peers: () => lastPeers,
    unsubscribe,
  };
}
