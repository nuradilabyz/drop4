/**
 * Shareable match-card OG image — `GET /api/og`.
 *
 * Renders a 1200×630 PNG of a finished Drop4 game: the final board drawn with
 * divs/circles in the Drop4 palette, the wordmark, a result headline derived
 * from `winningLineForMovelist`, and Elo/accuracy chips. Built with the
 * framework's `next/og` (no @vercel/og install).
 *
 * Query contract (all optional — robust defaults):
 *   m    = movelist, columns joined by '-' or ',' (e.g. "3-3-2-4-...").
 *   r    = result: 'c' (coral wins) | 'a' (aqua wins) | 'draw'. Default 'c'.
 *   p1   = player-1 (coral) name.   Default "Coral".
 *   p2   = player-2 (aqua) name.    Default "Aqua".
 *   elo  = signed Elo delta string (e.g. "+24").
 *   acc  = accuracy 0..100.
 *   mode = mode label ("Ranked", "Insane AI"…).
 *
 * Note on color: Satori (the renderer behind next/og) does not reliably support
 * `oklch()`, so we hardcode the sRGB equivalents of the dark-theme palette
 * (see AGENTS.md / globals.css): coral #e0654a, aqua #3fb6c8, gold #d8a93c.
 */

import { ImageResponse } from "next/og";
import {
  COLS,
  ROWS,
  fromMovelist,
  winningLineForMovelist,
  type Cells,
  type Coord,
} from "@/engine/types";
import { parseShareQuery } from "@/lib/share";

export const runtime = "nodejs";

// sRGB equivalents of the dark-theme oklch tokens (Satori-safe).
const C = {
  bg: "#0c0c0e",
  surface: "#141417",
  surface2: "#1b1b1f",
  border: "rgba(255,255,250,0.08)",
  borderStrong: "rgba(255,255,250,0.16)",
  text: "#f5f4ef",
  textDim: "rgba(245,244,239,0.62)",
  textMute: "rgba(245,244,239,0.36)",
  coral: "#e0654a",
  aqua: "#3fb6c8",
  gold: "#d8a93c",
  // Recessed empty hole inside the blue board frame.
  hole: "#0c0c0e",
} as const;

const SIZE = { width: 1200, height: 630 } as const;

/** Build the board cells from a movelist, tolerating an illegal/empty list. */
function safeCells(movelist: number[]): Cells {
  try {
    return fromMovelist(movelist);
  } catch {
    // Replay as far as legal so we still draw something sensible.
    const cells: Cells = Array.from({ length: COLS }, () => []);
    let player: "c" | "a" = "c";
    for (const col of movelist) {
      if (col < 0 || col >= COLS || cells[col].length >= ROWS) break;
      cells[col].push(player);
      player = player === "c" ? "a" : "c";
    }
    return cells;
  }
}

const DIRECTION_LABEL: Record<string, string> = {
  "1,0": "the row",
  "0,1": "the column",
  "1,1": "the diagonal",
  "1,-1": "the diagonal",
};

/** Describe the winning line ("the diagonal", "row 3"…) for the headline. */
function describeLine(line: Coord[] | null): string {
  if (!line || line.length < 2) return "the board";
  const [c0, r0] = line[0];
  const [c1, r1] = line[1];
  const dc = Math.sign(c1 - c0);
  const dr = Math.sign(r1 - r0);
  const key = `${dc},${dr}`;
  if (key === "0,1" || key === "0,-1") {
    return `column ${c0 + 1}`;
  }
  if (key === "1,0" || key === "-1,0") {
    return `row ${r0 + 1}`;
  }
  return DIRECTION_LABEL[key] ?? "the diagonal";
}

