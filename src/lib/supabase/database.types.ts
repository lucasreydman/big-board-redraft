// Minimal hand-written database types. Regenerate with the Supabase CLI
// (`supabase gen types typescript`) if you want the full set.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          nba_person_id: number | null;
          bbref_slug: string | null;
          name: string;
          draft_year: number;
          overall_pick: number;
          round_number: number | null;
          team: string | null;
          college: string | null;
          headshot_url: string | null;
          hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["players"]["Row"]> & {
          name: string;
          draft_year: number;
          overall_pick: number;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Row"]>;
        Relationships: [];
      };
      career_stats: {
        Row: {
          player_id: string;
          gp: number | null;
          mpg: number | null;
          ppg: number | null;
          rpg: number | null;
          apg: number | null;
          spg: number | null;
          bpg: number | null;
          fg_pct: number | null;
          fg3_pct: number | null;
          ft_pct: number | null;
          ts_pct: number | null;
          ws: number | null;
          ws48: number | null;
          bpm: number | null;
          vorp: number | null;
          seasons: number | null;
          updated_at: string;
        };
        Insert: { player_id: string } & Partial<
          Database["public"]["Tables"]["career_stats"]["Row"]
        >;
        Update: Partial<Database["public"]["Tables"]["career_stats"]["Row"]>;
        Relationships: [];
      };
      prospects: {
        Row: {
          id: string;
          name: string;
          school: string | null;
          class_year: string | null;
          position: string | null;
          height: string | null;
          weight: number | null;
          age: number | null;
          ppg: number | null;
          rpg: number | null;
          apg: number | null;
          fg_pct: number | null;
          fg3_pct: number | null;
          ft_pct: number | null;
          espn_id: string | null;
          headshot_url: string | null;
          projected_range: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["prospects"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["prospects"]["Row"]>;
        Relationships: [];
      };
      redrafts: {
        Row: {
          id: string;
          user_id: string;
          draft_year: number;
          ordered_player_ids: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          draft_year: number;
          ordered_player_ids: string[];
        };
        Update: Partial<Database["public"]["Tables"]["redrafts"]["Row"]>;
        Relationships: [];
      };
      big_boards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          ordered_prospect_ids: string[];
          tiers: { position: number; label: string }[];
          notes: Record<string, string>;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          name?: string;
          ordered_prospect_ids?: string[];
          tiers?: { position: number; label: string }[];
          notes?: Record<string, string>;
        };
        Update: Partial<Database["public"]["Tables"]["big_boards"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
