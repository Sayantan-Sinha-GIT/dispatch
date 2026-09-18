export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          profile_id: string
          read: boolean
          related_order_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id: string
          read?: boolean
          related_order_id?: string | null
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          read?: boolean
          related_order_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      optimization_runs: {
        Row: {
          algorithm_used: string
          id: string
          run_at: string
          run_by: string
          total_distance_after: number
          total_distance_before: number
        }
        Insert: {
          algorithm_used?: string
          id?: string
          run_at?: string
          run_by: string
          total_distance_after: number
          total_distance_before: number
        }
        Update: {
          algorithm_used?: string
          id?: string
          run_at?: string
          run_by?: string
          total_distance_after?: number
          total_distance_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "optimization_runs_run_by_fkey"
            columns: ["run_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          address: string
          assigned_rider_id: string | null
          created_at: string
          customer_id: string | null
          delivery_fee: number | null
          id: string
          items: Json | null
          lat: number
          lng: number
          offered_at: string | null
          raw_text: string
          sequence_in_route: number | null
          source: string
          status: string
          subtotal: number | null
          time_window_end: string | null
          time_window_start: string | null
          total_amount: number | null
          weight: number
        }
        Insert: {
          accepted_at?: string | null
          address: string
          assigned_rider_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number | null
          id?: string
          items?: Json | null
          lat: number
          lng: number
          offered_at?: string | null
          raw_text: string
          sequence_in_route?: number | null
          source?: string
          status?: string
          subtotal?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          total_amount?: number | null
          weight?: number
        }
        Update: {
          accepted_at?: string | null
          address?: string
          assigned_rider_id?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_fee?: number | null
          id?: string
          items?: Json | null
          lat?: number
          lng?: number
          offered_at?: string | null
          raw_text?: string
          sequence_in_route?: number | null
          source?: string
          status?: string
          subtotal?: number | null
          time_window_end?: string | null
          time_window_start?: string | null
          total_amount?: number | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_rider_id_fkey"
            columns: ["assigned_rider_id"]
            isOneToOne: false
            referencedRelation: "riders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          id: string
          image_gradient: string
          in_stock: boolean
          name: string
          price: number
          unit: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          image_gradient?: string
          in_stock?: boolean
          name: string
          price: number
          unit: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          image_gradient?: string
          in_stock?: boolean
          name?: string
          price?: number
          unit?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          role?: string | null
        }
        Relationships: []
      }
      riders: {
        Row: {
          capacity: number
          consecutive_missed_offers: number
          created_at: string
          current_lat: number | null
          current_lng: number | null
          depot_lat: number
          depot_lng: number
          id: string
          last_active_at: string | null
          location_updated_at: string | null
          profile_id: string
          status: string
          suspended_until: string | null
          total_penalties: number
        }
        Insert: {
          capacity?: number
          consecutive_missed_offers?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          depot_lat: number
          depot_lng: number
          id?: string
          last_active_at?: string | null
          location_updated_at?: string | null
          profile_id: string
          status?: string
          suspended_until?: string | null
          total_penalties?: number
        }
        Update: {
          capacity?: number
          consecutive_missed_offers?: number
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          depot_lat?: number
          depot_lng?: number
          id?: string
          last_active_at?: string | null
          location_updated_at?: string | null
          profile_id?: string
          status?: string
          suspended_until?: string | null
          total_penalties?: number
        }
        Relationships: [
          {
            foreignKeyName: "riders_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order: { Args: { order_id: string }; Returns: undefined }
      current_rider_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      register_missed_offer: {
        Args: {
          p_rider_id: string
          p_suspension_minutes: number
          p_threshold: number
        }
        Returns: {
          missed: number
          penalized: boolean
          profile_id: string
          rider_name: string
          total_penalties: number
        }[]
      }
      set_my_status: { Args: { new_status: string }; Returns: undefined }
      update_my_location: {
        Args: { lat: number; lng: number }
        Returns: undefined
      }
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
    Enums: {},
  },
} as const
