import { describe, it, expect } from "vitest";
import { createBoard, drop, playerToMove } from "@/engine/types";

/**
 * Regression suite for `playerToMove`. The original implementation hard-coded
 * coral as the opener, which silently broke aqua-started games (e.g. solo
 * rematch alternation) — after the AI's opening move the hook's `current`
 * derivation still pointed at aqua, so the human's column clicks were
 * disabled while the AI's turn-clock kept ticking. This test pins down the
 * starter-aware contract so that regression can't return.
 */
describe("playerToMove", () => {
  it("defaults to coral starting (legacy contract for engine callers)", () => {
    expect(playerToMove(createBoard())).toBe("c");
  });

  it("alternates correctly for coral-started games", () => {
    let cells = createBoard();
    expect(playerToMove(cells, "c")).toBe("c"); // move 1
    cells = drop(cells, 3, "c");
    expect(playerToMove(cells, "c")).toBe("a"); // move 2
    cells = drop(cells, 4, "a");
    expect(playerToMove(cells, "c")).toBe("c"); // move 3
    cells = drop(cells, 3, "c");
    expect(playerToMove(cells, "c")).toBe("a"); // move 4
  });

  it("alternates correctly for aqua-started games", () => {
    let cells = createBoard();
    // Move 1: aqua opens.
    expect(playerToMove(cells, "a")).toBe("a");
    cells = drop(cells, 3, "a");
    // Move 2: coral replies. The legacy implementation returned "a" here
    // (count=1 → "a" regardless of starter), which locked the board for the
    // human in solo rematches.
    expect(playerToMove(cells, "a")).toBe("c");
    cells = drop(cells, 4, "c");
    // Move 3: aqua again.
    expect(playerToMove(cells, "a")).toBe("a");
    cells = drop(cells, 3, "a");
    // Move 4: coral.
    expect(playerToMove(cells, "a")).toBe("c");
  });
});
