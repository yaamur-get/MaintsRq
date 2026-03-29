import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Building,
  Calendar,
  User,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Users,
  DollarSign,
  Link as LinkIcon,
  ArrowLeft,
  Building2,
  MapPin,
  Download,
  XCircle,
  Eye,
  Copy,
  Save,
  Pencil,
  X
} from "lucide-react";
import { getRequesterRoleLabel, REQUESTER_ROLE_LABELS, requestService, type RequesterRole } from "@/services/requestService";
import { inspectionService } from "@/services/inspectionService";
import { pricingService } from "@/services/pricingService";
import { authService } from "@/services/authService";
import { commonDataService, type City, type District, type RequestType } from "@/services/commonDataService";
import { mosqueService } from "@/services/mosqueService";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import Link from "next/link";
import { Input } from "@/components/ui/input";

type Request = any;
type RequestStatus = Database["public"]["Enums"]["request_status"];

type EditableRequestForm = {
  requester_name: string;
  requester_phone: string;
  requester_role: RequesterRole;
  request_type_id: string;
  city_id: string;
  district_id: string;
  mosque_id: string;
  description: string;
  audit_note: string;
};

type MosqueOption = {
  id: string;
  name: string;
  city_id: string;
  district_id: string;
};

// Component to show previous requests for the same mosque
function MosquePreviousRequests({ mosqueId, currentRequestId }: { mosqueId: string; currentRequestId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTranslations, setStatusTranslations] = useState<Record<string, { label: string; color: string }>>({});

  useEffect(() => {
    loadRequests();
    loadStatusTranslations();
  }, [mosqueId]);

  const loadStatusTranslations = async () => {
    try {
      const translations = await commonDataService.getStatusTranslations();
      const translationsMap: Record<string, { label: string; color: string }> = {};
      translations.forEach(t => {
        translationsMap[t.status_key] = {
          label: t.arabic_label,
          color: t.color_class
        };
      });
      setStatusTranslations(translationsMap);
    } catch (error) {
      console.error("Error loading status translations:", error);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("requests")
        .select("id, rq_number, current_status, created_at")
        .eq("mosque_id", mosqueId)
        .neq("id", currentRequestId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error loading mosque requests:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500 text-center py-4">جاري التحميل...</p>;
  }

  if (requests.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-4">لا توجد طلبات سابقة لهذا المسجد</p>;
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => {
        const statusInfo = statusTranslations[req.current_status || ""] || { label: req.current_status, color: "bg-slate-100 text-slate-800" };
        
        return (
          <Link key={req.id} href={`/dashboard/requests/${req.id}`}>
            <div className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-slate-900">{req.rq_number || req.id.substring(0, 8)}</span>
                <Badge className={`${statusInfo.color} text-xs`}>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">
                {new Date(req.created_at).toLocaleDateString("ar-SA")}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

const statusColors: Record<string, string> = {
  pending_review: "bg-orange-100 text-orange-800 border-orange-200",
  accepted_initial: "bg-charity-bg-calm text-charity-dark border-charity-medium",
  rejected: "bg-red-100 text-red-800 border-red-200",
  approved: "bg-charity-bg-calm text-charity-dark border-charity-medium",
  pending_inspection: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pending_inspection_approval: "bg-purple-100 text-purple-800 border-purple-200",
  pending_expert_pricing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pending_pricing_approval: "bg-pink-100 text-pink-800 border-pink-200",
  pending_beneficiary_approval: "bg-amber-100 text-amber-800 border-amber-200",
  pending_funding: "bg-gray-100 text-gray-800 border-gray-200",
  pending_contractor_bids: "bg-gray-100 text-gray-800 border-gray-200",
  pending_final_approval: "bg-gray-100 text-gray-800 border-gray-200",
  in_progress: "bg-gray-100 text-gray-800 border-gray-200",
  pending_final_report: "bg-gray-100 text-gray-800 border-gray-200",
  pending_closure: "bg-gray-100 text-gray-800 border-gray-200",
  closed: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

const getTimelineActorLabel = (entry: any) => {
  const fullName = entry?.changed_by_user?.full_name?.trim();
  if (fullName) return fullName;
  if (entry?.new_status === "pending_review") return "خدمة العملاء";
  return "النظام";
};

export default function RequestDetails() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusTranslations, setStatusTranslations] = useState<Record<string, { label: string; color: string }>>({});
  const [timeline, setTimeline] = useState<any[]>([]);
  const [inspectionItems, setInspectionItems] = useState<any[]>([]);
  const [expertPricing, setExpertPricing] = useState<any[]>([]);
  const [contractorBids, setContractorBids] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Team Assignment States
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [completingFunding, setCompletingFunding] = useState(false);

  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [savingRequestEdits, setSavingRequestEdits] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [mosques, setMosques] = useState<MosqueOption[]>([]);
  const [editForm, setEditForm] = useState<EditableRequestForm>({
    requester_name: "",
    requester_phone: "",
    requester_role: "mosque_congregation",
    request_type_id: "",
    city_id: "",
    district_id: "",
    mosque_id: "",
    description: "",
    audit_note: "",
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, [router.query.id]);

  const checkAuthAndLoadData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        router.push("/dashboard/login");
        return;
      }

      const role = await authService.getUserRole(user.id);
      if (!role) {
        router.push("/dashboard/login");
        return;
      }

      console.log("User role loaded:", role);
      setUserRole(role);

      // Load technicians for team assignment
      if (role === "project_manager") {
        await loadTeamMembers();
      }

      loadStatusTranslations();

      if (router.query.id) {
        const requestId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
        await loadRequest(requestId);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      router.push("/dashboard/login");
    }
  };

  const loadTeamMembers = async () => {
    try {
      console.log("🔍 Loading team members...");
      
      // Query from user_roles (no RLS) then join to profiles
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select(`
          user_id,
          profiles!inner(id, full_name, phone)
        `)
        .eq("role", "technician")
        .eq("is_active", true);

      console.log("📊 Team members query result:", { data, error });

      if (error) {
        console.error("❌ Error loading team members:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ No technicians found in database!");
      } else {
        console.log("✅ Found technicians:", data.length);
      }

      // Flatten the structure: extract profiles from nested join
      const technicians = (data || []).map((item: any) => item.profiles);
      setTeamMembers(technicians);
    } catch (error) {
      console.error("❌ Error loading team members:", error);
    }
  };

  const loadStatusTranslations = async () => {
    try {
      const translations = await commonDataService.getStatusTranslations();
      const translationsMap: Record<string, { label: string; color: string }> = {};
      translations.forEach(t => {
        translationsMap[t.status_key] = {
          label: t.arabic_label,
          color: t.color_class
        };
      });
      setStatusTranslations(translationsMap);
    } catch (error) {
      console.error("Error loading status translations:", error);
    }
  };

  const loadRequest = async (id: string) => {
    try {
      setLoading(true);
      // Load request data first (critical operation)
      const requestData = await requestService.getRequestById(id);

      console.log("Request data loaded:", requestData);
      console.log("Assigned technician:", requestData?.assigned_technician);
      console.log("Current status:", requestData?.current_status);

      setRequest(requestData);

      // Pre-fill selection if already assigned
      if (requestData?.assigned_technician_id) setSelectedTechnician(requestData.assigned_technician_id);

      // Load timeline separately so its failure doesn't block request display
      requestService.getRequestTimeline(id)
        .then(timelineData => setTimeline(timelineData))
        .catch(err => {
          console.error("Error loading timeline (non-critical):", err);
          setTimeline([]);
        });

      // Load additional data based on status
      if (requestData.current_status && [
        "pending_inspection_approval",
        "pending_expert_pricing",
        "pending_pricing_approval",
        "pending_beneficiary_approval",
        "pending_funding",
        "pending_contractor_bids",
        "pending_final_approval",
        "in_progress",
        "pending_final_report",
        "pending_closure",
        "closed"
      ].includes(requestData.current_status)) {
        const items = await inspectionService.getInspectionItems(id);
        setInspectionItems(items);
      }

      if (requestData.current_status && [
        "pending_pricing_approval",
        "pending_beneficiary_approval",
        "pending_funding",
        "pending_contractor_bids",
        "pending_final_approval",
        "in_progress",
        "pending_final_report",
        "pending_closure",
        "closed"
      ].includes(requestData.current_status)) {
        const pricing = await pricingService.getExpertPricing(id);
        setExpertPricing(pricing);
      }

      if (requestData.current_status && [
        "pending_final_approval",
        "in_progress",
        "pending_final_report",
        "pending_closure",
        "closed"
      ].includes(requestData.current_status)) {
        const bids = await pricingService.getContractorBids(id);
        setContractorBids(bids);
      }

    } catch (error) {
      console.error("Error loading request data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: RequestStatus, notes?: string) => {
    try {
      await requestService.updateRequestStatus(id as string, newStatus, notes);
      await loadRequest(id as string);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleAssignTeam = async () => {
    if (!selectedTechnician) return;
    try {
      setAssigningTeam(true);
      
      const requestId = Array.isArray(id) ? id[0] : id;
      
      // Update request with assigned assigned_technician
      const { error } = await (supabase as any)
        .from("requests")
        .update({ 
          assigned_technician_id: selectedTechnician,
          current_status: "pending_inspection" 
        })
        .eq("id", requestId);

      if (error) throw error;
      
      // Add timeline entry
      await requestService.updateRequestStatus(
        requestId as string, 
        "pending_inspection", 
        "تم تعيين الفني وتحويل الطلب للمعاينة"
      );

      await loadRequest(requestId as string);
    } catch (error) {
      console.error("Error assigning team:", error);
    } finally {
      setAssigningTeam(false);
    }
  };

  const handleCompleteFunding = async () => {
    try {
      setCompletingFunding(true);
      
      const requestId = Array.isArray(id) ? id[0] : id;
      
      // Update request funding status
      const { error } = await (supabase as any)
        .from("requests")
        .update({ 
          funding_completed: true,
          current_status: "pending_contractor_bids" 
        })
        .eq("id", requestId);

      if (error) throw error;

      // Add timeline entry
      await requestService.updateRequestStatus(
        requestId as string, 
        "pending_contractor_bids", 
        "تم تأكيد اكتمال التمويل، بانتظار عروض المقاولين"
      );

      await loadRequest(requestId as string);
    } catch (error) {
      console.error("Error completing funding:", error);
    } finally {
      setCompletingFunding(false);
    }
  };

  const loadEditReferenceData = async (cityId?: string) => {
    const [citiesData, requestTypesData, mosquesData] = await Promise.all([
      commonDataService.getAllCities(),
      commonDataService.getAllRequestTypes(),
      mosqueService.getAllMosques(),
    ]);

    setCities(citiesData);
    setRequestTypes(requestTypesData);
    setMosques((mosquesData || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      city_id: m.city_id,
      district_id: m.district_id,
    })));

    if (cityId) {
      const districtsData = await commonDataService.getDistrictsByCity(cityId);
      setDistricts(districtsData);
    } else {
      setDistricts([]);
    }
  };

  const handleStartEditRequest = async () => {
    if (!request) return;

    const nextForm: EditableRequestForm = {
      requester_name: request.beneficiary_name || request.requester?.full_name || "",
      requester_phone: request.beneficiary_phone || request.requester?.phone || "",
      requester_role: (request.requester_role || "mosque_congregation") as RequesterRole,
      request_type_id: request.request_type_id || request.request_type?.id || "",
      city_id: request.mosque?.city_id || request.mosque?.city?.id || "",
      district_id: request.mosque?.district_id || request.mosque?.district?.id || "",
      mosque_id: request.mosque_id || request.mosque?.id || "",
      description: request.description || "",
      audit_note: "",
    };

    setEditForm(nextForm);
    await loadEditReferenceData(nextForm.city_id);
    setIsEditingRequest(true);
  };

  const handleCancelEditRequest = () => {
    setIsEditingRequest(false);
    setDistricts([]);
  };

  const handleEditCityChange = async (cityId: string) => {
    setEditForm((prev) => ({ ...prev, city_id: cityId, district_id: "", mosque_id: "" }));
    const districtsData = await commonDataService.getDistrictsByCity(cityId);
    setDistricts(districtsData);
  };

  const handleSaveRequestEdits = async () => {
    if (!request) return;

    if (!editForm.requester_name || !editForm.requester_phone || !editForm.request_type_id || !editForm.mosque_id || !editForm.description) {
      alert("يرجى تعبئة جميع الحقول المطلوبة قبل الحفظ");
      return;
    }

    try {
      setSavingRequestEdits(true);

      await requestService.updatePendingReviewRequest(request.id, {
        requester_name: editForm.requester_name,
        requester_phone: editForm.requester_phone,
        requester_role: editForm.requester_role,
        request_type_id: editForm.request_type_id,
        mosque_id: editForm.mosque_id,
        description: editForm.description,
        audit_note: editForm.audit_note,
      });

      await loadRequest(request.id);
      setIsEditingRequest(false);
      alert("تم تحديث بيانات الطلب بنجاح");
    } catch (error: any) {
      console.error("Error saving request edits:", error);
      alert(error?.message || "تعذر حفظ التعديلات");
    } finally {
      setSavingRequestEdits(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout userRole={userRole as any}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-charity-primary mx-auto mb-4"></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!request) {
    return (
      <DashboardLayout userRole={userRole as any}>
        <Alert className="bg-red-50 border-red-200">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-800">
            لم يتم العثور على الطلب
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const totalExpertPrice = expertPricing.reduce((sum, item) => sum + (item.estimated_price || 0), 0);
  const totalContractorPrice = contractorBids
    .filter(bid => bid.is_selected)
    .reduce((sum, bid) => sum + (bid.bid_amount || 0), 0);
  const canEditRequestData = userRole === "customer_service" && request.current_status === "pending_review";
  const filteredMosques = editForm.district_id
    ? mosques.filter((mosque) => mosque.district_id === editForm.district_id)
    : [];
  const requesterRoleOptions = Object.entries(REQUESTER_ROLE_LABELS);

  return (
    <>
      <SEO 
        title={`طلب ${request.rq_number || request.id} - نظام إدارة صيانة المساجد`}
        description="تفاصيل الطلب"
      />
      
      <DashboardLayout userRole={userRole as any}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-charity-primary" />
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  رقم الطلب: {request.rq_number || request.id}
                </h2>
              </div>
            </div>
            <Badge className={`${statusTranslations[request.current_status || ""]?.color || "bg-slate-100 text-slate-800"} border-0 hover:bg-opacity-80`}>
              {statusTranslations[request.current_status || ""]?.label || request.current_status}
            </Badge>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Right Column - Request Info */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Request Details */}
              <Card className="border-0 shadow-md">
                <CardHeader className="bg-gradient-to-l from-charity-bg-calm to-white border-b">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-3 rounded-xl">
                        <FileText className="w-6 h-6 text-charity-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl">تفاصيل الطلب</CardTitle>
                        <CardDescription>
                          {isEditingRequest ? "وضع تعديل بيانات الطلب" : "معلومات شاملة عن الطلب"}
                        </CardDescription>
                      </div>
                    </div>
                    {canEditRequestData && !isEditingRequest && (
                      <Button variant="outline" onClick={handleStartEditRequest}>
                        <Pencil className="w-4 h-4 ml-2" />
                        تعديل البيانات
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {!isEditingRequest ? (
                    <>
                      {/* المسجد */}
                      <div className="grid gap-3">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="bg-white p-2 rounded-lg">
                            <Building2 className="w-5 h-5 text-charity-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{request.mosque?.name}</p>
                            <p className="text-sm text-slate-600">{request.mosque?.city?.name} - {request.mosque?.district?.name}</p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* مقدم الطلب */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <div className="bg-white p-2 rounded-lg border">
                            <User className="w-5 h-5 text-charity-primary" />
                          </div>
                          مقدم الطلب
                        </h3>
                        <div className="grid md:grid-cols-3 gap-3">
                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="bg-white p-2 rounded-lg border">
                              <User className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">الاسم</p>
                              <p className="font-medium text-slate-900">
                                {request.beneficiary_name || request.requester?.full_name || "غير محدد"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="bg-white p-2 rounded-lg border">
                              <Phone className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">رقم الجوال</p>
                              <p className="font-medium text-slate-900" dir="ltr">
                                {request.beneficiary_phone || request.requester?.phone || "غير محدد"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                            <div className="bg-white p-2 rounded-lg border">
                              <Users className="w-4 h-4 text-slate-600" />
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">الصفة</p>
                              <p className="font-medium text-slate-900">
                                {getRequesterRoleLabel(request.requester_role)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* تفاصيل الطلب */}
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <div className="flex items-center">
                            <FileText className="w-5 h-5 text-charity-primary" />
                          </div>
                          تفاصيل الاحتياج
                        </h3>
                        <div className="space-y-3">
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">نوع الاحتياج</p>
                            <p className="font-medium text-slate-900">
                              {request.request_type?.name || "غير محدد"}
                            </p>
                          </div>

                          <div className="p-3 bg-slate-50 rounded-lg">
                            <p className="text-xs text-slate-500 mb-1">الوصف التفصيلي</p>
                            <p className="text-sm text-slate-900 leading-relaxed">
                              {request.description || "لا يوجد وصف"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                            <Calendar className="w-4 h-4 text-slate-600" />
                            <div>
                              <p className="text-xs text-slate-500">تاريخ التقديم</p>
                              <p className="text-sm font-medium text-slate-900">
                                {new Date(request.created_at).toLocaleDateString("ar-SA", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric"
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-700" />
                        <AlertDescription className="text-blue-900">
                          وضع تصحيح بيانات الطلب مفعل. يمكن تعديل البيانات دون تغيير حالة الطلب.
                        </AlertDescription>
                      </Alert>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>اسم مقدم الطلب</Label>
                          <Input
                            value={editForm.requester_name}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, requester_name: e.target.value }))}
                            placeholder="اسم مقدم الطلب"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>رقم الجوال</Label>
                          <Input
                            value={editForm.requester_phone}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, requester_phone: e.target.value }))}
                            placeholder="05xxxxxxxx"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>صفة مقدم الطلب</Label>
                          <Select
                            value={editForm.requester_role}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, requester_role: value as RequesterRole }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الصفة" />
                            </SelectTrigger>
                            <SelectContent>
                              {requesterRoleOptions.map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>نوع الطلب</Label>
                          <Select
                            value={editForm.request_type_id}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, request_type_id: value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="اختر نوع الطلب" />
                            </SelectTrigger>
                            <SelectContent>
                              {requestTypes.map((requestType) => (
                                <SelectItem key={requestType.id} value={requestType.id}>{requestType.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>المدينة</Label>
                          <Select value={editForm.city_id} onValueChange={handleEditCityChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المدينة" />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>الحي</Label>
                          <Select
                            value={editForm.district_id}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, district_id: value, mosque_id: "" }))}
                            disabled={!editForm.city_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={editForm.city_id ? "اختر الحي" : "اختر المدينة أولاً"} />
                            </SelectTrigger>
                            <SelectContent>
                              {districts.map((district) => (
                                <SelectItem key={district.id} value={district.id}>{district.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>المسجد</Label>
                          <Select
                            value={editForm.mosque_id}
                            onValueChange={(value) => setEditForm((prev) => ({ ...prev, mosque_id: value }))}
                            disabled={!editForm.district_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={editForm.district_id ? "اختر المسجد" : "اختر الحي أولاً"} />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredMosques.map((mosque) => (
                                <SelectItem key={mosque.id} value={mosque.id}>{mosque.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>الوصف / الملاحظات</Label>
                          <Textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                            rows={5}
                            placeholder="اكتب تفاصيل الطلب"
                          />
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>ملاحظة التعديل (اختياري)</Label>
                          <Textarea
                            value={editForm.audit_note}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, audit_note: e.target.value }))}
                            rows={3}
                            placeholder="مثال: تم تصحيح رقم الجوال بناء على تواصل هاتفي"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={handleSaveRequestEdits}
                          disabled={savingRequestEdits}
                          className="bg-charity-primary hover:bg-charity-dark"
                        >
                          {savingRequestEdits ? (
                            <>
                              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                              جارٍ الحفظ...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 ml-2" />
                              حفظ التعديلات
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={handleCancelEditRequest} disabled={savingRequestEdits}>
                          <X className="w-4 h-4 ml-2" />
                          إلغاء
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Team Assignment Section */}
              {userRole === "project_manager" && 
               request?.current_status === "accepted_initial" && (
                <Card className="border-2 border-charity-medium bg-charity-bg-calm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-charity-dark">
                      <Users className="w-6 h-6" />
                      تعيين الفني المسؤول
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>الفني المسؤول عن المعاينة</Label>
                      <select
                        value={selectedTechnician}
                        onChange={(e) => setSelectedTechnician(e.target.value)}
                        className="w-full p-3 border border-charity-medium rounded-lg focus:ring-2 focus:ring-charity-primary bg-white"
                      >
                        <option value="">اختر الفني</option>
                        {teamMembers.map((tech) => (
                          <option key={tech.id} value={tech.id}>
                            {tech.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      onClick={handleAssignTeam}
                      disabled={assigningTeam || !selectedTechnician}
                      className="w-full bg-charity-primary hover:bg-charity-dark text-white py-6 text-lg"
                    >
                      {assigningTeam ? (
                        <>
                          <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                          جاري التعيين...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-5 h-5 ml-2" />
                          تعيين الفني وإرسال للمعاينة
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Funding Completion Section */}
              {userRole === "project_manager" && 
               request?.current_status === "pending_funding" && (
                <Card className="border-charity-medium bg-charity-bg-calm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-charity-dark">
                      <DollarSign className="w-5 h-5" />
                      تأكيد اكتمال التمويل
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 p-4 bg-white rounded-lg">
                      <div>
                        <p className="text-sm text-slate-600 mb-1">المبلغ المعتمد</p>
                        <p className="text-2xl font-bold text-charity-primary">
                          {request.approved_amount?.toLocaleString("ar-SA")} ريال
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">نوع الدعم</p>
                        <Badge variant="outline" className="text-base">
                          {request.funding_type === "ehsan" && "إحسان"}
                          {request.funding_type === "direct_donor" && "متبرع مباشر"}
                          {request.funding_type === "store_opportunity" && "فرصة متجر"}
                        </Badge>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-sm text-slate-600 mb-1">حالة التمويل</p>
                        <p className="font-medium text-slate-900">
                          {request.funding_completed ? "✅ مكتمل" : "⏳ بانتظار الاكتمال"}
                        </p>
                      </div>
                    </div>

                    <Alert className="bg-charity-bg-calm border-charity-medium">
                      <AlertCircle className="h-5 w-5 text-charity-dark" />
                      <AlertDescription className="text-charity-dark">
                        <strong>تحذير:</strong> بعد تأكيد اكتمال التمويل، سيتم نقل الطلب تلقائياً إلى مرحلة طلب عروض المقاولين، 
                        وسيتم إرسال إشعار للفني لرفع العروض.
                      </AlertDescription>
                    </Alert>

                    <Button
                      onClick={handleCompleteFunding}
                      disabled={completingFunding || request.funding_completed}
                      className="w-full bg-charity-primary hover:bg-charity-dark"
                      size="lg"
                    >
                      {completingFunding ? (
                        <>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري التأكيد...
                        </>
                      ) : request.funding_completed ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 ml-2" />
                          تم تأكيد الاكتمال
                        </>
                      ) : (
                        <>
                          <DollarSign className="w-4 h-4 ml-2" />
                          تأكيد اكتمال التمويل
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Beneficiary Approval Link Section */}
              {request?.current_status === "pending_beneficiary_approval" && (
                <Card className="border-charity-medium bg-charity-bg-calm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-charity-dark">
                      <LinkIcon className="w-5 h-5" />
                      رابط موافقة المستفيد
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert className="bg-charity-bg-calm border-charity-medium">
                      <AlertCircle className="h-5 w-5 text-charity-dark" />
                      <AlertDescription className="text-charity-dark">
                        قم بإرسال هذا الرابط للمستفيد عبر الواتساب أو الرسائل النصية لموافقته على التسعير وتحديد قناة الدعم المالي
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3 p-4 bg-white rounded-lg">
                      <div>
                        <p className="text-sm text-slate-600 mb-1">اسم المستفيد</p>
                        <p className="font-bold text-slate-900">{request.beneficiary_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">صفة مقدم الطلب</p>
                        <p className="font-bold text-slate-900">{getRequesterRoleLabel(request.requester_role)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-1">رقم الجوال (للتحقق)</p>
                        <p className="font-mono text-lg text-slate-900 tracking-wider">{request.beneficiary_phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 mb-2">الرابط</p>
                        <div className="flex gap-2">
                          <Input
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/approval/${request.id}`}
                            className="font-mono text-sm"
                            dir="ltr"
                          />
                          <Button
                            onClick={() => {
                              const link = `${window.location.origin}/approval/${request.id}`;
                              navigator.clipboard.writeText(link);
                              alert("✅ تم نسخ الرابط!");
                            }}
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-sm font-medium text-slate-700 mb-2">📝 تعليمات للمستفيد:</p>
                      <ol className="text-sm text-slate-600 space-y-1 mr-4" style={{ listStyle: "decimal" }}>
                        <li>افتح الرابط في المتصفح</li>
                        <li>أدخل رقم جوالك المسجل في الطلب ({request.beneficiary_phone})</li>
                        <li>راجع التسعيرات والتفاصيل</li>
                        <li>اختر قناة الدعم المالي (إحسان / متبرع مباشر / فرصة متجر)</li>
                        <li>وافق على الشروط والأحكام ثم أرسل</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabs for different sections */}
              <Tabs defaultValue="timeline" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
                  <TabsTrigger value="inspection">المعاينة</TabsTrigger>
                  <TabsTrigger value="pricing">التسعيرات</TabsTrigger>
                  <TabsTrigger value="files">الملفات</TabsTrigger>
                </TabsList>

                {/* Timeline Tab */}
                <TabsContent value="timeline">
                  <Card>
                    <CardHeader>
                      <CardTitle>سجل الحالات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {timeline.length === 0 ? (
                          <p className="text-center text-slate-500 py-8">لا توجد سجلات</p>
                        ) : (
                          timeline.map((entry, index) => (
                            <div key={entry.id} className="flex gap-4">
                              <div className="flex flex-col items-center">
                                <div className="w-10 h-10 rounded-full bg-charity-bg-calm flex items-center justify-center">
                                  <CheckCircle2 className="w-5 h-5 text-charity-primary" />
                                </div>
                                {index !== timeline.length - 1 && (
                                  <div className="w-0.5 h-full bg-slate-200 my-2"></div>
                                )}
                              </div>
                              <div className="flex-1 pb-8">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-medium text-slate-900">
                                    {statusTranslations[entry.new_status]?.label || entry.new_status}
                                  </p>
                                  <p className="text-sm text-slate-500">
                                    {new Date(entry.created_at).toLocaleDateString("ar-SA")}
                                  </p>
                                </div>
                                <p className="text-sm text-slate-600">
                                  بواسطة: {getTimelineActorLabel(entry)}
                                </p>
                                {entry.notes && (
                                  <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-2 rounded">
                                    {entry.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Inspection Tab */}
                <TabsContent value="inspection">
                  <Card>
                    <CardHeader>
                      <CardTitle>بنود المعاينة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {inspectionItems.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">
                          لم يتم إضافة بنود معاينة بعد
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {inspectionItems.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="font-medium text-slate-900">{item.main_item}</h4>
                                  <p className="text-sm text-slate-600">{item.sub_item}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  بند {item.item_number}
                                </Badge>
                              </div>
                              
                              {item.specifications && (
                                <p className="text-sm text-slate-700 mb-3">{item.specifications}</p>
                              )}

                              {/* Photos */}
                              {item.images && item.images.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                  {item.images.map((img: any) => (
                                    <div key={img.id} className="aspect-square rounded-lg overflow-hidden border">
                                      <img 
                                        src={img.image_url} 
                                        alt={`صورة ${item.item_number}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Pricing Tab */}
                <TabsContent value="pricing">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>تسعير الخبير</CardTitle>
                        {totalExpertPrice > 0 && (
                          <div className="text-left">
                            <p className="text-sm text-slate-500">الإجمالي التقديري</p>
                            <p className="text-2xl font-bold text-charity-primary">
                              {totalExpertPrice.toLocaleString("ar-SA")} ريال
                            </p>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {expertPricing.length === 0 ? (
                        <p className="text-center text-slate-500 py-8">
                          لم يتم إضافة تسعيرات بعد
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {expertPricing.map((pricing) => (
                            <div key={pricing.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-medium text-slate-900">{pricing.item?.main_item}</p>
                                <p className="text-sm text-slate-600">{pricing.item?.sub_item}</p>
                              </div>
                              <div className="text-left">
                                <p className="text-lg font-bold text-charity-primary">
                                  {pricing.estimated_price?.toLocaleString("ar-SA")} ريال
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Files Tab - NEW */}
                <TabsContent value="files">
                  <Card>
                    <CardHeader>
                      <CardTitle>الملفات والمرفقات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Inspection Report */}
                        {inspectionItems.length > 0 && (
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">تقرير المعاينة</p>
                                  <p className="text-sm text-slate-600">{inspectionItems.length} بند</p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm">
                                <Download className="w-4 h-4 ml-2" />
                                تحميل
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Contractor Bids */}
                        {contractorBids.filter(bid => bid.document_url).map((bid) => (
                          <div key={bid.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-charity-bg-calm flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-charity-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">عرض سعر - {bid.contractor?.name}</p>
                                  <p className="text-sm text-slate-600">{bid.item?.main_item}</p>
                                </div>
                              </div>
                              <a href={bid.document_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <Download className="w-4 h-4 ml-2" />
                                  تحميل
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}

                        {inspectionItems.length === 0 && contractorBids.filter(bid => bid.document_url).length === 0 && (
                          <p className="text-center text-slate-500 py-8">لا توجد ملفات مرفقة</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            {/* Left Column - Actions & Team */}
            <div className="space-y-6">
              {/* Team Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الفريق المسؤول</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {request.assigned_technician ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                      <div className="bg-white p-2 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-charity-bg-calm flex items-center justify-center">
                          <User className="w-5 h-5 text-charity-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">الفني</p>
                        <p className="font-medium text-slate-900">
                          {request.assigned_technician.full_name}
                        </p>
                        {request.assigned_technician.phone && (
                          <p className="text-xs text-slate-500" dir="ltr">
                            {request.assigned_technician.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : request.assigned_technician_id ? (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="bg-white p-2 rounded-lg">
                        <div className="w-10 h-10 rounded-full bg-charity-bg-calm flex items-center justify-center">
                          <User className="w-5 h-5 text-charity-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">الفني</p>
                        <p className="font-medium text-slate-900">تم التعيين</p>
                        <p className="text-xs text-amber-600">ID: {request.assigned_technician_id.substring(0, 8)}...</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-sm text-red-600 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        لم يتم تعيين فني
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Actions Card - يتغير حسب الدور والمرحلة */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">الإجراءات</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {/* Debug info */}
                  {process.env.NODE_ENV === "development" && (
                    <div className="p-2 bg-slate-100 rounded text-xs mb-4">
                      <p>User Role: {userRole || "Not loaded"}</p>
                      <p>Current Status: {request?.current_status || "N/A"}</p>
                    </div>
                  )}

                  {/* Customer Service Actions */}
                  {userRole === "customer_service" && request.current_status === "pending_review" && (
                    <>
                      {!isEditingRequest && (
                        <Button variant="outline" className="w-full" onClick={handleStartEditRequest}>
                          <Pencil className="w-4 h-4 ml-2" />
                          تعديل البيانات
                        </Button>
                      )}

                      {isEditingRequest && (
                        <Alert className="bg-amber-50 border-amber-200 mb-2">
                          <AlertCircle className="h-4 w-4 text-amber-700" />
                          <AlertDescription className="text-amber-900 text-sm">
                            أنت الآن في وضع تعديل البيانات. احفظ أو ألغِ التعديلات قبل القبول/الرفض.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Button 
                        className="w-full bg-charity-primary hover:bg-charity-dark"
                        disabled={isEditingRequest}
                        onClick={() => handleStatusUpdate("accepted_initial", "تم القبول أولي")}
                      >
                        <CheckCircle2 className="w-4 h-4 ml-2" />
                        قبول أولي
                      </Button>
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        disabled={isEditingRequest}
                        onClick={() => handleStatusUpdate("rejected", "تم الرفض")}
                      >
                        <XCircle className="w-4 h-4 ml-2" />
                        رفض الطلب
                      </Button>
                    </>
                  )}

                  {/* Project Manager Actions */}
                  {userRole === "project_manager" && request.current_status === "accepted_initial" && (
                    <Button 
                      variant="outline" 
                      className="w-full cursor-not-allowed bg-slate-50"
                      disabled
                    >
                      <Users className="w-4 h-4 ml-2" />
                      يرجى تعيين الفريق أولاً
                    </Button>
                  )}

                  {userRole === "project_manager" && request.current_status === "pending_inspection_approval" && (
                    <Button 
                      className="w-full bg-charity-primary hover:bg-charity-dark"
                      onClick={() => handleStatusUpdate("pending_expert_pricing", "تم اعتماد المعاينة وتحويل للتسعير")}
                    >
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      اعتماد المعاينة وتحويل للتسعير
                    </Button>
                  )}

                  {userRole === "project_manager" && request.current_status === "pending_pricing_approval" && (
                    <Button 
                      className="w-full bg-charity-primary hover:bg-charity-dark"
                      onClick={() => handleStatusUpdate("pending_beneficiary_approval", "تم اعتماد التسعير - بانتظار موافقة المستفيد")}
                    >
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      اعتماد التسعير وإرسال للمستفيد
                    </Button>
                  )}

                  {/* Technician Actions */}
                  {userRole === "technician" && request.current_status === "pending_inspection" && (
                    <Link href={`/dashboard/requests/inspection/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary hover:bg-charity-dark">
                        <FileText className="w-4 h-4 ml-2" />
                        بدء المعاينة
                      </Button>
                    </Link>
                  )}

                  {/* Pricing Expert Actions */}
                  {userRole === "pricing_expert" && request.current_status === "pending_expert_pricing" && (
                    <Link href={`/dashboard/requests/pricing/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary hover:bg-charity-dark">
                        <DollarSign className="w-4 h-4 ml-2" />
                        رفع التسعيرات
                      </Button>
                    </Link>
                  )}

                  {/* Technician - Upload Contractor Bids */}
                  {userRole === "technician" && request.current_status === "pending_contractor_bids" && (
                    <Link href={`/dashboard/requests/bids/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary hover:bg-charity-dark">
                        <FileText className="w-4 h-4 ml-2" />
                        رفع عروض المقاولين
                      </Button>
                    </Link>
                  )}

                  {/* Project Manager - Start Work */}
                  {userRole === "project_manager" && request.current_status === "pending_contractor_selection" && (
                    <Button 
                      className="w-full bg-charity-primary hover:bg-charity-dark"
                      onClick={() => handleStatusUpdate("in_progress", "تم اعتماد المقاول وبدء الأعمال")}
                    >
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      اعتماد المقاول وبدء الأعمال
                    </Button>
                  )}

                  {/* Fallback message if no actions available */}
                  {!userRole && (
                    <div className="p-4 bg-slate-50 rounded-lg text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-600">جاري التحميل...</p>
                    </div>
                  )}

                  {userRole && (
                    (() => {
                      const hasAction = 
                        (userRole === "customer_service" && request.current_status === "pending_review") ||
                        (userRole === "project_manager" && ["accepted_initial", "pending_inspection_approval", "pending_pricing_approval", "pending_contractor_selection"].includes(request.current_status || "")) ||
                        (userRole === "technician" && ["pending_inspection", "pending_contractor_bids"].includes(request.current_status || "")) ||
                        (userRole === "pricing_expert" && request.current_status === "pending_expert_pricing");
                      
                      if (!hasAction) {
                        return (
                          <div className="p-4 bg-slate-50 rounded-lg text-center">
                            <Eye className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm text-slate-600">لا توجد إجراءات متاحة في هذه المرحلة</p>
                            <p className="text-xs text-slate-500 mt-1">
                              الحالة الحالية: {statusTranslations[request.current_status || ""]?.label || request.current_status}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </CardContent>
              </Card>

              {/* Mosque Previous Requests Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">طلبات المسجد السابقة</CardTitle>
                </CardHeader>
                <CardContent>
                  <MosquePreviousRequests mosqueId={request.mosque_id} currentRequestId={request.id} />
                </CardContent>
              </Card>

              {/* Funding Card - يظهر في المراحل المتقدمة */}
              {request.current_status && [
                "pending_beneficiary_approval",
                "pending_funding",
                "pending_contractor_bids",
                "pending_final_approval",
                "in_progress"
              ].includes(request.current_status) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">التمويل</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">المبلغ المطلوب</span>
                        <span className="font-bold text-slate-900">
                          {totalExpertPrice.toLocaleString("ar-SA")} ريال
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">قناة الدعم</span>
                        <Badge variant="outline">
                          {request.funding_type === "ehsan" && "إحسان"}
                          {request.funding_type === "direct_donor" && "متبرع مباشر"}
                          {request.funding_type === "store_opportunity" && "فرصة متجر"}
                          {!request.funding_type && "لم يتم التحديد"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">حالة التمويل</span>
                        <Badge className={request.funding_completed ? "bg-charity-primary text-white" : "bg-charity-medium text-white"}>
                          {request.funding_completed ? "مكتمل" : "غير مكتمل"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}