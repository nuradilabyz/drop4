/**
 * Hand-written Supabase schema types for the Drop4 backend.
 *
 * These mirror `supabase/migrations/*.sql`. They are "good enough" to type the
 * browser/server/admin clients and the query helpers; regenerate with
 * `supabase gen types typescript --local > types/database.ts` once the CLI is
 * wired up, which will also add precise function-return types.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ── Enum-ish unions (Postgres CHECK constraints) ────────────────────
export type MatchMode = "solo" | "duel" | "ranked" | "puzzle";
export type MatchResult = "p1" | "p2" | "draw";
export type DuelStatus = "open" | "active" | "closed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          city: string | null;
          elo: number;
          is_pro: boolean;
          pro_tier: string | null;
          streak: number;
          best_streak: number;
          games: number;
          wins: number;
          losses: number;
          draws: number;
          favorite_col: number | null;
          avg_game_ms: number | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          city?: string | null;
          elo?: number;
          is_pro?: boolean;
          pro_tier?: string | null;
          streak?: number;
          best_streak?: number;
          games?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          favorite_col?: number | null;
          avg_game_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          city?: string | null;
          elo?: number;
          is_pro?: boolean;
          pro_tier?: string | null;
          streak?: number;
          best_streak?: number;
          games?: number;
          wins?: number;
          losses?: number;
          draws?: number;
          favorite_col?: number | null;
          avg_game_ms?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          mode: MatchMode;
          player1_id: string | null;
          player2_id: string | null;
          ai_difficulty: string | null;
          result: MatchResult | null;
          winner_id: string | null;
          elo_delta: number | null;
          movelist: number[] | null;
          think_ms: number[] | null;
          series: Json | null;
          duration_ms: number | null;
          created_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          mode: MatchMode;
          player1_id?: string | null;
          player2_id?: string | null;
          ai_difficulty?: string | null;
          result?: MatchResult | null;
          winner_id?: string | null;
          elo_delta?: number | null;
          movelist?: number[] | null;
          think_ms?: number[] | null;
          series?: Json | null;
          duration_ms?: number | null;
          created_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          mode?: MatchMode;
          player1_id?: string | null;
          player2_id?: string | null;
          ai_difficulty?: string | null;
          result?: MatchResult | null;
          winner_id?: string | null;
          elo_delta?: number | null;
          movelist?: number[] | null;
          think_ms?: number[] | null;
          series?: Json | null;
          duration_ms?: number | null;
          created_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      daily_puzzles: {
        Row: {
          date: string;
          puzzle_number: number | null;
          cells: Json | null;
          to_move: string | null;
          solution: number[] | null;
          theme: string | null;
          solved_count: number;
        };
        Insert: {
          date: string;
          puzzle_number?: number | null;
          cells?: Json | null;
          to_move?: string | null;
          solution?: number[] | null;
          theme?: string | null;
          solved_count?: number;
        };
        Update: {
          date?: string;
          puzzle_number?: number | null;
          cells?: Json | null;
          to_move?: string | null;
          solution?: number[] | null;
          theme?: string | null;
          solved_count?: number;
        };
        Relationships: [];
      };
      puzzle_solves: {
        Row: {
          user_id: string;
          date: string;
          solved: boolean;
          attempts: number;
          ms: number | null;
        };
        Insert: {
          user_id: string;
          date: string;
          solved?: boolean;
          attempts?: number;
          ms?: number | null;
        };
        Update: {
          user_id?: string;
          date?: string;
          solved?: boolean;
          attempts?: number;
          ms?: number | null;
        };
        Relationships: [];
      };
      coach_analyses: {
        Row: {
          match_id: string;
          version: number;
          analysis: Json | null;
          created_at: string;
        };
        Insert: {
          match_id: string;
          version?: number;
          analysis?: Json | null;
          created_at?: string;
        };
        Update: {
          match_id?: string;
          version?: number;
          analysis?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          status: string | null;
          tier: string | null;
          current_period_end: string | null;
        };
        Insert: {
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string | null;
          tier?: string | null;
          current_period_end?: string | null;
        };
        Update: {
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string | null;
          tier?: string | null;
          current_period_end?: string | null;
        };
        Relationships: [];
      };
      duel_rooms: {
        Row: {
          slug: string;
          host_id: string | null;
          guest_id: string | null;
          match_id: string | null;
          status: DuelStatus;
          last_activity_at: string;
          created_at: string;
        };
        Insert: {
          slug: string;
          host_id?: string | null;
          guest_id?: string | null;
          match_id?: string | null;
          status?: DuelStatus;
          last_activity_at?: string;
          created_at?: string;
        };
        Update: {
          slug?: string;
          host_id?: string | null;
          guest_id?: string | null;
          match_id?: string | null;
          status?: DuelStatus;
          last_activity_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      elo_snapshots: {
        Row: {
          user_id: string;
          period_start: string;
          elo: number;
          delta: number;
          city: string | null;
        };
        Insert: {
          user_id: string;
          period_start: string;
          elo: number;
          delta?: number;
          city?: string | null;
        };
        Update: {
          user_id?: string;
          period_start?: string;
          elo?: number;
          delta?: number;
          city?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      leaderboard: {
        Args: { p_city?: string | null; p_period?: string };
        Returns: LeaderboardRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// ── Convenience row aliases ──────────────────────────────────────────
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchInsert = Database["public"]["Tables"]["matches"]["Insert"];
export type MatchUpdate = Database["public"]["Tables"]["matches"]["Update"];

export type DailyPuzzle = Database["public"]["Tables"]["daily_puzzles"]["Row"];
export type PuzzleSolve = Database["public"]["Tables"]["puzzle_solves"]["Row"];
export type CoachAnalysis = Database["public"]["Tables"]["coach_analyses"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type DuelRoom = Database["public"]["Tables"]["duel_rooms"]["Row"];
export type EloSnapshot = Database["public"]["Tables"]["elo_snapshots"]["Row"];

/** Shape returned by the `leaderboard(...)` SECURITY DEFINER function. */
export interface LeaderboardRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  city: string | null;
  elo: number;
  weekly_delta: number;
  wins: number;
  losses: number;
}
