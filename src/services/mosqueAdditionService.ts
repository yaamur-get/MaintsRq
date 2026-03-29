import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MosqueAdditionRequest = Database["public"]["Tables"]["mosque_addition_requests"]["Row"];
type MosqueAdditionInsert = Database["public"]["Tables"]["mosque_addition_requests"]["Insert"];

export interface CreateMosqueAdditionData {
  requester_name: string;
  requester_phone: string;
  city: string;
  district: string;
  mosque_name: string;
  google_maps_link: string;
}

export const mosqueAdditionService = {
  // إنشاء طلب إضافة مسجد جديد
  async createAdditionRequest(data: CreateMosqueAdditionData): Promise<MosqueAdditionRequest> {
    const { data: result, error } = await supabase
      .from("mosque_addition_requests")
      .insert({
        requester_name: data.requester_name,
        requester_phone: data.requester_phone,
        city_name: data.city,
        district_name: data.district,
        mosque_name: data.mosque_name,
        google_maps_link: data.google_maps_link,
        status: "pending"
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating mosque addition request:", error);
      throw new Error("فشل في إرسال طلب إضافة المسجد");
    }

    return result;
  },

  // جلب جميع طلبات إضافة المساجد (لخدمة العملاء)
  async getAllAdditionRequests(): Promise<MosqueAdditionRequest[]> {
    const { data, error } = await supabase
      .from("mosque_addition_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching mosque addition requests:", error);
      throw new Error("فشل في تحميل طلبات إضافة المساجد");
    }

    return data || [];
  },

  // الموافقة على طلب إضافة مسجد وإضافته للنظام
  async approveAndAddMosque(
    requestId: string,
    cityId: string,
    districtId: string
  ): Promise<void> {
    // جلب بيانات الطلب
    const { data: request, error: fetchError } = await supabase
      .from("mosque_addition_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (fetchError || !request) {
      throw new Error("فشل في جلب بيانات الطلب");
    }

    // إضافة المسجد
    const { error: mosqueError } = await supabase
      .from("mosques")
      .insert({
        name: request.mosque_name,
        city_id: cityId,
        district_id: districtId,
        google_maps_link: request.google_maps_link
      });

    if (mosqueError) {
      console.error("Error adding mosque:", mosqueError);
      throw new Error("فشل في إضافة المسجد");
    }

    // تحديث حالة الطلب إلى "موافق عليه"
    const { error: updateError } = await supabase
      .from("mosque_addition_requests")
      .update({ status: "approved" })
      .eq("id", requestId);

    if (updateError) {
      console.error("Error updating request status:", updateError);
      throw new Error("فشل في تحديث حالة الطلب");
    }
  },

  // رفض طلب إضافة مسجد
  async rejectAdditionRequest(requestId: string): Promise<void> {
    const { error } = await supabase
      .from("mosque_addition_requests")
      .update({ status: "rejected" })
      .eq("id", requestId);

    if (error) {
      console.error("Error rejecting request:", error);
      throw new Error("فشل في رفض الطلب");
    }
  }
};