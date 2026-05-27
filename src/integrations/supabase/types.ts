export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      auto_reply_rules: {
        Row: {
          created_at: string
          id: string
          instance_id: string | null
          is_active: boolean
          match_type: string
          response: string
          times_triggered: number
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          match_type?: string
          response: string
          times_triggered?: number
          trigger: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string | null
          is_active?: boolean
          match_type?: string
          response?: string
          times_triggered?: number
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_reply_rules_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          failed_count: number
          id: string
          instance_id: string | null
          interval_seconds: number
          message: string
          name: string
          numbers: Json
          scheduled_at: string | null
          sent_count: number
          status: string
          total_numbers: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          id?: string
          instance_id?: string | null
          interval_seconds?: number
          message: string
          name: string
          numbers?: Json
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          total_numbers?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          id?: string
          instance_id?: string | null
          interval_seconds?: number
          message?: string
          name?: string
          numbers?: Json
          scheduled_at?: string | null
          sent_count?: number
          status?: string
          total_numbers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_history: {
        Row: {
          extracted_at: string
          group_id: string | null
          group_name: string
          id: string
          instance_id: string | null
          member_count: number
          status: string
        }
        Insert: {
          extracted_at?: string
          group_id?: string | null
          group_name: string
          id?: string
          instance_id?: string | null
          member_count?: number
          status?: string
        }
        Update: {
          extracted_at?: string
          group_id?: string | null
          group_name?: string
          id?: string
          instance_id?: string | null
          member_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extraction_history_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          extracted_at: string
          group_id: string
          id: string
          instance_id: string
          is_admin: boolean
          is_lid: boolean
          lid_raw_id: string | null
          phone_number: string
          push_name: string | null
        }
        Insert: {
          extracted_at?: string
          group_id: string
          id?: string
          instance_id: string
          is_admin?: boolean
          is_lid?: boolean
          lid_raw_id?: string | null
          phone_number: string
          push_name?: string | null
        }
        Update: {
          extracted_at?: string
          group_id?: string
          id?: string
          instance_id?: string
          is_admin?: boolean
          is_lid?: boolean
          lid_raw_id?: string | null
          phone_number?: string
          push_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      group_searches: {
        Row: {
          dorks_generated: Json | null
          id: string
          instance_id: string | null
          query: string
          results_count: number
          searched_at: string
        }
        Insert: {
          dorks_generated?: Json | null
          id?: string
          instance_id?: string | null
          query: string
          results_count?: number
          searched_at?: string
        }
        Update: {
          dorks_generated?: Json | null
          id?: string
          instance_id?: string | null
          query?: string
          results_count?: number
          searched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_searches_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          age: number | null
          city: string | null
          created_at: string
          gender: string | null
          id: string
          name: string | null
          notes: string | null
          phone_number: string
          source: string
          state: string | null
          tags: string[] | null
        }
        Insert: {
          age?: number | null
          city?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone_number: string
          source?: string
          state?: string | null
          tags?: string[] | null
        }
        Update: {
          age?: number | null
          city?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone_number?: string
          source?: string
          state?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      member_add_jobs: {
        Row: {
          added_count: number
          created_at: string
          failed_count: number
          finished_at: string | null
          group_id: string | null
          group_name: string | null
          id: string
          instance_id: string | null
          lead_ids: Json
          log: Json
          risk_level: string
          status: string
          target_count: number
        }
        Insert: {
          added_count?: number
          created_at?: string
          failed_count?: number
          finished_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          instance_id?: string | null
          lead_ids?: Json
          log?: Json
          risk_level?: string
          status?: string
          target_count?: number
        }
        Update: {
          added_count?: number
          created_at?: string
          failed_count?: number
          finished_at?: string | null
          group_id?: string | null
          group_name?: string | null
          id?: string
          instance_id?: string | null
          lead_ids?: Json
          log?: Json
          risk_level?: string
          status?: string
          target_count?: number
        }
        Relationships: []
      }
      memory_notes: {
        Row: {
          category: string
          color: string
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          color?: string
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      number_filters: {
        Row: {
          filtered_at: string
          id: string
          instance_id: string | null
          invalid_count: number
          total_checked: number
          valid_count: number
        }
        Insert: {
          filtered_at?: string
          id?: string
          instance_id?: string | null
          invalid_count?: number
          total_checked?: number
          valid_count?: number
        }
        Update: {
          filtered_at?: string
          id?: string
          instance_id?: string | null
          invalid_count?: number
          total_checked?: number
          valid_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "number_filters_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      number_warmers: {
        Row: {
          created_at: string
          current_day: number
          id: string
          instance_id: string
          messages_per_day: number
          messages_sent: number
          status: string
          total_days: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_day?: number
          id?: string
          instance_id: string
          messages_per_day?: number
          messages_sent?: number
          status?: string
          total_days?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_day?: number
          id?: string
          instance_id?: string
          messages_per_day?: number
          messages_sent?: number
          status?: string
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "number_warmers_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      validated_invites: {
        Row: {
          code: string
          description: string | null
          image: string | null
          last_checked_at: string
          status: string
          title: string | null
        }
        Insert: {
          code: string
          description?: string | null
          image?: string | null
          last_checked_at?: string
          status: string
          title?: string | null
        }
        Update: {
          code?: string
          description?: string | null
          image?: string | null
          last_checked_at?: string
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          description: string | null
          fetched_at: string
          group_jid: string
          id: string
          instance_id: string
          is_admin: boolean
          member_count: number
          member_goal: number | null
          name: string
        }
        Insert: {
          description?: string | null
          fetched_at?: string
          group_jid: string
          id?: string
          instance_id: string
          is_admin?: boolean
          member_count?: number
          member_goal?: number | null
          name: string
        }
        Update: {
          description?: string | null
          fetched_at?: string
          group_jid?: string
          id?: string
          instance_id?: string
          is_admin?: boolean
          member_count?: number
          member_goal?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          id: string
          name: string
          phone_number: string | null
          session_data: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
