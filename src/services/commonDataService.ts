import { supabase } from "@/integrations/supabase/client";

export const commonDataService = {
  // جلب جميع المدن
  async getAllCities() {
    const { data, error } = await supabase
      .from("cities")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching cities:", error);
      throw error;
    }

    return data || [];
  },

  // جلب جميع الأحياء لمدينة معينة
  async getDistrictsByCity(cityId: string) {
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .eq("city_id", cityId)
      .order("name");

    if (error) {
      console.error("Error fetching districts:", error);
      throw error;
    }

    return data || [];
  },

  // جلب جميع أنواع الطلبات
  async getAllRequestTypes() {
    const { data, error } = await supabase
      .from("request_types")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching request types:", error);
      throw error;
    }

    return data || [];
  },

  // جلب ترجمات الحالات والألوان
  async getStatusTranslations() {
    const { data, error } = await supabase
      .from("status_translations")
      .select("*");

    if (error) {
      console.error("Error fetching status translations:", error);
      // Return default empty array instead of throwing to prevent app crash
      return [];
    }

    return data || [];
  }
};

export type City = {
  id: string;
  name: string;
  created_at?: string;
};

export type District = {
  id: string;
  name: string;
  city_id: string;
  created_at?: string;
};

export type RequestType = {
  id: string;
  name: string;
  created_at?: string;
};