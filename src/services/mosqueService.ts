import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Mosque = Database["public"]["Tables"]["mosques"]["Row"];
type MosqueInsert = Database["public"]["Tables"]["mosques"]["Insert"];

export const mosqueService = {
  // جلب جميع المساجد
  async getAllMosques() {
    const { data, error } = await supabase
      .from("mosques")
      .select(`
        *,
        city:cities(name),
        district:districts(name)
      `)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching mosques:", error);
      throw error;
    }

    return data || [];
  },

  // جلب مساجد حسب المدينة والحي
  async getMosquesByDistrict(districtId: string) {
    const { data, error } = await supabase
      .from("mosques")
      .select(`
        *,
        city:cities(name),
        district:districts(name)
      `)
      .eq("district_id", districtId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching mosques by district:", error);
      throw error;
    }

    return data || [];
  },

  // جلب تفاصيل مسجد معين
  async getMosqueById(id: string) {
    const { data, error } = await supabase
      .from("mosques")
      .select(`
        *,
        city:cities(name),
        district:districts(name)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching mosque:", error);
      throw error;
    }

    return data;
  },

  // إضافة مسجد جديد
  async createMosque(mosqueData: MosqueInsert) {
    const { data, error } = await supabase
      .from("mosques")
      .insert(mosqueData)
      .select()
      .single();

    if (error) {
      console.error("Error creating mosque:", error);
      throw error;
    }

    return data;
  },

  // تحديث بيانات مسجد
  async updateMosque(id: string, updates: Partial<Mosque>) {
    const { data, error } = await supabase
      .from("mosques")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating mosque:", error);
      throw error;
    }

    return data;
  },

  // جلب قائمة المدن
  async getCities() {
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching cities:", error);
      return [];
    }

    return data || [];
  },

  // جلب قائمة الأحياء حسب المدينة
  async getDistricts(cityId: string) {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .eq("city_id", cityId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching districts:", error);
      return [];
    }

    return data || [];
  },

  // جلب أنواع الاحتياجات
  async getRequestTypes() {
    const { data, error } = await supabase
      .from("request_types")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching request types:", error);
      return [];
    }

    return data || [];
  }
};