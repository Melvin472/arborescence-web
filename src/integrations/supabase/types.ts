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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: string
          message: string
          subject: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: string
          message: string
          subject: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: string
          message?: string
          subject?: string
          user_id?: string | null
        }
        Relationships: []
      }
      devices: {
        Row: {
          comment: string
          age: string
          brand: string
          category: string | null
          cpu: string
          created_at: string
          disk: string | null
          id: string
          linked_to: string | null
          notes: string
          os: string | null
          owner: string
          owner_id: string | null
          powers_on: boolean
          ram: string | null
          ref: string
          screen_ok: boolean | null
          status: string
          tracking: string
          type: string
        }
        Insert: {
          comment?: string
          age?: string
          brand: string
          category?: string | null
          cpu?: string
          created_at?: string
          disk?: string | null
          id?: string
          linked_to?: string | null
          notes?: string
          os?: string | null
          owner: string
          owner_id?: string | null
          powers_on?: boolean
          ram?: string | null
          ref?: string
          screen_ok?: boolean | null
          status?: string
          tracking: string
          type: string
        }
        Update: {
          comment?: string
          age?: string
          brand?: string
          category?: string | null
          cpu?: string
          created_at?: string
          disk?: string | null
          id?: string
          linked_to?: string | null
          notes?: string
          os?: string | null
          owner?: string
          owner_id?: string | null
          powers_on?: boolean
          ram?: string | null
          ref?: string
          screen_ok?: boolean | null
          status?: string
          tracking?: string
          type?: string
        }
        Relationships: []
      }
      eligibilities: {
        Row: {
          created_at: string
          decided_at: string | null
          decision_message: string
          documents: Json
          id: string
          justif_type: string
          org_name: string | null
          org_type: string | null
          owner: string
          owner_id: string
          participants: number | null
          profile: string
          project: string
          siret: string | null
          siret_verified: boolean
          status: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision_message?: string
          documents?: Json
          id?: string
          justif_type: string
          org_name?: string | null
          org_type?: string | null
          owner: string
          owner_id?: string
          participants?: number | null
          profile: string
          project?: string
          siret?: string | null
          siret_verified?: boolean
          status?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision_message?: string
          documents?: Json
          id?: string
          justif_type?: string
          org_name?: string | null
          org_type?: string | null
          owner?: string
          owner_id?: string
          participants?: number | null
          profile?: string
          project?: string
          siret?: string | null
          siret_verified?: boolean
          status?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          approved: boolean
          author: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          approved?: boolean
          author: string
          created_at?: string
          id?: string
          message: string
          user_id?: string
        }
        Update: {
          approved?: boolean
          author?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          profile: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          name?: string
          profile?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          profile?: string | null
        }
        Relationships: []
      }
      requests: {
        Row: {
          refusal_reason: string | null
          refusal_message: string
          os_pref: string
          category: string | null
          created_at: string
          details: string
          device_ids: string[]
          device_type: string
          id: string
          need: string
          notifications: boolean
          owner: string
          owner_id: string
          profile: string
          quantity: number
          status: string
          tracking: string
        }
        Insert: {
          refusal_reason?: string | null
          refusal_message?: string
          os_pref?: string
          category?: string | null
          created_at?: string
          details?: string
          device_ids?: string[]
          device_type: string
          id?: string
          need?: string
          notifications?: boolean
          owner: string
          owner_id?: string
          profile: string
          quantity?: number
          status?: string
          tracking: string
        }
        Update: {
          refusal_reason?: string | null
          refusal_message?: string
          os_pref?: string
          category?: string | null
          created_at?: string
          details?: string
          device_ids?: string[]
          device_type?: string
          id?: string
          need?: string
          notifications?: boolean
          owner?: string
          owner_id?: string
          profile?: string
          quantity?: number
          status?: string
          tracking?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      device_assigned_to_me: { Args: { _device_id: string }; Returns: boolean }
      is_eligible: { Args: { _uid: string }; Returns: boolean }
      is_member: { Args: { _uid: string }; Returns: boolean }
      public_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "donateur" | "beneficiaire" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["donateur", "beneficiaire", "admin"],
    },
  },
} as const
