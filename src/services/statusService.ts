import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StatusTranslation = Database["public"]["Tables"]["status_translations"]["Row"];

export const statusService = {
  /**
   * Get all status translations
   */
  async getAllStatusTranslations(): Promise<StatusTranslation[]> {
    const query = supabase
      .from("status_translations")
      .select("*")
      .eq("is_active", true);
      
    const { data, error } = await query.order("display_order", { ascending: true });

    if (error) throw new Error(error.message);
    return (data as any) as StatusTranslation[];
  },

  /**
   * Get translation for specific status
   */
  async getStatusTranslation(statusValue: string): Promise<StatusTranslation | null> {
    const { data, error } = await supabase
      .from("status_translations")
      .select("*")
      .eq("status_key", statusValue)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching status translation:", error);
      return null;
    }

    return (data as any) as StatusTranslation;
  },

  /**
   * Get status translations as a map for easy lookup
   */
  async getStatusTranslationsMap(): Promise<Record<string, string>> {
    const translations = await this.getAllStatusTranslations();
    const map: Record<string, string> = {};
    
    translations.forEach((t) => {
      map[t.status_key] = t.arabic_label;
    });

    return map;
  },

  /**
   * Get status color class
   */
  async getStatusColorClass(statusValue: string): Promise<string> {
    const translation = await this.getStatusTranslation(statusValue);
    return translation?.color_class || "bg-gray-100 text-gray-800 border-gray-200";
  },
};

export type { StatusTranslation };