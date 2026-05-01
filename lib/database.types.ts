export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      markets: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          market_type: "binary" | "categorical" | "multi";
          liquidity_b: number;
          status: string;
          fees_collected: number;
          created_by: string;
          resolves_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          category: string;
          market_type?: "binary" | "categorical" | "multi";
          liquidity_b: number;
          status?: string;
          fees_collected?: number;
          created_by: string;
          resolves_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: string;
          market_type?: "binary" | "categorical" | "multi";
          liquidity_b?: number;
          status?: string;
          fees_collected?: number;
          created_by?: string;
          resolves_at?: string;
          created_at?: string;
        };
      };
      outcomes: {
        Row: {
          id: string;
          market_id: string;
          label: string;
          sort_order: number;
          q_yes: number;
          q_no: number;
          resolution: "yes" | "no" | "invalid" | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          market_id: string;
          label: string;
          sort_order?: number;
          q_yes?: number;
          q_no?: number;
          resolution?: "yes" | "no" | "invalid" | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          market_id?: string;
          label?: string;
          sort_order?: number;
          q_yes?: number;
          q_no?: number;
          resolution?: "yes" | "no" | "invalid" | null;
          resolved_at?: string | null;
          created_at?: string;
        };
      };
      trades: {
        Row: {
          id: string;
          user_id: string;
          market_id: string;
          outcome_id: string;
          side: "yes" | "no";
          shares: number;
          gross_cost: number;
          fee: number;
          total_cost: number;
          price_after: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          market_id: string;
          outcome_id: string;
          side: "yes" | "no";
          shares: number;
          gross_cost: number;
          fee: number;
          total_cost: number;
          price_after: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          market_id?: string;
          outcome_id?: string;
          side?: "yes" | "no";
          shares?: number;
          gross_cost?: number;
          fee?: number;
          total_cost?: number;
          price_after?: number;
          created_at?: string;
        };
      };
      positions: {
        Row: {
          id: string;
          user_id: string;
          outcome_id: string;
          yes_shares: number;
          no_shares: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          outcome_id: string;
          yes_shares?: number;
          no_shares?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          outcome_id?: string;
          yes_shares?: number;
          no_shares?: number;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          balance: number;
          is_admin: boolean;
        };
        Insert: {
          id: string;
          username?: string | null;
          balance?: number;
          is_admin?: boolean;
        };
        Update: {
          id?: string;
          username?: string | null;
          balance?: number;
          is_admin?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
