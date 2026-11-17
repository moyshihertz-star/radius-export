export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      agent_runs: {
        Row: {
          id: number;
          org_id: string;
          ran_at: string;
          summary: Json | null;
        };
        Insert: {
          id?: number;
          org_id: string;
          ran_at?: string;
          summary?: Json | null;
        };
        Update: {
          id?: number;
          org_id?: string;
          ran_at?: string;
          summary?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "agent_runs_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          change_id: string | null;
          created_at: string;
          details: Json;
          id: string;
          org_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          change_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
          org_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          change_id?: string | null;
          created_at?: string;
          details?: Json;
          id?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_change_id_fkey";
            columns: ["change_id"];
            isOneToOne: false;
            referencedRelation: "changes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      changes: {
        Row: {
          author: string;
          breakdown: Json;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          new_access_resource_id: string | null;
          org_id: string;
          scope_broadened: boolean;
          score: number | null;
          source: string;
          status: Database["public"]["Enums"]["change_status"];
          target_resource_id: string;
          title: string;
          verdict: Database["public"]["Enums"]["verdict_level"] | null;
        };
        Insert: {
          author?: string;
          breakdown?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          new_access_resource_id?: string | null;
          org_id: string;
          scope_broadened?: boolean;
          score?: number | null;
          source?: string;
          status?: Database["public"]["Enums"]["change_status"];
          target_resource_id: string;
          title: string;
          verdict?: Database["public"]["Enums"]["verdict_level"] | null;
        };
        Update: {
          author?: string;
          breakdown?: Json;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          new_access_resource_id?: string | null;
          org_id?: string;
          scope_broadened?: boolean;
          score?: number | null;
          source?: string;
          status?: Database["public"]["Enums"]["change_status"];
          target_resource_id?: string;
          title?: string;
          verdict?: Database["public"]["Enums"]["verdict_level"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "changes_new_access_resource_id_fkey";
            columns: ["new_access_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "changes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "changes_target_resource_id_fkey";
            columns: ["target_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      edges: {
        Row: {
          created_at: string;
          from_resource_id: string;
          id: string;
          org_id: string;
          to_resource_id: string;
        };
        Insert: {
          created_at?: string;
          from_resource_id: string;
          id?: string;
          org_id: string;
          to_resource_id: string;
        };
        Update: {
          created_at?: string;
          from_resource_id?: string;
          id?: string;
          org_id?: string;
          to_resource_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edges_from_resource_id_fkey";
            columns: ["from_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edges_to_resource_id_fkey";
            columns: ["to_resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      hypotheses: {
        Row: {
          created_at: string;
          expires_at: string;
          file: string;
          granted_actions: string[];
          granted_resources: string[];
          id: string;
          keep_reason: string | null;
          label: string | null;
          last_checked_at: string | null;
          org_id: string;
          reduced: Json | null;
          reduced_at: string | null;
          reduction_pr_url: string | null;
          role_arn: string;
          sid: string;
          status: string;
          used: Json;
          verdict: string | null;
          window_days: number;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          file: string;
          granted_actions?: string[];
          granted_resources?: string[];
          id: string;
          keep_reason?: string | null;
          label?: string | null;
          last_checked_at?: string | null;
          org_id: string;
          reduced?: Json | null;
          reduced_at?: string | null;
          reduction_pr_url?: string | null;
          role_arn: string;
          sid: string;
          status?: string;
          used?: Json;
          verdict?: string | null;
          window_days?: number;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          file?: string;
          granted_actions?: string[];
          granted_resources?: string[];
          id?: string;
          keep_reason?: string | null;
          label?: string | null;
          last_checked_at?: string | null;
          org_id?: string;
          reduced?: Json | null;
          reduced_at?: string | null;
          reduction_pr_url?: string | null;
          role_arn?: string;
          sid?: string;
          status?: string;
          used?: Json;
          verdict?: string | null;
          window_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "hypotheses_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          ingest_key: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          ingest_key?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          ingest_key?: string;
          name?: string;
        };
        Relationships: [];
      };
      policy_weights: {
        Row: {
          compliance_bonus: number;
          org_id: string;
          scope_bonus: number;
          sens_high_weight: number;
          sens_low_weight: number;
          sens_medium_weight: number;
          threshold: number;
          updated_at: string;
        };
        Insert: {
          compliance_bonus?: number;
          org_id: string;
          scope_bonus?: number;
          sens_high_weight?: number;
          sens_low_weight?: number;
          sens_medium_weight?: number;
          threshold?: number;
          updated_at?: string;
        };
        Update: {
          compliance_bonus?: number;
          org_id?: string;
          scope_bonus?: number;
          sens_high_weight?: number;
          sens_low_weight?: number;
          sens_medium_weight?: number;
          threshold?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "policy_weights_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          org_id: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          org_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          org_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          created_at: string;
          id: string;
          key: string;
          name: string;
          org_id: string;
          sensitivity: Database["public"]["Enums"]["sensitivity_level"];
          tags: string[];
          type: Database["public"]["Enums"]["resource_type"];
          x: number;
          y: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          key: string;
          name: string;
          org_id: string;
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"];
          tags?: string[];
          type?: Database["public"]["Enums"]["resource_type"];
          x?: number;
          y?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          key?: string;
          name?: string;
          org_id?: string;
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"];
          tags?: string[];
          type?: Database["public"]["Enums"]["resource_type"];
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "resources_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_org_id: { Args: never; Returns: string };
      seed_demo_hypotheses: { Args: { v_org: string }; Returns: undefined };
    };
    Enums: {
      change_status: "pending" | "approved" | "blocked";
      resource_type: "service" | "role" | "database" | "storage" | "external";
      sensitivity_level: "high" | "medium" | "low";
      verdict_level: "high" | "medium" | "low";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      change_status: ["pending", "approved", "blocked"],
      resource_type: ["service", "role", "database", "storage", "external"],
      sensitivity_level: ["high", "medium", "low"],
      verdict_level: ["high", "medium", "low"],
    },
  },
} as const;
