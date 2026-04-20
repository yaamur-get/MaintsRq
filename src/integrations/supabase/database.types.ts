 
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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      approval_links: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          beneficiary_phone: string
          created_at: string | null
          expires_at: string
          funding_type: Database["public"]["Enums"]["funding_type"] | null
          id: string
          is_used: boolean | null
          request_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          beneficiary_phone: string
          created_at?: string | null
          expires_at: string
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: string
          is_used?: boolean | null
          request_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          beneficiary_phone?: string
          created_at?: string | null
          expires_at?: string
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: string
          is_used?: boolean | null
          request_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_links_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      contractor_bids: {
        Row: {
          bid_amount: number
          bid_document_url: string | null
          contractor_id: string
          created_at: string | null
          external_report_item_id: string | null
          id: string
          inspection_item_id: string | null
          item_main_name: string | null
          item_sub_name: string | null
          is_selected: boolean | null
          notes: string | null
          quantity: number | null
          request_id: string
          updated_at: string | null
        }
        Insert: {
          bid_amount: number
          bid_document_url?: string | null
          contractor_id: string
          created_at?: string | null
          external_report_item_id?: string | null
          id?: string
          inspection_item_id?: string | null
          item_main_name?: string | null
          item_sub_name?: string | null
          is_selected?: boolean | null
          notes?: string | null
          quantity?: number | null
          request_id: string
          updated_at?: string | null
        }
        Update: {
          bid_amount?: number
          bid_document_url?: string | null
          contractor_id?: string
          created_at?: string | null
          external_report_item_id?: string | null
          id?: string
          inspection_item_id?: string | null
          item_main_name?: string | null
          item_sub_name?: string | null
          is_selected?: boolean | null
          notes?: string | null
          quantity?: number | null
          request_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_bids_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_bids_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          license_number: string | null
          name: string
          phone: string | null
          rating: number | null
          specialization: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name: string
          phone?: string | null
          rating?: number | null
          specialization?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          name?: string
          phone?: string | null
          rating?: number | null
          specialization?: string | null
        }
        Relationships: []
      }
      districts: {
        Row: {
          city_id: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          city_id: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          city_id?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          comments: string | null
          communication_rating: number | null
          created_at: string | null
          id: string
          overall_rating: number | null
          request_id: string
          service_quality_rating: number | null
          timeliness_rating: number | null
        }
        Insert: {
          comments?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          overall_rating?: number | null
          request_id: string
          service_quality_rating?: number | null
          timeliness_rating?: number | null
        }
        Update: {
          comments?: string | null
          communication_rating?: number | null
          created_at?: string | null
          id?: string
          overall_rating?: number | null
          request_id?: string
          service_quality_rating?: number | null
          timeliness_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_pricing: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          estimated_price: number
          external_report_issue_id: string | null
          external_report_item_id: string | null
          id: string
          inspection_item_id: string | null
          item_main_name: string | null
          item_specifications: string | null
          item_sub_name: string | null
          item_unit: string | null
          pricing_notes: string | null
          quantity: number | null
          request_id: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          estimated_price: number
          external_report_issue_id?: string | null
          external_report_item_id?: string | null
          id?: string
          inspection_item_id?: string | null
          item_main_name?: string | null
          item_specifications?: string | null
          item_sub_name?: string | null
          item_unit?: string | null
          pricing_notes?: string | null
          quantity?: number | null
          request_id: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          estimated_price?: number
          external_report_issue_id?: string | null
          external_report_item_id?: string | null
          id?: string
          inspection_item_id?: string | null
          item_main_name?: string | null
          item_specifications?: string | null
          item_sub_name?: string | null
          item_unit?: string | null
          pricing_notes?: string | null
          quantity?: number | null
          request_id?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_pricing_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_pricing_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: true
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_pricing_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      final_reports: {
        Row: {
          additional_notes: string | null
          approved_at: string | null
          approved_by: string | null
          id: string
          report_document_url: string
          request_id: string
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          additional_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          report_document_url: string
          request_id: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          additional_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          report_document_url?: string
          request_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "final_reports_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_reports_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_reports_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_items: {
        Row: {
          approved: boolean | null
          created_at: string | null
          id: string
          main_item: string
          notes: string | null
          request_id: string
          specifications: string | null
          sub_item: string
          updated_at: string | null
        }
        Insert: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          main_item: string
          notes?: string | null
          request_id: string
          specifications?: string | null
          sub_item: string
          updated_at?: string | null
        }
        Update: {
          approved?: boolean | null
          created_at?: string | null
          id?: string
          main_item?: string
          notes?: string | null
          request_id?: string
          specifications?: string | null
          sub_item?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspection_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      item_images: {
        Row: {
          caption: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          inspection_item_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          inspection_item_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          inspection_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_images_inspection_item_id_fkey"
            columns: ["inspection_item_id"]
            isOneToOne: false
            referencedRelation: "inspection_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mosque_addition_requests: {
        Row: {
          city_name: string
          created_at: string | null
          district_name: string | null
          google_maps_link: string
          id: string
          mosque_name: string
          notes: string | null
          requester_name: string
          requester_phone: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          city_name: string
          created_at?: string | null
          district_name?: string | null
          google_maps_link: string
          id?: string
          mosque_name: string
          notes?: string | null
          requester_name: string
          requester_phone: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          city_name?: string
          created_at?: string | null
          district_name?: string | null
          google_maps_link?: string
          id?: string
          mosque_name?: string
          notes?: string | null
          requester_name?: string
          requester_phone?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mosque_addition_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mosques: {
        Row: {
          address: string | null
          capacity: number | null
          city_id: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          district_id: string
          id: string
          imam_name: string | null
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          mosque_number: number
          name: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city_id: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          district_id: string
          id?: string
          imam_name?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mosque_number?: number
          name: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city_id?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          district_id?: string
          id?: string
          imam_name?: string | null
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          mosque_number?: number
          name?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mosques_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mosques_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          request_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          request_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          request_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      request_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: Database["public"]["Enums"]["request_status"]
          notes: string | null
          previous_status: Database["public"]["Enums"]["request_status"] | null
          request_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["request_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["request_status"] | null
          request_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["request_status"]
          notes?: string | null
          previous_status?: Database["public"]["Enums"]["request_status"] | null
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_status_history_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          approved_amount: number | null
          approved_at: string | null
          assigned_pricing_expert_id: string | null
          assigned_technician_id: string | null
          beneficiary_id: string | null
          beneficiary_name: string
          beneficiary_phone: string
          closed_at: string | null
          completed_at: string | null
          created_at: string | null
          current_status: Database["public"]["Enums"]["request_status"] | null
          description: string
          funding_completed: boolean | null
          funding_completed_at: string | null
          funding_channel_data: Json
          funding_completion_phrase: string | null
          funding_type: Database["public"]["Enums"]["funding_type"] | null
          id: string
          mosque_id: string
          requester_role: "imam" | "muezzin" | "mosque_congregation"
          request_type_id: string
          rq_number: string | null
          started_at: string | null
          updated_at: string | null
        }
        Insert: {
          approved_amount?: number | null
          approved_at?: string | null
          assigned_pricing_expert_id?: string | null
          assigned_technician_id?: string | null
          beneficiary_id?: string | null
          beneficiary_name: string
          beneficiary_phone: string
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_status?: Database["public"]["Enums"]["request_status"] | null
          description: string
          funding_completed?: boolean | null
          funding_completed_at?: string | null
          funding_channel_data?: Json
          funding_completion_phrase?: string | null
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: string
          mosque_id: string
          requester_role: "imam" | "muezzin" | "mosque_congregation"
          request_type_id: string
          rq_number?: string | null
          started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_amount?: number | null
          approved_at?: string | null
          assigned_pricing_expert_id?: string | null
          assigned_technician_id?: string | null
          beneficiary_id?: string | null
          beneficiary_name?: string
          beneficiary_phone?: string
          closed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_status?: Database["public"]["Enums"]["request_status"] | null
          description?: string
          funding_completed?: boolean | null
          funding_completed_at?: string | null
          funding_channel_data?: Json
          funding_completion_phrase?: string | null
          funding_type?: Database["public"]["Enums"]["funding_type"] | null
          id?: string
          mosque_id?: string
          requester_role?: "imam" | "muezzin" | "mosque_congregation"
          request_type_id?: string
          rq_number?: string | null
          started_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_pricing_expert_id_fkey"
            columns: ["assigned_pricing_expert_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_mosque_id_fkey"
            columns: ["mosque_id"]
            isOneToOne: false
            referencedRelation: "mosques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
        ]
      }
      status_translations: {
        Row: {
          arabic_label: string
          color_class: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          status_key: string
        }
        Insert: {
          arabic_label: string
          color_class: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          status_key: string
        }
        Update: {
          arabic_label?: string
          color_class?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          status_key?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
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
      assign_user_roles: { Args: never; Returns: undefined }
    }
    Enums: {
      funding_type: "ehsan" | "direct_donor" | "store_opportunity"
      request_status:
        | "pending_review"
        | "accepted_initial"
        | "pending_rejection_approval"
        | "rejected"
        | "approved"
        | "pending_inspection"
        | "pending_inspection_approval"
        | "pending_expert_pricing"
        | "pending_pricing_approval"
        | "pending_beneficiary_approval"
        | "beneficiary_approved_pricing"
        | "pending_funding"
        | "pending_contractor_bids"
        | "pending_contractor_selection"
        | "pending_final_approval"
        | "in_progress"
        | "pending_final_report"
        | "pending_closure"
        | "closed"
        | "cancelled"
      user_role:
        | "beneficiary"
        | "customer_service"
        | "project_manager"
        | "technician"
        | "pricing_expert"
        | "mosque_management"
        | "admin"
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
    Enums: {
      funding_type: ["ehsan", "direct_donor", "store_opportunity"],
      request_status: [
        "pending_review",
        "accepted_initial",
        "pending_rejection_approval",
        "rejected",
        "approved",
        "pending_inspection",
        "pending_inspection_approval",
        "pending_expert_pricing",
        "pending_pricing_approval",
        "pending_beneficiary_approval",
        "beneficiary_approved_pricing",
        "pending_funding",
        "pending_contractor_bids",
        "pending_contractor_selection",
        "pending_final_approval",
        "in_progress",
        "pending_final_report",
        "pending_closure",
        "closed",
        "cancelled",
      ],
      user_role: [
        "beneficiary",
        "customer_service",
        "project_manager",
        "technician",
        "pricing_expert",
        "mosque_management",
        "admin",
      ],
    },
  },
} as const
