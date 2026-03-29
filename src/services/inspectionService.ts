import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InspectionItem = Database["public"]["Tables"]["inspection_items"]["Row"];
type InspectionItemInsert = Database["public"]["Tables"]["inspection_items"]["Insert"];
type ItemImage = Database["public"]["Tables"]["item_images"]["Row"];

export const inspectionService = {
  // جلب بنود المعاينة للطلب
  async getInspectionItems(requestId: string) {
    const { data, error } = await supabase
      .from("inspection_items")
      .select(`
        *,
        images:item_images(*)
      `)
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching inspection items:", error);
      throw error;
    }

    return data || [];
  },

  // إضافة بند معاينة
  async addInspectionItem(data: Omit<InspectionItemInsert, "id" | "created_at">) {
    const { data: item, error } = await supabase
      .from("inspection_items")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error adding inspection item:", error);
      throw error;
    }

    return item;
  },

  // تحديث بند معاينة
  async updateInspectionItem(itemId: string, updates: Partial<InspectionItemInsert>) {
    const { data, error } = await supabase
      .from("inspection_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error) {
      console.error("Error updating inspection item:", error);
      throw error;
    }

    return data;
  },

  // حذف بند معاينة
  async deleteInspectionItem(itemId: string) {
    const { error } = await supabase
      .from("inspection_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      console.error("Error deleting inspection item:", error);
      throw error;
    }
  },

  // رفع صورة للبند
  async uploadItemPhoto(file: File, itemId: string, requestId: string) {
    try {
      // رفع الملف إلى Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${requestId}/${itemId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("inspection-photos") // التأكد من وجود هذا الـ bucket في Supabase
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // الحصول على الرابط العام
      const { data: { publicUrl } } = supabase.storage
        .from("inspection-photos")
        .getPublicUrl(fileName);

      // حفظ سجل الصورة في قاعدة البيانات
      const { data, error } = await supabase
        .from("item_images")
        .insert({
          inspection_item_id: itemId,
          image_url: publicUrl
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error uploading photo:", error);
      throw error;
    }
  },

  // حذف صورة
  async deletePhoto(photoId: string, storagePath: string) {
    try {
      // حذف من Storage
      if (storagePath) {
        await supabase.storage
          .from("inspection-photos")
          .remove([storagePath]);
      }

      // حذف السجل من قاعدة البيانات
      const { error } = await supabase
        .from("item_images")
        .delete()
        .eq("id", photoId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting photo:", error);
      throw error;
    }
  }
};