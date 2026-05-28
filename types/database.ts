/**
 * Supabase schema types for the Drop4 backend.
 *
 * The `Database` interface and the `Tables<>` / `TablesInsert<>` / `TablesUpdate<>`
 * helpers are GENERATED from the live hosted Postgres schema via the Supabase
 * MCP server (`generate_typescript_types`). The convenience aliases at the
 * bottom (Profile, MatchInsert, LeaderboardRow, …) layer on narrower types where
 * the generated output loses CHECK-constraint precision (e.g. `result string`
 * instead of `"p1" | "p2" | "draw"`).
 *
 * Regenerate by re-running the MCP tool against the hosted project after any
 * migration; then re-apply the convenience layer at the bottom.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      coach_analyses: {
        Row: {
          analysis: Json | null;
          created_at: string;
          match_id: string;
          version: number;
        };
        Insert: {
          analysis?: Json | null;
          created_at?: string;
          match_id: string;
          version?: number;
        };
        Update: {
          analysis?: Json | null;
          created_at?: string;
          match_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "coach_analyses_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: true;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      daily_puzzles: {
        Row: {
          cells: Json | null;
          date: string;
          puzzle_number: number | null;
          solution: number[] | null;
          solved_count: number;
          theme: string | null;
          to_move: string | null;
        };
        Insert: {
          cells?: Json | null;
          date: string;
          puzzle_number?: number | null;
          solution?: number[] | null;
          solved_count?: number;
          theme?: string | null;
          to_move?: string | null;
        };
        Update: {
          cells?: Json | null;
          date?: string;
          puzzle_number?: number | null;
          solution?: number[] | null;
          solved_count?: number;
          theme?: string | null;
          to_move?: string | null;
        };
        Relationships: [];
      };
      duel_rooms: {
        Row: {
          created_at: string;
          guest_id: string | null;
          host_id: string | null;
          last_activity_at: string;
          match_id: string | null;
          slug: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          guest_id?: string | null;
          host_id?: string | null;
          last_activity_at?: string;
          match_id?: string | null;
          slug: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          guest_id?: string | null;
          host_id?: string | null;
          last_activity_at?: string;
          match_id?: string | null;
          slug?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duel_rooms_match_id_fkey";
            columns: ["match_id"];
            isOneToOne: false;
            referencedRelation: "matches";
            referencedColumns: ["id"];
          },
        ];
      };
      elo_snapshots: {
        Row: {
          city: string | null;
          delta: number;
          elo: number;
          period_start: string;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          delta?: number;
          elo: number;
          period_start: string;
          user_id: string;
        };
        Update: {
          city?: string | null;
          delta?: number;
          elo?: number;
          period_start?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          ai_difficulty: string | null;
          created_at: string;
          duration_ms: number | null;
          elo_delta: number | null;
          ended_at: string | null;
          id: string;
          mode: string;
          movelist: number[] | null;
          player1_id: string | null;
          player2_id: string | null;
          result: string | null;
          series: Json | null;
          think_ms: number[] | null;
          winner_id: string | null;
        };
        Insert: {
          ai_difficulty?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          elo_delta?: number | null;
          ended_at?: string | null;
          id?: string;
          mode: string;
          movelist?: number[] | null;
          player1_id?: string | null;
          player2_id?: string | null;
          result?: string | null;
          series?: Json | null;
          think_ms?: number[] | null;
          winner_id?: string | null;
        };
        Update: {
          ai_difficulty?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          elo_delta?: number | null;
          ended_at?: string | null;
          id?: string;
          mode?: string;
          movelist?: number[] | null;
          player1_id?: string | null;
          player2_id?: string | null;
          result?: string | null;
          series?: Json | null;
          think_ms?: number[] | null;
          winner_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avg_game_ms: number | null;
          best_streak: number;
          city: string | null;
          created_at: string;
          display_name: string | null;
          draws: number;
          elo: number;
          favorite_col: number | null;
          games: number;
          id: string;
          is_pro: boolean;
          losses: number;
          pro_tier: string | null;
          streak: number;
          username: string;
          wins: number;
        };
        Insert: {
          avg_game_ms?: number | null;
          best_streak?: number;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          draws?: number;
          elo?: number;
          favorite_col?: number | null;
          games?: number;
          id: string;
          is_pro?: boolean;
          losses?: number;
          pro_tier?: string | null;
          streak?: number;
          username: string;
          wins?: number;
        };
        Update: {
          avg_game_ms?: number | null;
          best_streak?: number;
          city?: string | null;
          created_at?: string;
          display_name?: string | null;
          draws?: number;
          elo?: number;
          favorite_col?: number | null;
          games?: number;
          id?: string;
          is_pro?: boolean;
          losses?: number;
          pro_tier?: string | null;
          streak?: number;
          username?: string;
          wins?: number;
        };
        Relationships: [];
      };
      puzzle_solves: {
        Row: {
          attempts: number;
          date: string;
          ms: number | null;
          solved: boolean;
          user_id: string;
        };
        Insert: {
          attempts?: number;
          date: string;
          ms?: number | null;
          solved?: boolean;
          user_id: string;
        };
        Update: {
          attempts?: number;
          date?: string;
          ms?: number | null;
          solved?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "puzzle_solves_date_fkey";
            columns: ["date"];
            isOneToOne: false;
            referencedRelation: "daily_puzzles";
            referencedColumns: ["date"];
          },
        ];
      };
      subscriptions: {
        Row: {
          current_period_end: string | null;
          status: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          tier: string | null;
          user_id: string;
        };
        Insert: {
          current_period_end?: string | null;
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string | null;
          user_id: string;
        };
        Update: {
          current_period_end?: string | null;
          status?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          tier?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      leaderboard: {
        // The MCP generator infers function args as non-null; in practice
        // p_city accepts null (default in the SQL fn signature). Keep both
        // shapes ergonomic for callers.
        Args: { p_city?: string | null; p_period?: string };
        // The MCP generator infers the row columns as non-null, but the SELECT
        // pulls nullable profile columns (city, display_name) verbatim. We
        // narrow to LeaderboardRow below for the actual call sites.
        Returns: LeaderboardRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ── Helper utility types (mirror @supabase generator output) ───────────
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[T] extends {
  Row: infer R;
}
  ? R
  : never;

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never;

// ── CHECK-constraint narrowed unions (lost by the MCP generator) ───────
export type MatchMode = "solo" | "duel" | "ranked" | "puzzle";
export type MatchResult = "p1" | "p2" | "draw";
export type DuelStatus = "open" | "active" | "closed";

// ── Convenience row aliases (used across the app) ──────────────────────
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
