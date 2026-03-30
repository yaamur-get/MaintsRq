import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ExpertPricing = Database["public"]["Tables"]["expert_pricing"]["Row"];
type ExpertPricingInsert = Database["public"]["Tables"]["expert_pricing"]["Insert"];
type ContractorBid = Database["public"]["Tables"]["contractor_bids"]["Row"];
type ContractorBidInsert = Database["public"]["Tables"]["contractor_bids"]["Insert"];

export const pricingService = {
  // جلب تسعيرات الخبير للطلب
  async getExpertPricing(requestId: string) {
    const { data, error } = await supabase
      .from("expert_pricing")
      .select(`
        *,
        expert:profiles!expert_pricing_approved_by_fkey(full_name)
      `)
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching expert pricing:", error);
      throw error;
    }

    return data || [];
  },

  // إضافة/تحديث تسعير خبير
  async upsertExpertPricing(data: Omit<ExpertPricingInsert, "id" | "created_at">) {
    const { data: pricing, error } = await supabase
      .from("expert_pricing")
      .upsert(data, { onConflict: "request_id,external_report_item_id" })
      .select()
      .single();

    if (error) {
      console.error("Error upserting expert pricing:", error);
      throw error;
    }

    return pricing;
  },

  // جلب عروض المقاولين
  async getContractorBids(requestId: string) {
    const { data, error } = await supabase
      .from("contractor_bids")
      .select(`
        *,
        contractor:contractors(*)
      `)
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching contractor bids:", error);
      throw error;
    }

    return data || [];
  },

  // إضافة عرض مقاول
  async addContractorBid(data: Omit<ContractorBidInsert, "id" | "created_at">) {
    const { data: bid, error } = await supabase
      .from("contractor_bids")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error adding contractor bid:", error);
      throw error;
    }

    return bid;
  },

  // تحديث عرض مقاول
  async updateContractorBid(bidId: string, updates: Partial<ContractorBidInsert>) {
    const { data, error } = await supabase
      .from("contractor_bids")
      .update(updates)
      .eq("id", bidId)
      .select()
      .single();

    if (error) {
      console.error("Error updating contractor bid:", error);
      throw error;
    }

    return data;
  },

  // اختيار العرض الفائز
  async selectWinningBid(bidId: string, requestId: string) {
    try {
      const { data: targetBid, error: targetBidError } = await supabase
        .from("contractor_bids")
        .select("external_report_item_id, inspection_item_id")
        .eq("id", bidId)
        .single();

      if (targetBidError) throw targetBidError;

      if (targetBid?.external_report_item_id) {
        await supabase
          .from("contractor_bids")
          .update({ is_selected: false })
          .eq("request_id", requestId)
          .eq("external_report_item_id", targetBid.external_report_item_id);
      } else if (targetBid?.inspection_item_id) {
        await supabase
          .from("contractor_bids")
          .update({ is_selected: false })
          .eq("request_id", requestId)
          .eq("inspection_item_id", targetBid.inspection_item_id);
      }

        // تحديد العرض الفائز
      const { data, error } = await supabase
        .from("contractor_bids")
        .update({ is_selected: true })
        .eq("id", bidId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error selecting winning bid:", error);
      throw error;
    }
  },

  // جلب قائمة المقاولين
  async getContractors() {
    const { data, error } = await supabase
      .from("contractors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching contractors:", error);
      return [];
    }

    return data || [];
  },

  // رفع ملف عرض سعر
  async uploadBidDocument(file: File, bidId: string, requestId: string) {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${requestId}/bids/${bidId}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("bid-documents")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("bid-documents")
        .getPublicUrl(fileName);

      // تحديث سجل العرض
      await supabase
        .from("contractor_bids")
        .update({ bid_document_url: publicUrl })
        .eq("id", bidId);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading bid document:", error);
      throw error;
    }
  }
};