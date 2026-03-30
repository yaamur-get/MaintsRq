import { supabase as supabaseClient } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { timelineService } from "./timelineService";
import { notificationService } from "./notificationService";
import { approvalLinkService } from "./approvalLinkService";

// Force supabase client to be 'any' type to avoid "Type instantiation is excessively deep" errors
// throughout this complex service file.
const supabase = supabaseClient as any;

type Request = Database["public"]["Tables"]["requests"]["Row"];
type RequestInsert = Database["public"]["Tables"]["requests"]["Insert"];
type RequestUpdate = Database["public"]["Tables"]["requests"]["Update"];

export type RequesterRole = "imam" | "muezzin" | "mosque_congregation";

export const REQUESTER_ROLE_LABELS: Record<RequesterRole, string> = {
  imam: "إمام",
  muezzin: "مؤذن",
  mosque_congregation: "جماعة المسجد",
};

const isRequesterRole = (value: string): value is RequesterRole => {
  return value === "imam" || value === "muezzin" || value === "mosque_congregation";
};

export const getRequesterRoleLabel = (role?: string | null): string => {
  if (!role || !isRequesterRole(role)) return "غير محدد";
  return REQUESTER_ROLE_LABELS[role];
};

export interface CreateRequestData {
  requester_name: string;
  requester_phone: string;
  requester_role: RequesterRole | "";
  city: string;
  district: string;
  mosque_id: string;
  need_type: string;
  details: string;
}

export interface UpdatePendingReviewRequestData {
  requester_name: string;
  requester_phone: string;
  requester_role: RequesterRole;
  request_type_id: string;
  mosque_id: string;
  description: string;
  audit_note?: string;
}

