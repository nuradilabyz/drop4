import type { Cells, Coord } from "@/engine/types";

/** Mid-game position with a coral diagonal building (landing hero). */
export const BOARD_HERO: Cells = (() => {
  const b: Cells = Array.from({ length: 7 }, () => []);
  const drop = (c: number, p: "c" | "a") => b[c].push(p);
  drop(3, "c"); drop(3, "a"); drop(3, "c");
  drop(2, "a"); drop(4, "c"); drop(4, "a"); drop(4, "c");
  drop(5, "a"); drop(2, "c"); drop(1, "a");
  return b;
})();

/** Bottom-left → top-right coral diagonal win. */
export const BOARD_WIN: Cells = [
  ["c"],
  ["a", "c"],
  ["a", "a", "c"],
  ["a", "c", "a", "c"],
  ["c"],
  [],
  [],
];
export const BOARD_WIN_LINE: Coord[] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
];

/** Analysis-screen position. */
export const BOARD_COACH: Cells = [
  [],
  ["a"],
  ["c", "a"],
  ["c", "c", "a"],
  ["a", "c"],
  ["a"],
  [],
];
