import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type RequestStatusHistory = Database["public"]["Tables"]["request_status_history"]["Row"];
type InsertStatusHistory = Database["public"]["Tables"]["request_status_history"]["Insert"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

export const timelineService = {
  /**
   * Add timeline entry when status changes
   */
  async addTimelineEntry(
    requestId: string,
    oldStatus: string | null,
    newStatus: string,
    changedBy: string,
    notes?: string
  ): Promise<RequestStatusHistory> {
    const entry: InsertStatusHistory = {
      request_id: requestId,
      previous_status: oldStatus as RequestStatus | null,
      new_status: newStatus as RequestStatus,
      changed_by: changedBy,
      notes,
    };

    const { data, error } = await supabase
      .from("request_status_history")
      .insert(entry)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get timeline for a request
   */
  async getRequestTimeline(requestId: string): Promise<RequestStatusHistory[]> {
    const { data, error } = await supabase
      .from("request_status_history")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Get latest status change for a request
   */
  async getLatestStatusChange(requestId: string): Promise<RequestStatusHistory | null> {
    const { data, error } = await supabase
      .from("request_status_history")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching latest status change:", error);
      return null;
    }

    return data;
  },

  /**
   * Get timeline with user details
   */
  async getTimelineWithUsers(requestId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("request_status_history")
      .select(`
        *,
        users:changed_by (
          email,
          full_name
        )
      `)
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },
};

export type { RequestStatusHistory, InsertStatusHistory };