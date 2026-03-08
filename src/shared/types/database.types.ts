export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          country: string;
          currency: string;
          settings: Json;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          country?: string;
          currency?: string;
          settings?: Json;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          country?: string;
          currency?: string;
          settings?: Json;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          avatar_url: string | null;
          phone: string | null;
          role: string;
          org_id: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          avatar_url?: string | null;
          phone?: string | null;
          role?: string;
          org_id: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          avatar_url?: string | null;
          phone?: string | null;
          role?: string;
          org_id?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      farms: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          location: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          location?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      pools: {
        Row: {
          id: string;
          org_id: string;
          farm_id: string;
          name: string;
          code: string | null;
          pool_type: "crianza" | "reproductor";
          capacity: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          farm_id: string;
          name: string;
          code?: string | null;
          pool_type: "crianza" | "reproductor";
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          farm_id?: string;
          name?: string;
          code?: string | null;
          pool_type?: "crianza" | "reproductor";
          capacity?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      incubators: {
        Row: {
          id: string;
          org_id: string;
          farm_id: string;
          name: string;
          capacity: number | null;
          temp_min: number | null;
          temp_max: number | null;
          humidity_min: number | null;
          humidity_max: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          farm_id: string;
          name: string;
          capacity?: number | null;
          temp_min?: number | null;
          temp_max?: number | null;
          humidity_min?: number | null;
          humidity_max?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          farm_id?: string;
          name?: string;
          capacity?: number | null;
          temp_min?: number | null;
          temp_max?: number | null;
          humidity_min?: number | null;
          humidity_max?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      food_types: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          unit: string;
          is_default: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          unit?: string;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          unit?: string;
          is_default?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_farm_assignments: {
        Row: {
          id: string;
          user_id: string;
          farm_id: string;
          assigned_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          farm_id: string;
          assigned_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          farm_id?: string;
          assigned_at?: string;
        };
      };
      invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: string;
          farm_ids: string[];
          invited_by: string;
          token: string;
          status: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role?: string;
          farm_ids?: string[];
          invited_by: string;
          token: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: string;
          farm_ids?: string[];
          invited_by?: string;
          token?: string;
          status?: string;
          expires_at?: string;
          created_at?: string;
        };
      };
    };
    Enums: {
      pool_type: "crianza" | "reproductor";
    };
  };
};
