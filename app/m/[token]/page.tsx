/**
 * Public match-card landing page — `/m/<token>`.
 *
 * `<token>` is the base64url-encoded OG query (built by `lib/share.encodeShareToken`).
 * The page decodes it into a `ShareCard`, renders the final board + result + a
 * "Play Drop4" CTA, and — crucially — sets `generateMetadata.openGraph.images`
 * to the matching `/api/og?...` URL so the link unfurls as a rich card on
 * social. Both `params` and the card decode are robust to junk tokens.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import {
  fromMovelist,
  winningLineForMovelist,
  type Cells,
  type Coord,
} from "@/engine/types";
import {
  decodeShareToken,
  shareQuery,
  type ShareCard,
} from "@/lib/share";
import { Board } from "@/components/board/Board";
import styles from "./matchcard.module.css";

interface Props {
  params: Promise<{ token: string }>;
}

/** Decode the token; fall back to a neutral empty card so we never 404. */
function cardFor(token: string): ShareCard {
  return (
    decodeShareToken(token) ?? {
      movelist: [],
      result: "draw",
      p1: "Coral",
      p2: "Aqua",
    }
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const card = cardFor(token);
  const og = `/api/og?${shareQuery(card)}`;

  const draw = card.result === "draw";
  const winner = card.result === "a" ? card.p2 : card.p1;
  const title = draw
    ? `${card.p1} vs ${card.p2} — Draw`
    : `${winner} won on Drop4`;
  const description = `${card.p1} vs ${card.p2}${card.mode ? ` · ${card.mode}` : ""} — replay this Connect Four match on Drop4.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: og, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [og],
    },
  };
}

/** Safe board from a movelist (replays as far as legal). */
function safeCells(movelist: number[]): Cells {
  try {
    return fromMovelist(movelist);
  } catch {
    return [];
  }
}

const DIRECTION_LABEL: Record<string, string> = {
  "1,1": "the diagonal",
  "1,-1": "the diagonal",
};
function describeLine(line: Coord[] | null): string {
  if (!line || line.length < 2) return "the board";
  const [c0, r0] = line[0];
  const [c1, r1] = line[1];
  const dc = Math.sign(c1 - c0);
  const dr = Math.sign(r1 - r0);
  if (dc === 0) return `column ${c0 + 1}`;
  if (dr === 0) return `row ${r0 + 1}`;
  return DIRECTION_LABEL[`${dc},${dr}`] ?? "the diagonal";
}

export default async function MatchCardPage({ params }: Props) {
  const { token } = await params;
  const card = cardFor(token);
  const cells = safeCells(card.movelist);
  const line = winningLineForMovelist(card.movelist);

  const draw = card.result === "draw";
  const winner = card.result === "a" ? card.p2 : card.p1;
  const winnerChip = card.result === "a" ? "a" : "c";
  const headline = draw
    ? "Draw — the board filled up"
    : `${winner} won — 4 on ${describeLine(line)}`;

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <section className={styles.card}>
          <div className={styles.info}>
            {card.mode ? (
              <span className={styles.kicker}>{card.mode}</span>
            ) : (
              <span className={styles.kicker}>Match</span>
            )}
            <h1 className={styles.headline}>{headline}</h1>

            <div className={styles.versus}>
              <span className={styles.player}>
                <span className={`${styles.dot} ${styles.coral}`} />
                {card.p1}
              </span>
              <span className={styles.vs}>vs</span>
              <span className={styles.player}>
                <span className={`${styles.dot} ${styles.aqua}`} />
                {card.p2}
              </span>
            </div>

            <div className={styles.stats}>
              {card.elo ? (
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Elo</span>
                  <span className={`${styles.statValue} mono`}>{card.elo}</span>
                </span>
              ) : null}
              {typeof card.acc === "number" ? (
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Accuracy</span>
                  <span className={`${styles.statValue} mono`}>{card.acc}%</span>
                </span>
              ) : null}
              <span className={styles.stat}>
                <span className={styles.statLabel}>Moves</span>
                <span className={`${styles.statValue} mono`}>
                  {card.movelist.length}
                </span>
              </span>
            </div>

            <div className={styles.cta}>
              <Button variant="primary" size="lg" href="/play">
                Play Drop4
              </Button>
              <Link href="/" className={styles.secondary}>
                What is Drop4?
              </Link>
            </div>
          </div>

          <div className={styles.boardWrap}>
            <Board
              cells={cells}
              size="md"
              winLine={draw ? null : line}
              ghosting={!draw}
              nextPlayer={winnerChip}
              animateDrops={false}
              aria-label="Final board position"
            />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
