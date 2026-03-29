import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ApprovalLink = Database["public"]["Tables"]["approval_links"]["Row"];
type InsertApprovalLink = Database["public"]["Tables"]["approval_links"]["Insert"];
type UpdateApprovalLink = Database["public"]["Tables"]["approval_links"]["Update"];

export const approvalLinkService = {
  /**
   * Create a new approval link for beneficiary
   */
  async createApprovalLink(
    requestId: string,
    beneficiaryPhone: string,
    expiresAt?: Date
  ): Promise<ApprovalLink> {
    // Generate unique token
    const token = `APR-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const newLink: InsertApprovalLink = {
      request_id: requestId,
      beneficiary_phone: beneficiaryPhone,
      token,
      expires_at: expiresAt?.toISOString() || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default 30 days
      is_used: false,
    };

    const { data, error } = await supabase
      .from("approval_links")
      .insert(newLink)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get approval link by token
   */
  async getByToken(token: string): Promise<ApprovalLink | null> {
    const { data, error } = await supabase
      .from("approval_links")
      .select("*")
      .eq("token", token)
      .single();

    if (error) {
      console.error("Error fetching approval link:", error);
      return null;
    }

    return data;
  },

  /**
   * Get approval link by request ID
   */
  async getByRequestId(requestId: string): Promise<ApprovalLink | null> {
    const { data, error } = await supabase
      .from("approval_links")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching approval link:", error);
      return null;
    }

    return data;
  },

  /**
   * Mark approval link as used
   */
  async markAsUsed(
    linkId: string,
    fundingType: Database["public"]["Enums"]["funding_type"]
  ): Promise<ApprovalLink> {
    const update: UpdateApprovalLink = {
      is_used: true,
      approved_at: new Date().toISOString(),
      funding_type: fundingType,
      approved: true
    };

    const { data, error } = await supabase
      .from("approval_links")
      .update(update)
      .eq("id", linkId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Check if link is valid (not expired and not used)
   */
  async isLinkValid(token: string): Promise<boolean> {
    const link = await this.getByToken(token);
    
    if (!link) return false;
    if (link.is_used) return false;
    
    const now = new Date();
    const expiresAt = new Date(link.expires_at || "");
    
    return now < expiresAt;
  },

  /**
   * Generate approval URL for beneficiary
   */
  generateApprovalUrl(token: string, baseUrl?: string): string {
    const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/approval/${token}`;
  },
};

export type { ApprovalLink, InsertApprovalLink, UpdateApprovalLink };