export const requestService = {
  // إنشاء طلب جديد
  async createRequest(data: CreateRequestData) {
    if (!isRequesterRole(data.requester_role)) {
      throw new Error("يرجى اختيار صفة مقدم الطلب");
    }

    // 1. Get Request Type ID
    let requestTypeId: string | undefined;
    
    const { data: requestType } = await supabase
      .from("request_types")
      .select("id")
      .eq("name", data.need_type)
      .maybeSingle();
      
    if (requestType) {
      requestTypeId = requestType.id;
    } else {
      const { data: otherType } = await supabase
        .from("request_types")
        .select("id")
        .eq("name", "أخرى")
        .maybeSingle();
        
      if (otherType) {
        requestTypeId = otherType.id;
      } else {
         const { data: anyType } = await supabase
        .from("request_types")
        .select("id")
        .limit(1)
        .single();
        requestTypeId = anyType?.id;
      }
    }

    if (!requestTypeId) {
      throw new Error("Could not determine request type");
    }

    // 2. Handle Mosque ID
    let mosqueId = data.mosque_id;
    if (!mosqueId) {
      const { data: anyMosque } = await supabase
        .from("mosques")
        .select("id")
        .limit(1)
        .single();
        
      if (!anyMosque) throw new Error("No mosques available in system to link request");
      mosqueId = anyMosque.id;
    }

    // 3. Get mosque number and count
    const { data: mosqueData } = await supabase
      .from("mosques")
      .select("mosque_number")
      .eq("id", mosqueId)
      .single();

    const { count } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("mosque_id", mosqueId);

    const requestNumber = (count || 0) + 1;
    const mosqueNumber = mosqueData?.mosque_number || 1;
    const rqNumber = `RQ-${mosqueNumber}-${requestNumber}`;

    // 4. Insert
    const insertData: RequestInsert = {
      beneficiary_name: data.requester_name,
      beneficiary_phone: data.requester_phone,
      requester_role: data.requester_role,
      mosque_id: mosqueId,
      request_type_id: requestTypeId,
      description: data.details,
      current_status: "pending_review",
      funding_type: null,
      rq_number: rqNumber,
    };

    const { data: request, error } = await supabase
      .from("requests")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating request:", error);
      throw error;
    }

    if (request) {
      await this.createStatusLog(request.id, "pending_review", "تم تقديم الطلب الجديد");
    }

    return request;
  },

  // جلب جميع الطلبات
  async getAllRequests() {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        mosque:mosques(name, city:cities(name), district:districts(name)),
        request_type:request_types(name),
        requester:profiles!requests_beneficiary_id_fkey(full_name, phone)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
      throw error;
    }

    return data || [];
  },

  // جلب طلبات مسجد معين
  async getRequestsByMosque(mosqueId: string) {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        request_types(name)
      `)
      .eq("mosque_id", mosqueId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching mosque requests:", error);
      return [];
    }

    return data || [];
  },

  // البحث عن مستفيد برقم الجوال
  async getBeneficiaryByPhone(phone: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("phone", phone)
      .maybeSingle();
    
    if (error) {
      console.error("Error finding beneficiary:", error);
      return null;
    }
    
    return data;
  },

  // جلب طلب معين
  async getRequestById(requestId: string) {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        mosque:mosques(id, name, address, city_id, district_id, city:cities(id, name), district:districts(id, name)),
        request_type:request_types(id, name),
        requester:profiles!requests_beneficiary_id_fkey(full_name, phone),
        assigned_technician:profiles!requests_assigned_technician_id_fkey(id, full_name, phone),
        assigned_expert:profiles!requests_assigned_pricing_expert_id_fkey(id, full_name, phone)
      `)
      .eq("id", requestId)
      .single();

    if (error) {
      console.error("Error fetching request:", error);
      throw error;
    }

    return data;
  },

  // تحديث بيانات الطلب في مرحلة مراجعة خدمة العملاء فقط
  async updatePendingReviewRequest(
    requestId: string,
    payload: UpdatePendingReviewRequestData
  ) {
    const { data: currentRequest, error: currentError } = await supabase
      .from("requests")
      .select(`
        id,
        current_status,
        beneficiary_name,
        beneficiary_phone,
        requester_role,
        description,
        mosque_id,
        request_type_id,
        mosque:mosques(name),
        request_type:request_types(name)
      `)
      .eq("id", requestId)
      .single();

    if (currentError) {
      console.error("Error fetching current request before update:", currentError);
      throw currentError;
    }

    if (currentRequest?.current_status !== "pending_review") {
      throw new Error("لا يمكن تعديل البيانات إلا في مرحلة بانتظار المراجعة");
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from("requests")
      .update({
        beneficiary_name: payload.requester_name,
        beneficiary_phone: payload.requester_phone,
        requester_role: payload.requester_role,
        request_type_id: payload.request_type_id,
        mosque_id: payload.mosque_id,
        description: payload.description,
        updated_at: new Date().toISOString(),
      } as RequestUpdate)
      .eq("id", requestId)
      .select(`
        id,
        beneficiary_name,
        beneficiary_phone,
        requester_role,
        description,
        mosque_id,
        request_type_id,
        mosque:mosques(name),
        request_type:request_types(name)
      `)
      .single();

    if (updateError) {
      console.error("Error updating pending review request:", updateError);
      throw updateError;
    }

    const changeLines: string[] = [];

    if ((currentRequest?.beneficiary_name || "") !== (updatedRequest?.beneficiary_name || "")) {
      changeLines.push(`الاسم: ${currentRequest?.beneficiary_name || "-"} -> ${updatedRequest?.beneficiary_name || "-"}`);
    }
    if ((currentRequest?.beneficiary_phone || "") !== (updatedRequest?.beneficiary_phone || "")) {
      changeLines.push(`الجوال: ${currentRequest?.beneficiary_phone || "-"} -> ${updatedRequest?.beneficiary_phone || "-"}`);
    }
    if ((currentRequest?.requester_role || "") !== (updatedRequest?.requester_role || "")) {
      changeLines.push(`صفة مقدم الطلب: ${getRequesterRoleLabel(currentRequest?.requester_role)} -> ${getRequesterRoleLabel(updatedRequest?.requester_role)}`);
    }
    if ((currentRequest?.request_type_id || "") !== (updatedRequest?.request_type_id || "")) {
      changeLines.push(`نوع الطلب: ${currentRequest?.request_type?.name || "-"} -> ${updatedRequest?.request_type?.name || "-"}`);
    }
    if ((currentRequest?.mosque_id || "") !== (updatedRequest?.mosque_id || "")) {
      changeLines.push(`المسجد: ${currentRequest?.mosque?.name || "-"} -> ${updatedRequest?.mosque?.name || "-"}`);
    }
    if ((currentRequest?.description || "") !== (updatedRequest?.description || "")) {
      changeLines.push("تم تحديث الوصف/الملاحظات");
    }

    if (changeLines.length > 0) {
      const notes = [
        "تم تصحيح بيانات الطلب بواسطة خدمة العملاء",
        ...changeLines.map((line) => `- ${line}`),
        payload.audit_note?.trim() ? `ملاحظة إضافية: ${payload.audit_note.trim()}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      await this.createStatusLog(requestId, "pending_review", notes);
    }

    return updatedRequest;
  },

  // تحديث حالة الطلب
  async updateRequestStatus(
    requestId: string,
    status: Database["public"]["Enums"]["request_status"],
    notes?: string
  ) {
    const { data, error } = await supabase
      .from("requests")
      .update({ current_status: status, updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error updating request status:", error);
      throw error;
    }

    if (data) {
      await this.createStatusLog(requestId, status, notes);
    }

    return data;
  },

  // تحديث بيانات مقدم الطلب
  async updateRequesterInfo(
    requestId: string,
    payload: {
      requester_name: string;
      requester_phone: string;
      requester_role: RequesterRole;
    }
  ) {
    const { data, error } = await supabase
      .from("requests")
      .update({
        beneficiary_name: payload.requester_name,
        beneficiary_phone: payload.requester_phone,
        requester_role: payload.requester_role,
        updated_at: new Date().toISOString(),
      } as RequestUpdate)
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      console.error("Error updating requester info:", error);
      throw error;
    }

    return data as Request;
  },

  // إنشاء سجل في Timeline
  async createStatusLog(
    requestId: string,
    newStatus: Database["public"]["Enums"]["request_status"],
    notes?: string
  ) {
    const { data: session } = await supabase.auth.getSession();
    
    const { data, error } = await supabase
      .from("request_status_history")
      .insert({
        request_id: requestId,
        new_status: newStatus,
        changed_by: session.session?.user?.id,
        notes
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating status log:", error);
    }

    return data;
  },

  // جلب Timeline للطلب
  async getRequestTimeline(requestId: string) {
    const { data, error } = await supabase
      .from("request_status_history")
      .select(`
        *,
        changed_by_user:profiles!request_status_history_changed_by_fkey(full_name)
      `)
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching timeline:", error);
      throw error;
    }

    return data || [];
  },

  // جلب طلبات خدمة العملاء
  async getRequestsForCustomerService() {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        mosque:mosques(name, city:cities(name), district:districts(name)),
        request_type:request_types(name),
        requester:profiles!requests_beneficiary_id_fkey(full_name, phone)
      `)
      .eq("current_status", "pending_review")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching customer service requests:", error);
      return [];
    }

    return data || [];
  },

  // جلب طلبات الفني
  async getRequestsForTechnician(technicianId: string) {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        mosque:mosques(name, city:cities(name), district:districts(name)),
        request_type:request_types(name),
        requester:profiles!requests_beneficiary_id_fkey(full_name, phone)
      `)
      .eq("assigned_technician_id", technicianId)
      .in("current_status", ["pending_inspection", "in_progress", "pending_final_report"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching technician requests:", error);
      return [];
    }

    return data || [];
  },

  // جلب طلبات خبير التسعير
  async getRequestsForPricingExpert(expertId: string) {
    const { data, error } = await supabase
      .from("requests")
      .select(`
        *,
        mosque:mosques(name, city:cities(name), district:districts(name)),
        request_type:request_types(name),
        requester:profiles!requests_beneficiary_id_fkey(full_name, phone)
      `)
      .in("current_status", ["pending_expert_pricing"])
      .or(`assigned_pricing_expert_id.eq.${expertId},assigned_pricing_expert_id.is.null`)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching pricing expert requests:", error);
      return [];
    }

    return data || [];
  },

  // جلب طلبات حسب الدور المسؤول عن الإجراء الحالي
  async getRequestsForRole(role: string, userId?: string) {
    // أدوار إدارية تعرض كل الطلبات
    if (role === "admin" || role === "mosque_management") {
      return this.getAllRequests();
    }

    // خدمة العملاء: فقط الطلبات بانتظار المراجعة
    if (role === "customer_service") {
      return this.getRequestsForCustomerService();
    }

    // مدير المشاريع: الحالات التي تتطلب اعتماد/قرار من المدير
    if (role === "project_manager") {
      const { data, error } = await supabase
        .from("requests")
        .select(`
          *,
          mosque:mosques(name, city:cities(name), district:districts(name)),
          request_type:request_types(name),
          requester:profiles!requests_beneficiary_id_fkey(full_name, phone)
        `)
        .in("current_status", [
          "accepted_initial",
          "pending_inspection_approval",
          "pending_pricing_approval",
          "pending_funding",
          "pending_final_approval",
          "pending_closure",
        ])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching project manager requests:", error);
        return [];
      }

      return data || [];
    }

    // الفني: الطلبات المسندة له في مراحل التنفيذ/المعاينة
    if (role === "technician") {
      if (!userId) return [];
      return this.getRequestsForTechnician(userId);
    }

    // خبير التسعير: الطلبات المسندة له في مرحلة التسعير
    if (role === "pricing_expert") {
      if (!userId) return [];
      return this.getRequestsForPricingExpert(userId);
    }

    // أي دور غير معروف لا يرى طلبات
    return [];
  },

  /**
   * Update request status with timeline entry
   */
  async updateStatus(
    requestId: string,
    newStatus: Database["public"]["Enums"]["request_status"],
    userId: string,
    notes?: string
  ): Promise<any> {
    const { data: currentRequest } = await supabase
      .from("requests")
      .select("current_status")
      .eq("id", requestId)
      .single();

    const oldStatus = currentRequest?.current_status || null;

    const { data, error } = await supabase
      .from("requests")
      .update({ current_status: newStatus })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await timelineService.addTimelineEntry(
      requestId,
      oldStatus,
      newStatus,
      userId,
      notes
    );

    return data;
  },

  /**
   * Customer Service: Accept initial request
   */
  async acceptInitial(requestId: string, userId: string) {
    return this.updateStatus(
      requestId,
      "accepted_initial",
      userId,
      "تم القبول المبدئي من خدمة العملاء"
    );
  },

  /**
   * Project Manager: Assign team
   */
  async assignTeam(
    requestId: string,
    technicianId: string,
    pricingExpertId: string,
    userId: string
  ) {
    const { data, error } = await supabase
      .from("requests")
      .update({
        assigned_technician_id: technicianId,
        assigned_pricing_expert_id: pricingExpertId,
        current_status: "pending_inspection",
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await timelineService.addTimelineEntry(
      requestId,
      "accepted_initial",
      "pending_inspection",
      userId,
      "تم تعيين الفريق الفني وخبير التسعير"
    );

    const requestData = data as any;
    await notificationService.createNotification(
      technicianId,
      "تكليف جديد",
      `تم تكليفك بمعاينة الطلب رقم ${requestData.rq_number}`,
      requestId
    );

    await notificationService.createNotification(
      pricingExpertId,
      "تكليف جديد",
      `تم تعيينك كخبير تسعير للطلب رقم ${requestData.rq_number}`,
      requestId
    );

    return data;
  },

  /**
   * Technician: Submit inspection report
   */
  async submitInspectionReport(requestId: string, userId: string) {
    return this.updateStatus(
      requestId,
      "pending_inspection_approval",
      userId,
      "تم رفع تقرير المعاينة"
    );
  },

  /**
   * Project Manager: Approve inspection
   */
  async approveInspection(requestId: string, userId: string, notes?: string) {
    return this.updateStatus(
      requestId,
      "pending_expert_pricing",
      userId,
      notes || "تم اعتماد تقرير المعاينة"
    );
  },

  /**
   * Pricing Expert: Submit pricing
   */
  async submitPricing(requestId: string, userId: string) {
    return this.updateStatus(
      requestId,
      "pending_pricing_approval",
      userId,
      "تم رفع التسعيرات"
    );
  },

  /**
   * Project Manager: Approve pricing
   */
  async approvePricing(requestId: string, userId: string, beneficiaryPhone: string) {
    const link = await approvalLinkService.createApprovalLink(requestId, beneficiaryPhone);

    const request = await this.updateStatus(
      requestId,
      "pending_beneficiary_approval",
      userId,
      "تم اعتماد التسعير وبانتظار موافقة المستفيد وتحديد الدعم"
    );

    console.log(`SMS to ${beneficiaryPhone}: ${approvalLinkService.generateApprovalUrl(link.token)}`);

    return request;
  },

  /**
   * Complete funding
   */
  async completeFunding(requestId: string, userId: string): Promise<any> {
    const { data: request, error: fetchError } = await supabase
      .from("requests")
      .select("*, mosques(name)")
      .eq("id", requestId)
      .single();

    if (fetchError) throw fetchError;
    if (!request) throw new Error("الطلب غير موجود");

    if (request.current_status !== "pending_funding") {
      throw new Error("الطلب ليس في مرحلة انتظار التمويل");
    }

    if (!request.approved_amount) {
      throw new Error("لم يتم تحديد المبلغ المعتمد بعد");
    }

    const { data, error } = await supabase
      .from("requests")
      .update({
        funding_completed: true,
        funding_completed_at: new Date().toISOString(),
        current_status: "pending_contractor_bids",
        updated_at: new Date().toISOString()
      })
      .eq("id", requestId)
      .select()
      .single();

    if (error) throw error;

    await supabase.from("request_status_history").insert({
      request_id: requestId,
      previous_status: "pending_funding",
      new_status: "pending_contractor_bids",
      changed_by: userId,
      notes: "تم تأكيد اكتمال التمويل"
    });

    if (request.assigned_technician_id) {
      await notificationService.createNotification(
        request.assigned_technician_id,
        "طلب رفع عروض المقاولين",
        `اكتمل تمويل طلب ${request.rq_number} - ${request.mosques?.name}. يرجى رفع عروض المقاولين`,
        requestId
      );
    }

    return data;
  },

  /**
   * Technician: Submit contractor bids
   */
  async submitContractorBids(requestId: string, userId: string) {
    const { count } = await supabase
      .from("contractor_bids")
      .select("*", { count: "exact", head: true })
      .eq("request_id", requestId);

    if (!count || count === 0) {
      console.warn("No contractor bids found, but allowing status change");
    }

    return this.updateStatus(
      requestId,
      "pending_contractor_selection",
      userId,
      "تم رفع عروض المقاولين"
    );
  },

  /**
   * Project Manager: Start work
   */
  async startWork(requestId: string, userId: string) {
    const request = await this.updateStatus(
      requestId,
      "in_progress",
      userId,
      "تم بدء تنفيذ الأعمال"
    );
    
    const req = request as any;
    if (req.assigned_technician_id) {
      await notificationService.createNotification(
        req.assigned_technician_id,
        "بدء العمل",
        `تم اعتماد بدء العمل في الطلب رقم ${req.rq_number}`,
        requestId
      );
    }
    
    return request;
  },

  /**
   * Technician: Submit final report
   */
  async submitFinalReport(requestId: string, userId: string) {
    return this.updateStatus(
      requestId,
      "pending_closure",
      userId,
      "تم رفع التقرير الختامي - بانتظار الإغلاق"
    );
  },

  /**
   * Project Manager: Close request
   */
  async closeRequest(requestId: string, userId: string, notes?: string): Promise<any> {
    return this.updateStatus(
      requestId,
      "closed",
      userId,
      notes || "تم إغلاق الطلب واكتمال المشروع"
    );
  },

  /**
   * Beneficiary: Approve request and select funding type
   */
  async approveBeneficiary(
    requestId: string,
    fundingType: string,
    amount?: number
  ): Promise<any> {
    const updateData: any = {
      funding_type: fundingType,
      current_status: "pending_funding",
      updated_at: new Date().toISOString()
    };
    
    if (amount) {
      updateData.approved_amount = amount;
    }

    const { data, error } = await supabase
      .from("requests")
      .update(updateData)
      .eq("id", requestId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      if (userId) {
        await supabase.from("request_status_history").insert({
          request_id: requestId,
          previous_status: "pending_beneficiary_approval",
          new_status: "pending_funding",
          changed_by: userId,
          notes: `تمت موافقة المستفيد - نوع التمويل: ${fundingType}`
        });
      }
    } catch (err) {
      console.error("Error adding timeline entry:", err);
    }

    return data;
  }
};