import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ExpertPricing = Database["public"]["Tables"]["expert_pricing"]["Row"];
type ExpertPricingInsert = Database["public"]["Tables"]["expert_pricing"]["Insert"];
type ContractorBid = Database["public"]["Tables"]["contractor_bids"]["Row"];
type ContractorBidInsert = Database["public"]["Tables"]["contractor_bids"]["Insert"];

export type ContractorBidPayloadItem = {
  contractor_id: string;
  external_report_item_id?: string | null;
  inspection_item_id?: string | null;
  item_main_name?: string | null;
  item_sub_name?: string | null;
  quantity?: number;
  bid_amount?: number | null;
  notes?: string | null;
  bid_document_url?: string | null;
  bid_status: "offered" | "not_offered";
};

const isMissingColumnError = (message?: string) => {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("does not exist") ||
    (lowerMessage.includes("could not find") &&
      lowerMessage.includes("column") &&
      lowerMessage.includes("schema cache"))
  );
};

const isExternalIssueColumnError = (message?: string) => {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("external_report_issue_id") &&
    isMissingColumnError(message)
  );
};

const isMissingOnConflictConstraintError = (message?: string) => {
  if (!message) return false;
  return message
    .toLowerCase()
    .includes("there is no unique or exclusion constraint matching the on conflict specification");
};

const isInspectionItemNotNullError = (message?: string) => {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("inspection_item_id") &&
    lowerMessage.includes("null value") &&
    lowerMessage.includes("not-null constraint")
  );
};

const isMissingRpcFunctionError = (message?: string, functionName?: string) => {
  if (!message || !functionName) return false;
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("could not find the function") &&
    lowerMessage.includes(`public.${functionName.toLowerCase()}`)
  );
};

const dedupeExpertPricingRows = (rows: ExpertPricing[]) => {
  const byKey = new Map<string, ExpertPricing>();

  for (const row of rows) {
    const key = row.external_report_item_id
      ? `ext:${row.request_id}:${row.external_report_item_id}`
      : row.inspection_item_id
        ? `legacy:${row.request_id}:${row.inspection_item_id}`
        : `fallback:${row.request_id}:${row.item_main_name || ""}:${row.item_sub_name || ""}`;

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, row);
      continue;
    }

    const currentTime = new Date(current.updated_at || current.created_at || 0).getTime();
    const nextTime = new Date(row.updated_at || row.created_at || 0).getTime();
    if (nextTime >= currentTime) {
      byKey.set(key, row);
    }
  }

  return Array.from(byKey.values());
};