export function GET(request: Request): ImageResponse {
  const { searchParams } = new URL(request.url);
  const card = parseShareQuery(searchParams);

  const cells = safeCells(card.movelist);
  const line = winningLineForMovelist(card.movelist);
  const winSet = new Set((line ?? []).map(([c, r]) => `${c}.${r}`));

  const draw = card.result === "draw";
  const winnerColor = card.result === "a" ? C.aqua : C.coral;
  const winnerName = card.result === "a" ? card.p2 : card.p1;
  const headline = draw
    ? "Draw — the board filled up"
    : `${winnerName} won — 4 on ${describeLine(line)}`;

  // Board geometry (drawn with divs; row 0 is the bottom in `cells`).
  const cell = 64; // disc + padding box
  const gap = 8;
  const pad = 16;
  const boardW = COLS * cell + (COLS - 1) * gap + pad * 2;
  const boardH = ROWS * cell + (ROWS - 1) * gap + pad * 2;

  const rows = Array.from({ length: ROWS }, (_, displayRow) => ROWS - 1 - displayRow);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: C.bg,
          color: C.text,
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: 56,
          // Subtle two-tone wash so the card has depth.
          backgroundImage: `radial-gradient(1100px 520px at 78% -10%, ${C.surface2}, ${C.bg})`,
        }}
      >
        {/* Left column: wordmark, headline, chips */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            paddingRight: 48,
          }}
        >
          {/* Wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 44,
                height: 44,
                borderRadius: 12,
                background: C.text,
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", left: 9, top: 24, width: 12, height: 12, borderRadius: 6, background: C.coral }} />
              <div style={{ position: "absolute", left: 23, top: 24, width: 12, height: 12, borderRadius: 6, background: C.aqua }} />
              <div style={{ position: "absolute", left: 16, top: 10, width: 12, height: 12, borderRadius: 6, background: C.bg }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Drop4</span>
              <span style={{ fontSize: 15, color: C.textMute, letterSpacing: 0.2 }}>
                Four in a row. Sharper every drop.
              </span>
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: draw ? C.textMute : winnerColor,
                }}
              />
              <span style={{ fontSize: 18, color: C.textDim, letterSpacing: 0.4, textTransform: "uppercase" }}>
                {card.mode ?? "Match"}
              </span>
            </div>
            <span
              style={{
                fontSize: 54,
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: -1.6,
                maxWidth: 560,
              }}
            >
              {headline}
            </span>

            {/* Versus line */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.text }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: C.coral, display: "flex" }} />
                {card.p1}
              </span>
              <span style={{ color: C.textMute }}>vs</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: C.text }}>
                <span style={{ width: 12, height: 12, borderRadius: 6, background: C.aqua, display: "flex" }} />
                {card.p2}
              </span>
            </div>
          </div>

          {/* Stat chips */}
          <div style={{ display: "flex", gap: 12 }}>
            {card.elo ? <Chip label="Elo" value={card.elo} accent={card.elo.startsWith("-") ? C.coral : C.gold} /> : null}
            {typeof card.acc === "number" ? <Chip label="Accuracy" value={`${card.acc}%`} accent={C.aqua} /> : null}
            <Chip label="Moves" value={String(card.movelist.length)} accent={C.textDim} />
          </div>
        </div>

        {/* Right column: the board */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap,
              padding: pad,
              width: boardW,
              height: boardH,
              borderRadius: 28,
              background: C.surface,
              border: `1px solid ${C.borderStrong}`,
              boxShadow: "0 18px 60px rgba(0,0,0,0.5)",
            }}
          >
            {rows.map((r) => (
              <div key={r} style={{ display: "flex", gap }}>
                {Array.from({ length: COLS }, (_, c) => {
                  const v = cells[c]?.[r] ?? null;
                  const isWin = winSet.has(`${c}.${r}`);
                  const fill = v === "c" ? C.coral : v === "a" ? C.aqua : C.hole;
                  return (
                    <div
                      key={c}
                      style={{
                        display: "flex",
                        width: cell,
                        height: cell,
                        borderRadius: cell / 2,
                        background: fill,
                        // Empty holes are recessed; discs are slightly raised.
                        boxShadow: v
                          ? isWin
                            ? `0 0 0 4px ${C.gold}, inset 0 -6px 10px rgba(0,0,0,0.28)`
                            : "inset 0 -6px 10px rgba(0,0,0,0.28)"
                          : "inset 0 4px 8px rgba(0,0,0,0.55)",
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}

/** A small stat chip (label + mono-ish value). */
function Chip(props: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px",
        borderRadius: 10,
        background: C.surface2,
        border: `1px solid ${C.border}`,
      }}
    >
      <span style={{ fontSize: 15, color: C.textMute }}>{props.label}</span>
      <span style={{ fontSize: 20, fontWeight: 600, color: props.accent }}>{props.value}</span>
    </div>
  );
}
