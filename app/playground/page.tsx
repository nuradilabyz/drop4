"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Chip,
  Icon,
  ICON_PATHS,
  Input,
  Logo,
  StatTile,
  ThemeToggle,
} from "@/components/ui";
import type { ButtonVariant, ChipTone } from "@/components/ui";
import { Board } from "@/components/board/Board";
import { BOARD_COACH, BOARD_WIN, BOARD_WIN_LINE } from "@/lib/sampleBoards";
import { createBoard, drop, playerToMove, winningLineForMovelist } from "@/engine/types";
import type { Cells, Movelist } from "@/engine/types";

const BTN_VARIANTS: ButtonVariant[] = ["primary", "secondary", "coral", "outline", "ghost"];
const CHIP_TONES: ChipTone[] = ["neutral", "coral", "aqua", "gold", "success", "danger", "outline"];

export default function Playground() {
  const [cells, setCells] = useState<Cells>(createBoard());
  const [moves, setMoves] = useState<Movelist>([]);

  const next = playerToMove(cells);
  const winLine = winningLineForMovelist(moves);

  const handleDrop = (col: number) => {
    if (winLine) return;
    setCells((c) => drop(c, col, playerToMove(c)));
    setMoves((m) => [...m, col]);
  };
  const reset = () => {
    setCells(createBoard());
    setMoves([]);
  };

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "40px 24px 120px",
        display: "flex",
        flexDirection: "column",
        gap: 40,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Logo size={26} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Chip tone="coral" size="md" icon={<Icon name="spark" size={12} />}>
            Playground
          </Chip>
          <ThemeToggle />
        </div>
      </header>

      <Section title="Buttons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {BTN_VARIANTS.map((v) => (
            <Button key={v} variant={v} icon={<Icon name="play" size={14} />}>
              {v}
            </Button>
          ))}
          <Button variant="primary" loading>
            loading
          </Button>
          <Button variant="secondary" disabled>
            disabled
          </Button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginTop: 12 }}>
          {(["sm", "md", "lg", "xl"] as const).map((s) => (
            <Button key={s} variant="coral" size={s} iconRight={<Icon name="chevR" size={14} />}>
              {s}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Chips">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {CHIP_TONES.map((t) => (
            <Chip key={t} tone={t} size="md">
              {t}
            </Chip>
          ))}
          <Chip tone="gold" size="md" icon={<Icon name="crown" size={12} />}>
            Pro
          </Chip>
          <Chip tone="coral" size="md" icon={<Icon name="bolt" size={12} />}>
            +24 ELO
          </Chip>
        </div>
      </Section>

      <Section title="Cards · Inputs · Stats · Avatars">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name="Tigran D." size={40} ring="var(--coral)" />
              <div>
                <div style={{ fontWeight: 600 }}>Tigran D.</div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>1847 · Almaty</div>
              </div>
            </div>
          </Card>
          <Card>
            <Input
              defaultValue="frosty-otter-19"
              lead={<Icon name="link" size={14} />}
              trailing={<Button size="sm" variant="coral" icon={<Icon name="copy" size={13} />} />}
              readOnly
            />
          </Card>
          <StatTile label="Accuracy" value="91%" sub="+8 vs avg" accent="var(--success)" />
          <StatTile label="ELO" value="1847" sub="+18 this week" accent="var(--coral)" />
        </div>
      </Section>

      <Section title="Icons">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, color: "var(--text-dim)" }}>
          {(Object.keys(ICON_PATHS) as Array<keyof typeof ICON_PATHS>).map((n) => (
            <span key={n} title={n} style={{ display: "inline-flex" }}>
              <Icon name={n} size={18} />
            </span>
          ))}
        </div>
      </Section>

      <Section title="Board — interactive (click a column)">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Board
              cells={cells}
              size="md"
              nextPlayer={next}
              winLine={winLine}
              onDrop={handleDrop}
              showColLabels
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Button variant="outline" size="sm" icon={<Icon name="refresh" size={13} />} onClick={reset}>
                Reset
              </Button>
              <span style={{ fontSize: 13, color: "var(--text-dim)" }} className="mono">
                {winLine ? `${next === "c" ? "Aqua" : "Coral"} won` : `${next === "c" ? "Coral" : "Aqua"} to move`} · {moves.length} moves
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-mute)" }}>
              Win glow (sm)
            </span>
            <Board cells={BOARD_WIN} size="sm" winLine={BOARD_WIN_LINE} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--text-mute)" }}>
              Analysis (ghosting + threats)
            </span>
            <Board cells={BOARD_COACH} size="sm" ghosting threats={[[2, 1]]} />
          </div>
        </div>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: -0.4 }}>{title}</h2>
      {children}
    </section>
  );
}