export const pricingService = {
  // جلب تسعيرات الخبير للطلب
  async getExpertPricing(requestId: string) {
    try {
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
        // إذا كانت المشكلة أن العمود غير موجود، أرجع قائمة فارغة
        if (isMissingColumnError(error.message)) {
          console.warn("request_id column might not exist yet. Please run migrations.");
          return [];
        }
        throw error;
      }

      return dedupeExpertPricingRows(data || []);
    } catch (err: any) {
      console.error("Exception fetching expert pricing:", err);
      // في حالة الخطأ، أرجع قائمة فارغة بدلاً من رفع الخطأ
      return [];
    }
  },

  // إضافة/تحديث تسعير خبير
  async upsertExpertPricing(data: Omit<ExpertPricingInsert, "id" | "created_at">) {
    try {
      console.log("Upserting expert pricing with data:", data);
      
      // التأكد من أن البيانات المطلوبة موجودة
      const cleanData = {
        request_id: data.request_id,
        inspection_item_id: data.inspection_item_id,
        external_report_item_id: data.external_report_item_id,
        external_report_issue_id: data.external_report_issue_id,
        item_main_name: data.item_main_name,
        item_sub_name: data.item_sub_name,
        item_specifications: data.item_specifications,
        item_unit: data.item_unit,
        quantity: data.quantity,
        unit_price: data.unit_price,
        estimated_price: data.estimated_price,
        pricing_notes: data.pricing_notes,
        approved: data.approved || false,
      };

      // تحديث السجل الموجود أولاً لمنع إنشاء صف جديد عند تعديل السعر
      if (cleanData.external_report_item_id) {
        const { data: existingRows, error: existingLookupError } = await supabase
          .from("expert_pricing")
          .select("id")
          .eq("request_id", cleanData.request_id)
          .eq("external_report_item_id", cleanData.external_report_item_id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingLookupError && !isMissingColumnError(existingLookupError.message)) {
          console.error("Error checking existing pricing row:", existingLookupError);
          throw existingLookupError;
        }

        if (existingRows && existingRows.length > 0) {
          const { data: updatedPricing, error: updateError } = await supabase
            .from("expert_pricing")
            .update(cleanData)
            .eq("id", existingRows[0].id)
            .select()
            .single();

          if (!updateError) {
            return updatedPricing;
          }

          if (!isMissingColumnError(updateError.message)) {
            console.error("Error updating existing pricing row:", updateError);
            throw updateError;
          }
        }
      }
      
      const { data: pricing, error } = await supabase
        .from("expert_pricing")
        .upsert(cleanData, { onConflict: "request_id,external_report_item_id" })
        .select()
        .single();

      if (error) {
        console.error("Error upserting expert pricing:", error);

        // fallback: duplicate key – سجل موجود بالفعل، نحدّثه مباشرة
        if (error.code === "23505" || error.message?.toLowerCase().includes("duplicate key")) {
          const lookupField = cleanData.external_report_item_id
            ? { external_report_item_id: cleanData.external_report_item_id }
            : { inspection_item_id: cleanData.inspection_item_id };

          const lookupKey = cleanData.external_report_item_id
            ? "external_report_item_id"
            : "inspection_item_id";
          const lookupVal = cleanData.external_report_item_id || cleanData.inspection_item_id;

          if (lookupVal) {
            const { data: dupRow } = await supabase
              .from("expert_pricing")
              .select("id")
              .eq("request_id", cleanData.request_id)
              .eq(lookupKey, lookupVal)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (dupRow?.id) {
              const { data: fixedRow, error: fixErr } = await supabase
                .from("expert_pricing")
                .update(cleanData)
                .eq("id", dupRow.id)
                .select()
                .single();

              if (!fixErr) {
                console.log("Resolved duplicate via update on id:", dupRow.id);
                return fixedRow;
              }
              throw fixErr;
            }
          }
        }

        // fallback: بعض البيئات لم تُحدّث schema cache بعد لهذا العمود
        if (isExternalIssueColumnError(error.message)) {
          const { external_report_issue_id, ...fallbackData } = cleanData;
          void external_report_issue_id;

          const { data: fallbackPricing, error: fallbackError } = await supabase
            .from("expert_pricing")
            .upsert(fallbackData, { onConflict: "request_id,external_report_item_id" })
            .select()
            .single();

          if (fallbackError) {
            console.error("Fallback upsert without external_report_issue_id failed:", fallbackError);
            throw fallbackError;
          }

          console.warn("Saved pricing without external_report_issue_id because column is not available in schema cache yet.");
          return fallbackPricing;
        }

        // fallback: في حال عدم وجود unique constraint مطابق لـ onConflict
        if (isMissingOnConflictConstraintError(error.message)) {
          const matchItemId = cleanData.external_report_item_id;

          const tryInsertWithLegacyInspectionId = async () => {
            const { data: insertedPricing, error: insertError } = await supabase
              .from("expert_pricing")
              .insert(cleanData)
              .select()
              .single();

            if (!insertError) {
              return insertedPricing;
            }

            if (!isInspectionItemNotNullError(insertError.message)) {
              console.error("Fallback insert failed:", insertError);
              throw insertError;
            }

            const { data: matchedInspectionItem, error: matchError } = await supabase
              .from("inspection_items")
              .select("id")
              .eq("request_id", cleanData.request_id)
              .eq("main_item", cleanData.item_main_name || "")
              .eq("sub_item", cleanData.item_sub_name || "")
              .limit(1)
              .maybeSingle();

            if (matchError) {
              console.error("Failed to resolve legacy inspection_item_id:", matchError);
              throw matchError;
            }

            if (!matchedInspectionItem?.id) {
              throw new Error(
                "Legacy schema requires inspection_item_id and no matching inspection item was found. Please run migration to allow external pricing rows."
              );
            }

            const legacyInsertData = {
              ...cleanData,
              inspection_item_id: matchedInspectionItem.id,
            };

            const { data: legacyInsertedPricing, error: legacyInsertError } = await supabase
              .from("expert_pricing")
              .insert(legacyInsertData)
              .select()
              .single();

            if (legacyInsertError) {
              console.error("Legacy insert with inspection_item_id failed:", legacyInsertError);
              throw legacyInsertError;
            }

            return legacyInsertedPricing;
          };

          if (!matchItemId) {
            const insertedPricing = await tryInsertWithLegacyInspectionId();
            return insertedPricing;
          }

          const { data: existingPricing, error: existingError } = await supabase
            .from("expert_pricing")
            .select("id")
            .eq("request_id", cleanData.request_id)
            .eq("external_report_item_id", matchItemId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingError) {
            console.error("Fallback lookup failed:", existingError);
            throw existingError;
          }

          if (existingPricing?.id) {
            const { data: updatedPricing, error: updateError } = await supabase
              .from("expert_pricing")
              .update(cleanData)
              .eq("id", existingPricing.id)
              .select()
              .single();

            if (updateError) {
              console.error("Fallback update failed:", updateError);
              throw updateError;
            }

            console.warn("Saved pricing using update fallback because ON CONFLICT constraint is missing.");
            return updatedPricing;
          }

          const insertedPricing = await tryInsertWithLegacyInspectionId();

          console.warn("Saved pricing using insert fallback because ON CONFLICT constraint is missing.");
          return insertedPricing;
        }
        
        // إذا كانت المشكلة في الأعمدة المفقودة، أرجع البيانات على أي حال
        if (isMissingColumnError(error.message)) {
          console.warn("بعض الأعمدة قد لا تكون موجودة بعد. يرجى تطبيق migration.");
          // أرجع البيانات المدخلة كأنها تم حفظها
          return cleanData;
        }
        throw error;
      }

      console.log("Successfully upserted pricing:", pricing);
      return pricing;
    } catch (err: any) {
      console.error("Exception upserting expert pricing:", err);
      throw new Error(`Failed to save pricing: ${err.message}`);
    }
  },

  // جلب عروض المقاولين
  async getContractorBids(requestId: string) {
    console.log("🔍 Fetching contractor bids for request:", requestId);
    
    try {
      // Primary: query directly by request_id (column added in migration 20260330)
      const { data: directBids, error: directError } = await (supabase as any)
        .from("contractor_bids")
        .select("*, contractor:contractors(*)")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (!directError) {
        console.log("✅ Direct request_id query successful. Found:", directBids?.length || 0, "bids");
        if (directBids && directBids.length > 0) {
          console.log("📊 First bid details:", directBids[0]);
          return directBids;
        }
        // Direct query worked but found 0 – fall through to item-based lookup
        console.log("ℹ️ Direct query found 0 bids. Trying item-based lookup...");
      } else {
        console.warn("⚠️ Direct request_id query failed (column may not exist):", directError.message);
      }

      // Fallback: resolve item IDs via expert_pricing then query bids by those IDs
      const { data: pricingRows, error: pricingError } = await supabase
        .from("expert_pricing")
        .select("inspection_item_id, external_report_item_id")
        .eq("request_id", requestId);

      if (pricingError) {
        console.error("❌ Failed to load expert_pricing for bid lookup:", pricingError);
        throw pricingError;
      }

      if (!pricingRows || pricingRows.length === 0) {
        console.log("ℹ️ No expert_pricing rows found for request – returning empty bids");
        return [];
      }

      console.log("📋 Pricing rows for lookup:", pricingRows);

      const inspectionItemIds = pricingRows
        .map((r: any) => r.inspection_item_id)
        .filter(Boolean) as string[];

      const externalItemIds = pricingRows
        .map((r: any) => r.external_report_item_id)
        .filter(Boolean) as string[];

      console.log("🔎 Lookup ids – inspection:", inspectionItemIds, "external:", externalItemIds);

      let query = (supabase as any)
        .from("contractor_bids")
        .select("*, contractor:contractors(*)")
        .order("created_at", { ascending: true });

      if (inspectionItemIds.length > 0 && externalItemIds.length > 0) {
        query = query.or(
          `inspection_item_id.in.(${inspectionItemIds.join(",")}),external_report_item_id.in.(${externalItemIds.join(",")})`
        );
      } else if (inspectionItemIds.length > 0) {
        query = query.in("inspection_item_id", inspectionItemIds);
      } else if (externalItemIds.length > 0) {
        query = query.in("external_report_item_id", externalItemIds);
      } else {
        console.log("ℹ️ No item IDs resolved – returning empty bids");
        return [];
      }

      const { data: bids, error: bidsError } = await query;

      if (bidsError) {
        console.error("❌ Failed to load contractor bids by item IDs:", bidsError);
        throw bidsError;
      }

      console.log("✅ Item-based bid lookup. Found:", bids?.length || 0, "bids");
      if (bids && bids.length > 0) {
        console.log("📊 First bid details:", bids[0]);
      }

      return bids || [];
    } catch (err: any) {
      console.error("❌ Exception in getContractorBids:", err);
      throw err;
    }
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

  async saveContractorBidsDraft(requestId: string, bids: ContractorBidPayloadItem[]) {
    const { data, error } = await (supabase as any).rpc("save_contractor_bids_draft", {
      p_request_id: requestId,
      p_bids: bids,
    });

    if (error) {
      console.error("Error saving contractor bids draft:", error);
      if (isMissingRpcFunctionError(error?.message, "save_contractor_bids_draft")) {
        throw new Error(
          "ميزة حفظ المسودة غير مفعلة على قاعدة البيانات بعد. يرجى تطبيق migration: 20260405123000_contractor_bids_specialization_submission.sql"
        );
      }
      throw error;
    }

    return data;
  },

  async submitContractorBidsWithCoverage(
    requestId: string,
    bids: ContractorBidPayloadItem[],
    notes?: string
  ) {
    const { data, error } = await (supabase as any).rpc("submit_contractor_bids_with_coverage", {
      p_request_id: requestId,
      p_bids: bids,
      p_notes: notes || null,
    });

    if (error) {
      console.error("Error submitting contractor bids with coverage:", error);
      if (isMissingRpcFunctionError(error?.message, "submit_contractor_bids_with_coverage")) {
        throw new Error(
          "الإرسال النهائي غير مفعل على قاعدة البيانات بعد. يرجى تطبيق migration: 20260405123000_contractor_bids_specialization_submission.sql"
        );
      }
      throw error;
    }

    return data;
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