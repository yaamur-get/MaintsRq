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
import { Checkbox } from "@/components/ui/checkbox";
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
  X,
  RefreshCw,
  Send,
  Mail,
  Award
} from "lucide-react";
import { getRequesterRoleLabel, REQUESTER_ROLE_LABELS, requestService, type RequesterRole } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import { authService } from "@/services/authService";
import { commonDataService, type City, type District, type RequestType } from "@/services/commonDataService";
import { mosqueService } from "@/services/mosqueService";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { fetchInspectionReport, flattenInspectionReportItems, getReportStatusLabel, type ExternalInspectionResponse } from "@/services/inspectionReportService";

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

type FundingType = "ehsan" | "direct_donor" | "store_opportunity";

type FundingChannelData = {
  directDonor?: {
    proofFileUrl?: string;
    proofFileName?: string;
  };
  storeOpportunity?: {
    opportunityUrl?: string;
  };
  ehsan?: {
    checklist: {
      submitted: boolean;
      approved: boolean;
      requirementsUploaded: boolean;
      amountReceived: boolean;
    };
  };
};

const FUNDING_TYPE_LABELS: Record<FundingType, string> = {
  ehsan: "إحسان",
  direct_donor: "متبرع مباشر",
  store_opportunity: "فرصة متجر",
};

const REQUIRED_FUNDING_CONFIRMATION_TEXT = "تم اكتمال المبلغ";

const parseFundingChannelData = (value: any): FundingChannelData => {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (typeof value === "object") return value as FundingChannelData;
  return {};
};

type TechnicianWorkload = {
  id: string;
  full_name: string;
  phone?: string | null;
  currentRequests: number;
  totalRequests: number;
  inProgressCount: number;
  pendingInspectionCount: number;
  pendingFinalReportCount: number;
  newRequestsCount: number;
  overdueCount: number;
  pressureLabel: "متاح" | "ضغط متوسط" | "ضغط عالي";
  pressureClassName: string;
  commitmentLabel: "مهم" | "مستقر" | "يحتاج متابعة";
  commitmentClassName: string;
};

const ACTIVE_TECHNICIAN_STATUSES = [
  "pending_inspection",
  "in_progress",
  "pending_final_report",
  "pending_contractor_bids",
] as const;

const getTechnicianPressure = (currentRequests: number, overdueCount: number) => {
  if (overdueCount >= 2 || currentRequests >= 6) {
    return {
      label: "ضغط عالي" as const,
      className: "bg-red-100 text-red-800 border-red-200",
      rank: 3,
    };
  }

  if (overdueCount >= 1 || currentRequests >= 3) {
    return {
      label: "ضغط متوسط" as const,
      className: "bg-amber-100 text-amber-800 border-amber-200",
      rank: 2,
    };
  }

  return {
    label: "متاح" as const,
    className: "bg-green-100 text-green-800 border-green-200",
    rank: 1,
  };
};

const getCommitmentIndicator = (overdueCount: number, inProgressCount: number) => {
  if (overdueCount === 0 && inProgressCount <= 2) {
    return {
      label: "مهم" as const,
      className: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }

  if (overdueCount <= 1) {
    return {
      label: "مستقر" as const,
      className: "bg-slate-100 text-slate-700 border-slate-200",
    };
  }

  return {
    label: "يحتاج متابعة" as const,
    className: "bg-orange-100 text-orange-800 border-orange-200",
  };
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
  beneficiary_approved_pricing: "bg-emerald-100 text-emerald-800 border-emerald-200",
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

const buildInspectionDisplayItemId = (rqNumber: string | undefined, itemIndex: number) => {
  const safeRqNumber = rqNumber || "RQ-UNK";
  return `${safeRqNumber}-B-${String(itemIndex + 1).padStart(2, "0")}`;
};

export default function RequestDetails() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusTranslations, setStatusTranslations] = useState<Record<string, { label: string; color: string }>>({});
  const [timeline, setTimeline] = useState<any[]>([]);
  const [expertPricing, setExpertPricing] = useState<any[]>([]);
  const [contractorBids, setContractorBids] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [externalReport, setExternalReport] = useState<ExternalInspectionResponse | null>(null);
  const [loadingExternalReport, setLoadingExternalReport] = useState(false);
  
  // Team Assignment States
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [teamMembers, setTeamMembers] = useState<TechnicianWorkload[]>([]);
  const [assigningTeam, setAssigningTeam] = useState(false);
  const [completingFunding, setCompletingFunding] = useState(false);
  const [completingExecution, setCompletingExecution] = useState(false);
  const [fundingCompletionText, setFundingCompletionText] = useState("");
  const [fundingValidationError, setFundingValidationError] = useState("");
  const [executionValidationError, setExecutionValidationError] = useState("");
  const [firstPaymentFollowedUp, setFirstPaymentFollowedUp] = useState(false);
  const [photographerEmail, setPhotographerEmail] = useState("");
  const [executionNotes, setExecutionNotes] = useState("");
  const [executionReceiptFile, setExecutionReceiptFile] = useState<File | null>(null);
  const [submittingDeliveryReport, setSubmittingDeliveryReport] = useState(false);
  const [deliveryReportValidationError, setDeliveryReportValidationError] = useState("");
  const [deliveryReportFile, setDeliveryReportFile] = useState<File | null>(null);
  const [deliveryReportNotes, setDeliveryReportNotes] = useState("");
  const [directDonorProofFile, setDirectDonorProofFile] = useState<File | null>(null);
  const [storeOpportunityUrl, setStoreOpportunityUrl] = useState("");
  const [ehsanChecklist, setEhsanChecklist] = useState({
    submitted: false,
    approved: false,
    requirementsUploaded: false,
    amountReceived: false,
  });

  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [savingRequestEdits, setSavingRequestEdits] = useState(false);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [mosques, setMosques] = useState<MosqueOption[]>([]);
  const [editForm, setEditForm] = useState<EditableRequestForm>({
    requester_name: "",
    requester_phone: "",
    requester_role: "imam",
    request_type_id: "",
    city_id: "",
    district_id: "",
    mosque_id: "",
    description: "",
    audit_note: "",
  });
  const selectedTechnicianDetails = teamMembers.find((tech) => tech.id === selectedTechnician) || null;
  const fundingChannelData = parseFundingChannelData((request as any)?.funding_channel_data);
  const directDonorProofUrl = fundingChannelData.directDonor?.proofFileUrl || "";
  const directDonorProofName = fundingChannelData.directDonor?.proofFileName || "";
  const beneficiaryTrackingUrl = request?.id && request?.beneficiary_phone
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/approval/tracking/${request.id}?phone=${encodeURIComponent(request.beneficiary_phone)}`
    : "";
  const hasEhsanChecklistCompleted =
    ehsanChecklist.submitted &&
    ehsanChecklist.approved &&
    ehsanChecklist.requirementsUploaded &&
    ehsanChecklist.amountReceived;
  const isFundingConfirmationTextValid = fundingCompletionText.trim() === REQUIRED_FUNDING_CONFIRMATION_TEXT;

  const isFundingInputsComplete = (() => {
    if (!request?.funding_type) return false;

    if (request.funding_type === "direct_donor") {
      return Boolean(directDonorProofFile || directDonorProofUrl);
    }

    if (request.funding_type === "store_opportunity") {
      return Boolean(storeOpportunityUrl.trim());
    }

    if (request.funding_type === "ehsan") {
      return hasEhsanChecklistCompleted;
    }

    return false;
  })();

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

      const technicians = (data || []).map((item: any) => item.profiles).filter(Boolean);

      const technicianIds = technicians.map((tech: any) => tech.id);
      let technicianRequests: any[] = [];

      if (technicianIds.length > 0) {
        const { data: requestsData, error: requestsError } = await (supabase as any)
          .from("requests")
          .select("assigned_technician_id, current_status, created_at, updated_at")
          .in("assigned_technician_id", technicianIds);

        if (requestsError) {
          console.error("❌ Error loading technician workload:", requestsError);
          throw requestsError;
        }

        technicianRequests = requestsData || [];
      }

      const now = Date.now();
      const enrichedTechnicians: TechnicianWorkload[] = technicians
        .map((tech: any) => {
          const requestsForTech = technicianRequests.filter(
            (requestItem: any) => requestItem.assigned_technician_id === tech.id
          );
          const activeRequests = requestsForTech.filter((requestItem: any) =>
            ACTIVE_TECHNICIAN_STATUSES.includes(requestItem.current_status)
          );
          const overdueCount = activeRequests.filter((requestItem: any) => {
            const referenceDate = requestItem.updated_at || requestItem.created_at;
            const ageInDays = referenceDate
              ? Math.floor((now - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24))
              : 0;
            return ageInDays >= 10;
          }).length;
          const newRequestsCount = activeRequests.filter((requestItem: any) => {
            if (!requestItem.created_at) return false;
            const ageInDays = Math.floor((now - new Date(requestItem.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return ageInDays <= 3;
          }).length;
          const inProgressCount = activeRequests.filter((requestItem: any) => requestItem.current_status === "in_progress").length;
          const pendingInspectionCount = activeRequests.filter((requestItem: any) => requestItem.current_status === "pending_inspection").length;
          const pendingFinalReportCount = activeRequests.filter((requestItem: any) => requestItem.current_status === "pending_final_report").length;
          const pressure = getTechnicianPressure(activeRequests.length, overdueCount);
          const commitment = getCommitmentIndicator(overdueCount, inProgressCount);

          return {
            id: tech.id,
            full_name: tech.full_name,
            phone: tech.phone,
            currentRequests: activeRequests.length,
            totalRequests: requestsForTech.length,
            inProgressCount,
            pendingInspectionCount,
            pendingFinalReportCount,
            newRequestsCount,
            overdueCount,
            pressureLabel: pressure.label,
            pressureClassName: pressure.className,
            commitmentLabel: commitment.label,
            commitmentClassName: commitment.className,
          };
        })
        .sort((left, right) => {
          const leftPressure = getTechnicianPressure(left.currentRequests, left.overdueCount).rank;
          const rightPressure = getTechnicianPressure(right.currentRequests, right.overdueCount).rank;

          if (leftPressure !== rightPressure) return leftPressure - rightPressure;
          if (left.overdueCount !== right.overdueCount) return left.overdueCount - right.overdueCount;
          if (left.currentRequests !== right.currentRequests) return left.currentRequests - right.currentRequests;
          return left.totalRequests - right.totalRequests;
        });

      setTeamMembers(enrichedTechnicians);
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

  const reloadExternalInspectionReport = async (rqNumber?: string) => {
    if (!rqNumber) {
      setExternalReport(null);
      return;
    }

    try {
      setLoadingExternalReport(true);
      const report = await fetchInspectionReport(rqNumber);
      setExternalReport(report);
    } catch (err) {
      console.error("Error loading external inspection report:", err);
      setExternalReport(null);
    } finally {
      setLoadingExternalReport(false);
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

      const persistedFundingData = parseFundingChannelData((requestData as any)?.funding_channel_data);
      setStoreOpportunityUrl(persistedFundingData.storeOpportunity?.opportunityUrl || "");
      setEhsanChecklist(
        persistedFundingData.ehsan?.checklist || {
          submitted: false,
          approved: false,
          requirementsUploaded: false,
          amountReceived: false,
        }
      );
      setFundingCompletionText((requestData as any)?.funding_completion_phrase || "");
      setDirectDonorProofFile(null);
      setFundingValidationError("");
      setExecutionValidationError("");
      setFirstPaymentFollowedUp(false);
      setPhotographerEmail("");
      setExecutionNotes("");
      setExecutionReceiptFile(null);
      setSubmittingDeliveryReport(false);
      setDeliveryReportValidationError("");
      setDeliveryReportFile(null);
      setDeliveryReportNotes("");

      // Fetch external inspection report from Inspection App
      if (requestData.rq_number) {
        await reloadExternalInspectionReport(requestData.rq_number);
      } else {
        setExternalReport(null);
      }

      // Pre-fill selection if already assigned
      if (requestData?.assigned_technician_id) setSelectedTechnician(requestData.assigned_technician_id);

      // Load timeline separately so its failure doesn't block request display
      requestService.getRequestTimeline(id)
        .then(timelineData => setTimeline(timelineData))
        .catch(err => {
          console.error("Error loading timeline (non-critical):", err);
          setTimeline([]);
        });

      if (requestData.current_status && [
        "pending_pricing_approval",
        "pending_beneficiary_approval",
        "beneficiary_approved_pricing",
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
        "pending_contractor_selection",
        "pending_final_approval",
        "in_progress",
        "pending_final_report",
        "pending_closure",
        "closed"
      ].includes(requestData.current_status)) {
        try {
          console.log("🔍 Loading contractor bids for request:", id);
          const bids = await pricingService.getContractorBids(id as string);
          console.log("✅ Contractor bids loaded:", bids.length, "bids found");
          console.log("📋 Bids details:", bids);
          setContractorBids(bids);
        } catch (bidsError) {
          console.error("❌ Error loading contractor bids (non-critical):", bidsError);
          setContractorBids([]);
        }
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
      setFundingValidationError("");
      setCompletingFunding(true);
      
      const requestId = Array.isArray(id) ? id[0] : id;

      if (!request?.funding_type) {
        setFundingValidationError("لم يتم تحديد قناة التمويل من المستفيد بعد");
        return;
      }

      if (!isFundingInputsComplete) {
        if (request.funding_type === "direct_donor") {
          setFundingValidationError("يرجى رفع ملف إثبات التحويل قبل الإكمال");
        } else if (request.funding_type === "store_opportunity") {
          setFundingValidationError("يرجى إدخال رابط الفرصة قبل الإكمال");
        } else if (request.funding_type === "ehsan") {
          setFundingValidationError("يرجى إكمال جميع عناصر قائمة إحسان قبل الإكمال");
        }
        return;
      }

      if (!isFundingConfirmationTextValid) {
        setFundingValidationError(`اكتب النص المطلوب حرفياً: ${REQUIRED_FUNDING_CONFIRMATION_TEXT}`);
        return;
      }

      const nextFundingChannelData: FundingChannelData = {
        ...fundingChannelData,
      };

      if (request.funding_type === "direct_donor") {
        let proofUrl = directDonorProofUrl;
        let proofName = directDonorProofName;

        if (directDonorProofFile) {
          const rawName = directDonorProofFile.name || "proof-file";
          const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = `${requestId}/funding-proof/${Date.now()}_${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from("bid-documents")
            .upload(filePath, directDonorProofFile, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from("bid-documents").getPublicUrl(filePath);
          proofUrl = publicData.publicUrl;
          proofName = rawName;
        }

        nextFundingChannelData.directDonor = {
          proofFileUrl: proofUrl,
          proofFileName: proofName,
        };
      }

      if (request.funding_type === "store_opportunity") {
        nextFundingChannelData.storeOpportunity = {
          opportunityUrl: storeOpportunityUrl.trim(),
        };
      }

      if (request.funding_type === "ehsan") {
        nextFundingChannelData.ehsan = {
          checklist: {
            submitted: ehsanChecklist.submitted,
            approved: ehsanChecklist.approved,
            requirementsUploaded: ehsanChecklist.requirementsUploaded,
            amountReceived: ehsanChecklist.amountReceived,
          },
        };
      }

      const { error } = await (supabase as any)
        .from("requests")
        .update({ 
          funding_completed: true,
          funding_completed_at: new Date().toISOString(),
          funding_channel_data: nextFundingChannelData,
          funding_completion_phrase: fundingCompletionText.trim(),
          current_status: "pending_contractor_bids" 
        })
        .eq("id", requestId);

      if (error) {
        const errorMessage = String(error?.message || "");
        const missingNewFundingColumns =
          errorMessage.includes("funding_channel_data") ||
          errorMessage.includes("funding_completion_phrase");

        if (!missingNewFundingColumns) {
          throw error;
        }

        // Backward-compatible fallback until migration is applied.
        const { error: fallbackError } = await (supabase as any)
          .from("requests")
          .update({
            funding_completed: true,
            funding_completed_at: new Date().toISOString(),
            current_status: "pending_contractor_bids",
          })
          .eq("id", requestId);

        if (fallbackError) throw fallbackError;
      }

      await requestService.createStatusLog(
        requestId as string,
        "pending_contractor_bids",
        "تم اكتمال المبلغ والانتقال إلى مرحلة عروض المقاولين"
      );

      await loadRequest(requestId as string);
    } catch (error: any) {
      console.error("Error completing funding:", error);
      setFundingValidationError(
        `تعذر تأكيد اكتمال التمويل: ${error?.message || "حدث خطأ غير متوقع"}`
      );
    } finally {
      setCompletingFunding(false);
    }
  };

  const handleCompleteExecution = async () => {
    try {
      setExecutionValidationError("");
      setCompletingExecution(true);

      const requestId = Array.isArray(id) ? id[0] : id;

      if (!firstPaymentFollowedUp) {
        setExecutionValidationError("يرجى تأكيد متابعة تحويل الدفعة الأولى قبل الإنهاء");
        return;
      }

      const emailValue = photographerEmail.trim();
      if (!emailValue) {
        setExecutionValidationError("يرجى إدخال بريد المصور");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        setExecutionValidationError("يرجى إدخال بريد إلكتروني صحيح للمصور");
        return;
      }

      const notesValue = executionNotes.trim();
      if (!notesValue) {
        setExecutionValidationError("يرجى إدخال ملاحظات التنفيذ قبل الإنهاء");
        return;
      }

      if (!executionReceiptFile) {
        setExecutionValidationError("يرجى رفع تقرير الاستلام قبل الإنهاء");
        return;
      }

      const receiptRawName = executionReceiptFile.name || "execution-receipt";
      const receiptSanitizedName = receiptRawName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const receiptPath = `${requestId}/execution-receipts/${Date.now()}_${receiptSanitizedName}`;

      const { error: receiptUploadError } = await supabase.storage
        .from("bid-documents")
        .upload(receiptPath, executionReceiptFile, { upsert: true });

      if (receiptUploadError) {
        throw receiptUploadError;
      }

      const { data: receiptPublicData } = supabase.storage
        .from("bid-documents")
        .getPublicUrl(receiptPath);

      const receiptUrl = receiptPublicData?.publicUrl || "";

      const statusNotes = [
        "تم الانتهاء من التنفيذ الميداني",
        "متابعة تحويل الدفعة الأولى: تمت",
        `تم إرسال بريد للمصور: ${emailValue}`,
        `تقرير الاستلام: ${receiptRawName}`,
        receiptUrl ? `رابط تقرير الاستلام: ${receiptUrl}` : "",
        `ملاحظات التنفيذ: ${notesValue}`,
      ].filter(Boolean).join(" | ");

      await requestService.updateRequestStatus(
        requestId as string,
        "pending_final_report",
        statusNotes
      );

      await loadRequest(requestId as string);
    } catch (error: any) {
      console.error("Error completing execution:", error);
      setExecutionValidationError(
        `تعذر إنهاء التنفيذ: ${error?.message || "حدث خطأ غير متوقع"}`
      );
    } finally {
      setCompletingExecution(false);
    }
  };

  const handleSubmitDeliveryReport = async () => {
    try {
      setDeliveryReportValidationError("");
      setSubmittingDeliveryReport(true);

      const requestId = Array.isArray(id) ? id[0] : id;

      if (!deliveryReportFile) {
        setDeliveryReportValidationError("يرجى رفع تقرير التسليم قبل الإرسال");
        return;
      }

      const notesValue = deliveryReportNotes.trim();
      if (!notesValue) {
        setDeliveryReportValidationError("يرجى إدخال ملاحظات تقرير التسليم");
        return;
      }

      const rawName = deliveryReportFile.name || "delivery-report";
      const sanitizedName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${requestId}/delivery-reports/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from("bid-documents")
        .upload(filePath, deliveryReportFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("bid-documents")
        .getPublicUrl(filePath);

      const reportUrl = publicData?.publicUrl || "";

      const statusNotes = [
        "تم رفع تقرير التسليم الختامي",
        `اسم الملف: ${rawName}`,
        reportUrl ? `رابط التقرير: ${reportUrl}` : "",
        `ملاحظات التقرير: ${notesValue}`,
      ].filter(Boolean).join(" | ");

      await requestService.updateRequestStatus(
        requestId as string,
        "pending_closure",
        statusNotes
      );

      await loadRequest(requestId as string);
    } catch (error: any) {
      console.error("Error submitting delivery report:", error);
      setDeliveryReportValidationError(
        `تعذر رفع تقرير التسليم: ${error?.message || "حدث خطأ غير متوقع"}`
      );
    } finally {
      setSubmittingDeliveryReport(false);
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
      requester_role: (request.requester_role || "imam") as RequesterRole,
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
  const externalInspectionItems = flattenInspectionReportItems(externalReport);
  const canEditRequestData = userRole === "customer_service" && request.current_status === "pending_review";
  const filteredMosques = editForm.district_id
    ? mosques.filter((mosque) => mosque.district_id === editForm.district_id)
    : [];
  const requesterRoleOptions = Object.entries(REQUESTER_ROLE_LABELS).filter(
    ([value]) => value !== "mosque_congregation"
  );

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
                      <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                        <SelectTrigger className="min-h-[56px] bg-white border-charity-medium text-right">
                          {selectedTechnicianDetails ? (
                            <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={selectedTechnicianDetails.pressureClassName}>
                                  {selectedTechnicianDetails.pressureLabel}
                                </Badge>
                                <Badge variant="outline" className={selectedTechnicianDetails.commitmentClassName}>
                                  {selectedTechnicianDetails.commitmentLabel}
                                </Badge>
                              </div>
                              <div className="min-w-0 text-right">
                                <p className="truncate font-semibold text-slate-900">
                                  {selectedTechnicianDetails.full_name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  الحالية: {selectedTechnicianDetails.currentRequests} · المتأخرة: {selectedTechnicianDetails.overdueCount}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <SelectValue placeholder="اختر الفني" />
                          )}
                        </SelectTrigger>
                        <SelectContent className="w-[min(92vw,34rem)] max-h-[26rem]">
                          {teamMembers.map((tech) => (
                            <SelectItem key={tech.id} value={tech.id} className="h-auto py-3 whitespace-normal">
                              <div className="w-full max-w-[30rem] space-y-2 text-right overflow-hidden">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={tech.pressureClassName}>{tech.pressureLabel}</Badge>
                                    <Badge variant="outline" className={tech.commitmentClassName}>الالتزام: {tech.commitmentLabel}</Badge>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-900">{tech.full_name}</p>
                                    {tech.phone && (
                                      <p className="text-xs text-slate-500" dir="ltr">{tech.phone}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                                  <p className="break-words">الطلبات الحالية: <span className="font-semibold text-slate-900">{tech.currentRequests}</span></p>
                                  <p className="break-words">إجمالي الطلبات: <span className="font-semibold text-slate-900">{tech.totalRequests}</span></p>
                                  <p className="break-words">قيد التنفيذ: <span className="font-semibold text-slate-900">{tech.inProgressCount}</span></p>
                                  <p className="break-words">جديد: <span className="font-semibold text-slate-900">{tech.newRequestsCount}</span></p>
                                  <p className="break-words">بانتظار المعاينة: <span className="font-semibold text-slate-900">{tech.pendingInspectionCount}</span></p>
                                  <p className="break-words">متأخر/عالق: <span className="font-semibold text-slate-900">{tech.overdueCount}</span></p>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        يتم ترتيب الفنيين تلقائياً من الأقل ضغطاً إلى الأعلى لمساعدة مدير المشاريع على التوزيع المتوازن.
                      </p>
                    </div>

                    {selectedTechnicianDetails && (
                      <div className="rounded-lg border border-charity-medium bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{selectedTechnicianDetails.full_name}</p>
                            <p className="text-sm text-slate-500">ملخص سريع قبل التعيين</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={selectedTechnicianDetails.pressureClassName}>{selectedTechnicianDetails.pressureLabel}</Badge>
                            <Badge variant="outline" className={selectedTechnicianDetails.commitmentClassName}>
                              مؤشر الالتزام: {selectedTechnicianDetails.commitmentLabel}
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">الطلبات الحالية</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.currentRequests}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">إجمالي الطلبات</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.totalRequests}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">المتأخرة/العالقة</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.overdueCount}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">قيد التنفيذ</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.inProgressCount}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">بانتظار المعاينة</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.pendingInspectionCount}</p>
                          </div>
                          <div className="rounded-md bg-slate-50 p-3">
                            <p className="text-slate-500 text-xs">جديدة</p>
                            <p className="font-bold text-slate-900">{selectedTechnicianDetails.newRequestsCount}</p>
                          </div>
                        </div>
                      </div>
                    )}

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

                    <div className="space-y-3 p-4 bg-white rounded-lg border border-charity-medium">
                      {request.funding_type === "direct_donor" && (
                        <>
                          <Label className="text-sm font-semibold">إثبات التحويل (متبرع مباشر)</Label>
                          <Input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => setDirectDonorProofFile(e.target.files?.[0] || null)}
                          />
                          {directDonorProofUrl && (
                            <a href={directDonorProofUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-charity-primary underline">
                              عرض الإثبات الحالي {directDonorProofName ? `(${directDonorProofName})` : ""}
                            </a>
                          )}
                        </>
                      )}

                      {request.funding_type === "store_opportunity" && (
                        <>
                          <Label className="text-sm font-semibold">رابط الفرصة</Label>
                          <Input
                            type="url"
                            dir="ltr"
                            placeholder="https://..."
                            value={storeOpportunityUrl}
                            onChange={(e) => setStoreOpportunityUrl(e.target.value)}
                          />
                        </>
                      )}

                      {request.funding_type === "ehsan" && (
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold">قائمة إحسان</Label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={ehsanChecklist.submitted}
                                onCheckedChange={(checked) =>
                                  setEhsanChecklist((prev) => ({ ...prev, submitted: !!checked }))
                                }
                              />
                              <span className="text-sm">تم تقديم الطلب</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={ehsanChecklist.approved}
                                onCheckedChange={(checked) =>
                                  setEhsanChecklist((prev) => ({ ...prev, approved: !!checked }))
                                }
                              />
                              <span className="text-sm">تمت الموافقة</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={ehsanChecklist.requirementsUploaded}
                                onCheckedChange={(checked) =>
                                  setEhsanChecklist((prev) => ({ ...prev, requirementsUploaded: !!checked }))
                                }
                              />
                              <span className="text-sm">تم رفع المتطلبات</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={ehsanChecklist.amountReceived}
                                onCheckedChange={(checked) =>
                                  setEhsanChecklist((prev) => ({ ...prev, amountReceived: !!checked }))
                                }
                              />
                              <span className="text-sm">وصل المبلغ</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-sm font-semibold">اكتب النص التالي حرفياً لتأكيد الإجراء</Label>
                        <p className="text-sm font-bold text-charity-primary">{REQUIRED_FUNDING_CONFIRMATION_TEXT}</p>
                        <Input
                          value={fundingCompletionText}
                          onChange={(e) => setFundingCompletionText(e.target.value)}
                          placeholder="اكتب النص كما هو"
                        />
                      </div>

                      {fundingValidationError && (
                        <Alert className="bg-red-50 border-red-200">
                          <AlertDescription className="text-red-700">{fundingValidationError}</AlertDescription>
                        </Alert>
                      )}
                    </div>

                    <Button
                      onClick={handleCompleteFunding}
                      disabled={
                        completingFunding ||
                        request.funding_completed ||
                        !isFundingInputsComplete ||
                        !isFundingConfirmationTextValid
                      }
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
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>
                  <TabsTrigger value="inspection">المعاينة</TabsTrigger>
                  <TabsTrigger value="pricing">التسعيرات</TabsTrigger>
                  <TabsTrigger value="files">الملفات</TabsTrigger>
                  <TabsTrigger value="contractor">المقاول المختار</TabsTrigger>
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

                {/* Inspection Tab - External Report */}
                <TabsContent value="inspection">
                  {loadingExternalReport ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-charity-primary" />
                        <p className="text-slate-500">جاري جلب تقرير المعاينة...</p>
                      </CardContent>
                    </Card>
                  ) : externalReport ? (
                    <div className="space-y-4">
                      {/* Report Header Card */}
                      <Card>
                        <CardHeader className="bg-gradient-to-l from-charity-bg-calm to-white border-b">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-white p-3 rounded-xl border">
                                <FileText className="w-6 h-6 text-charity-primary" />
                              </div>
                              <div>
                                <CardTitle>تقرير المعاينة</CardTitle>
                                <p className="text-sm text-slate-500 mt-0.5">
                                  {new Date(externalReport.report.report_date).toLocaleDateString("ar-SA", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => reloadExternalInspectionReport(request.rq_number)}
                                disabled={loadingExternalReport}
                              >
                                <RefreshCw className={`w-4 h-4 ml-2 ${loadingExternalReport ? "animate-spin" : ""}`} />
                                تحديث تقرير المعاينة
                              </Button>
                              <Badge className="bg-charity-bg-calm text-charity-dark border-charity-medium">
                                {getReportStatusLabel(externalReport.report.status)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                          <div className="grid md:grid-cols-3 gap-3">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <Building2 className="w-5 h-5 text-charity-primary shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">المسجد</p>
                                <p className="font-medium text-slate-900">{externalReport.report.mosques.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                              <MapPin className="w-5 h-5 text-charity-primary shrink-0" />
                              <div>
                                <p className="text-xs text-slate-500">المنطقة</p>
                                <p className="font-medium text-slate-900">
                                  {externalReport.report.mosques.district} - {externalReport.report.mosques.city}
                                </p>
                              </div>
                            </div>
                            {externalReport.report.mosques.location_link && (
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                                <LinkIcon className="w-5 h-5 text-charity-primary shrink-0" />
                                <div>
                                  <p className="text-xs text-slate-500">الموقع</p>
                                  <a
                                    href={externalReport.report.mosques.location_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-charity-primary underline text-sm"
                                  >
                                    فتح على الخريطة
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Mosque Photos */}
                          {(externalReport.report.mosques.main_photo_url || externalReport.report.map_photo_url) && (
                            <div className="grid md:grid-cols-2 gap-4">
                              {externalReport.report.mosques.main_photo_url && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-2">صورة المسجد</p>
                                  <div className="aspect-video rounded-lg overflow-hidden border">
                                    <img
                                      src={externalReport.report.mosques.main_photo_url}
                                      alt="صورة المسجد"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>
                              )}
                              {externalReport.report.map_photo_url && (
                                <div>
                                  <p className="text-xs text-slate-500 mb-2">موقع المسجد على الخريطة</p>
                                  <div className="aspect-video rounded-lg overflow-hidden border">
                                    <img
                                      src={externalReport.report.map_photo_url}
                                      alt="موقع المسجد"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Issues */}
                      {externalReport.issues.length === 0 ? (
                        <Card>
                          <CardContent className="py-8 text-center">
                            <p className="text-slate-500">لا توجد مشاكل مسجلة في التقرير</p>
                          </CardContent>
                        </Card>
                      ) : (
                        externalReport.issues.map((issue, issueIndex) => (
                          <Card key={issue.id}>
                            <CardHeader className="border-b pb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-base">
                                    {issueIndex + 1}. {issue.main_item.name_ar}
                                  </CardTitle>
                                  <p className="text-xs text-charity-primary font-semibold mt-1">
                                    معرف البند: {buildInspectionDisplayItemId(request?.rq_number, issueIndex)}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs border-charity-primary/30 bg-charity-bg-calm text-charity-primary">
                                    {buildInspectionDisplayItemId(request?.rq_number, issueIndex)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {issue.items.length} بند
                                  </Badge>
                                </div>
                              </div>
                              {issue.notes && (
                                <p className="text-sm text-slate-600 mt-1">
                                  <span className="font-medium">ملاحظات:</span> {issue.notes}
                                </p>
                              )}
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                              {/* Items Table */}
                              {issue.items.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50">
                                        <th className="text-right p-2 border border-slate-200 font-medium">البند</th>
                                        <th className="text-right p-2 border border-slate-200 font-medium">السبب</th>
                                        <th className="text-right p-2 border border-slate-200 font-medium">المواصفات</th>
                                        <th className="text-center p-2 border border-slate-200 font-medium">الكمية</th>
                                        <th className="text-center p-2 border border-slate-200 font-medium">الوحدة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {issue.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                          <td className="p-2 border border-slate-200">
                                            {item.sub_items?.name_ar ?? item.sub_item?.name_ar ?? "-"}
                                          </td>
                                          <td className="p-2 border border-slate-200 text-slate-600">
                                            {item.causes?.name_ar ?? item.cause?.name_ar ?? "-"}
                                          </td>
                                          <td className="p-2 border border-slate-200 text-slate-600 max-w-xs">
                                            {item.specs?.name ?? item.spec?.name ?? "-"}
                                          </td>
                                          <td className="p-2 border border-slate-200 text-center font-medium">
                                            {item.quantity}
                                          </td>
                                          <td className="p-2 border border-slate-200 text-center">
                                            {item.sub_items?.unit_ar ?? item.sub_item?.unit_ar ?? "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* Issue Photos */}
                              {issue.photos.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-slate-500 mb-2">
                                    الصور ({issue.photos.length})
                                  </p>
                                  <div className="grid grid-cols-3 gap-2">
                                    {issue.photos
                                      .slice()
                                      .sort((a, b) => a.photo_order - b.photo_order)
                                      .map((photo) => (
                                        <a
                                          key={photo.id}
                                          href={photo.photo_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="aspect-square rounded-lg overflow-hidden border hover:opacity-90 transition-opacity block"
                                        >
                                          <img
                                            src={photo.photo_url}
                                            alt={`صورة ${issueIndex + 1}`}
                                            className="w-full h-full object-cover"
                                          />
                                        </a>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>تقرير المعاينة</CardTitle>
                      </CardHeader>
                      <CardContent className="py-8 text-center space-y-2">
                        {request.rq_number ? (
                          <>
                            <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                            <p className="text-slate-600">
                              لم يتم رفع تقرير معاينة من تطبيق المعاينة بعد
                            </p>
                            <p className="text-sm text-slate-400">رقم الطلب: {request.rq_number}</p>
                          </>
                        ) : (
                          <p className="text-slate-500">لا يوجد رقم طلب مرتبط</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
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
                        <div className="space-y-4">
                          <p className="text-center text-slate-500 py-8">
                            لم يتم إضافة تسعيرات بعد
                          </p>
                          <div className="flex justify-center">
                            <Link href={`/dashboard/pricing/${request?.id}`}>
                              <Button className="bg-charity-primary text-white hover:bg-charity-dark">
                                إضافة تسعيرة جديدة
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {expertPricing.map((pricing, index) => (
                            <div key={pricing.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                              <div>
                                <p className="font-medium text-slate-900">{pricing.item_main_name || "بند تسعير"}</p>
                                <p className="text-sm text-slate-600">{pricing.item_sub_name || "-"}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  معرف التسعير: {(request?.rq_number || "RQ-UNK") + `-P-${String(index + 1).padStart(2, "0")}`}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  الكمية: {Number(pricing.quantity || 1)} {pricing.item_unit || ""}
                                  {pricing.unit_price ? ` · سعر الوحدة: ${Number(pricing.unit_price).toLocaleString("ar-SA")} ريال` : ""}
                                </p>
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-semibold text-charity-primary mb-1">
                                  {(request?.rq_number || "RQ-UNK") + `-P-${String(index + 1).padStart(2, "0")}`}
                                </p>
                                <p className="text-lg font-bold text-charity-primary">
                                  {pricing.estimated_price?.toLocaleString("ar-SA")} ريال
                                </p>
                              </div>
                            </div>
                          ))}
                          <div className="pt-4 border-t">
                            <Link href={`/dashboard/pricing/view/${request?.id}`}>
                              <Button className="w-full border border-charity-primary bg-charity-bg-calm text-charity-primary hover:bg-charity-primary hover:text-white">
                                عرض وتعديل التسعيرات
                              </Button>
                            </Link>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Files Tab */}
                <TabsContent value="files">
                  <Card>
                    <CardHeader>
                      <CardTitle>الملفات والمرفقات</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Inspection Report */}
                        {externalReport && (
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">تقرير المعاينة الخارجي</p>
                                  <p className="text-sm text-slate-600">{externalInspectionItems.length} بند</p>
                                </div>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => reloadExternalInspectionReport(request.rq_number)}>
                                <Download className="w-4 h-4 ml-2" />
                                تحديث
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Contractor Bids */}
                        {contractorBids.filter(bid => bid.bid_document_url).map((bid) => (
                          <div key={bid.id} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-charity-bg-calm flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-charity-primary" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">عرض سعر - {bid.contractor?.name}</p>
                                  <p className="text-sm text-slate-600">{bid.item_main_name || bid.item_sub_name || "بند عرض"}</p>
                                </div>
                              </div>
                              <a href={bid.bid_document_url} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <Download className="w-4 h-4 ml-2" />
                                  تحميل
                                </Button>
                              </a>
                            </div>
                          </div>
                        ))}

                        {!externalReport && contractorBids.filter(bid => bid.bid_document_url).length === 0 && (
                          <p className="text-center text-slate-500 py-8">لا توجد ملفات مرفقة</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Selected Contractor Tab */}
                <TabsContent value="contractor">
                  {(() => {
                    const selectedBids = contractorBids.filter((b: any) => b.is_selected);
                    const selectedContractor = selectedBids.length > 0 ? selectedBids[0].contractor : null;
                    const uniqueFileUrl = selectedBids.find((b: any) => b.bid_document_url)?.bid_document_url;
                    const hasAvailableBids = contractorBids.length > 0;
                    
                    return selectedContractor ? (
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                              المقاول المختار
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-400" />
                                <div>
                                  <p className="text-xs text-slate-500">الاسم</p>
                                  <p className="font-medium text-slate-900">{selectedContractor.name}</p>
                                </div>
                              </div>
                              {selectedContractor.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <p className="text-xs text-slate-500">الجوال</p>
                                    <p className="font-medium text-slate-900" dir="ltr">{selectedContractor.phone}</p>
                                  </div>
                                </div>
                              )}
                              {selectedContractor.email && (
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-slate-400" />
                                  <div>
                                    <p className="text-xs text-slate-500">البريد</p>
                                    <p className="font-medium text-slate-900">{selectedContractor.email}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                            {uniqueFileUrl && (
                              <div className="pt-2 border-t">
                                <a href={uniqueFileUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="outline" size="sm">
                                    <FileText className="w-4 h-4 ml-2" />
                                    ملف العرض
                                  </Button>
                                </a>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">بنود العرض المعتمد</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-slate-50">
                                    <th className="text-right py-2 pr-3 font-medium text-slate-600">البند</th>
                                    <th className="text-left py-2 font-medium text-slate-600">المبلغ</th>
                                    <th className="text-right py-2 font-medium text-slate-600">ملاحظات</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedBids.map((b: any) => (
                                    <tr key={b.id} className="border-b last:border-0">
                                      <td className="py-2 pr-3">
                                        <p className="font-medium">{b.item_main_name || "بند"}</p>
                                        <p className="text-xs text-slate-500">{b.item_sub_name || ""}</p>
                                      </td>
                                      <td className="py-2 font-semibold text-charity-primary whitespace-nowrap">
                                        {Number(b.bid_amount).toLocaleString("ar-SA")} ر.س
                                      </td>
                                      <td className="py-2 text-slate-600 text-xs">{b.notes || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 bg-slate-50">
                                    <td className="py-2 pr-3 font-bold">الإجمالي</td>
                                    <td className="py-2 font-bold text-charity-primary whitespace-nowrap">
                                      {selectedBids.reduce((s: number, b: any) => s + Number(b.bid_amount), 0).toLocaleString("ar-SA")} ر.س
                                    </td>
                                    <td />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <Card>
                        <CardContent className="py-10 text-center space-y-4">
                          <AlertCircle className="w-8 h-8 mx-auto text-amber-500" />
                          <div>
                            {hasAvailableBids ? (
                              <>
                                <p className="text-slate-600 font-medium">بيانات العروض المتاحة</p>
                                <p className="text-slate-500 text-sm mt-2">
                                  يوجد {contractorBids.length} عرض متاح. اختر أفضلها الآن.
                                </p>
                                {userRole === "project_manager" && request?.current_status === "pending_contractor_selection" && (
                                  <Link href={`/dashboard/contractor-selection/${request?.id}`}  className="inline-block mt-4">
                                    <Button className="bg-charity-primary hover:bg-charity-dark">
                                      <Award className="w-4 h-4 ml-2" />
                                      مقارنة واختيار المقاول
                                    </Button>
                                  </Link>
                                )}
                              </>
                            ) : (
                              <>
                                <p className="text-slate-600 font-medium">لم يتم رفع عروض بعد</p>
                                <p className="text-slate-500 text-sm mt-2">
                                  {request?.current_status === "pending_contractor_bids"
                                    ? "بانتظار رفع عروض المقاولين من قبل الفني"
                                    : "قد لا تكون في المرحلة الصحيحة لعرض العروض"}
                                </p>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
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
                <div className="p-2 bg-slate-100 rounded text-xs mb-4 space-y-1">
                  <p>User Role: {userRole || "Not loaded"}</p>
                  <p>Current Status: {request?.current_status || "N/A"}</p>
                  <p>Contractor Bids Count: {contractorBids.length}</p>
                  <p>Expert Pricing Count: {expertPricing.length}</p>
                  <p>Request ID: {id}</p>
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
                      disabled={!externalReport}
                      onClick={() => handleStatusUpdate("pending_expert_pricing", "تم اعتماد المعاينة وتحويل للتسعير")}
                    >
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      {externalReport ? "اعتماد المعاينة وتحويل للتسعير" : "بانتظار تقرير المعاينة الخارجي"}
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
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 rounded-lg text-center">
                        <FileText className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm text-slate-600">رفع تقرير المعاينة يتم من تطبيق المعاينة الخارجي</p>
                        <p className="text-xs text-slate-500 mt-1">سيظهر التقرير هنا تلقائيًا بعد رفعه وربطه بـ rq_number</p>
                      </div>

                      {loadingExternalReport ? (
                        <Button className="w-full" variant="outline" disabled>
                          <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                          جاري التحقق من تقرير المعاينة...
                        </Button>
                      ) : externalReport ? (
                        <Button
                          className="w-full bg-charity-primary hover:bg-charity-dark"
                          onClick={() => handleStatusUpdate("pending_inspection_approval", "تم استلام تقرير المعاينة الخارجي وإرساله لمدير المشاريع")}
                        >
                          <Send className="w-4 h-4 ml-2" />
                          إرسال لمدير المشاريع
                        </Button>
                      ) : (
                        <Button className="w-full" variant="outline" disabled>
                          <AlertCircle className="w-4 h-4 ml-2" />
                          بانتظار رفع تقرير المعاينة الخارجي
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Pricing Expert Actions */}
                  {userRole === "pricing_expert" && request.current_status === "pending_expert_pricing" && (
                    <Link href={`/dashboard/pricing/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary text-white hover:bg-charity-dark">
                        <DollarSign className="w-4 h-4 ml-2" />
                        رفع التسعيرات
                      </Button>
                    </Link>
                  )}

                  {/* Technician - Upload Contractor Bids */}
                  {userRole === "technician" && request.current_status === "pending_contractor_bids" && (
                    <Link href={`/dashboard/bids/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary hover:bg-charity-dark">
                        <FileText className="w-4 h-4 ml-2" />
                        رفع عروض المقاولين
                      </Button>
                    </Link>
                  )}

                  {/* Technician - In Progress Follow-up */}
                  {userRole === "technician" && request.current_status === "in_progress" && (
                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                      <p className="text-sm font-medium text-slate-800">متابعة التنفيذ</p>

                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="first-payment-followup"
                          checked={firstPaymentFollowedUp}
                          onCheckedChange={(checked) => setFirstPaymentFollowedUp(Boolean(checked))}
                        />
                        <Label htmlFor="first-payment-followup" className="text-sm leading-6 text-slate-700">
                          تمت متابعة عملية تحويل الدفعة الأولى
                        </Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="photographer-email">بريد المصور لزيارة الموقع</Label>
                        <Input
                          id="photographer-email"
                          type="email"
                          value={photographerEmail}
                          onChange={(event) => setPhotographerEmail(event.target.value)}
                          placeholder="photographer@example.com"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="execution-notes">ملاحظات التنفيذ</Label>
                        <Textarea
                          id="execution-notes"
                          value={executionNotes}
                          onChange={(event) => setExecutionNotes(event.target.value)}
                          placeholder="اكتب ملاحظات التنفيذ هنا..."
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="execution-receipt-file">تقرير الاستلام (ملف إلزامي)</Label>
                        <Input
                          id="execution-receipt-file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setExecutionReceiptFile(file);
                          }}
                        />
                        {executionReceiptFile && (
                          <p className="text-xs text-slate-600">تم اختيار الملف: {executionReceiptFile.name}</p>
                        )}
                      </div>

                      {executionValidationError && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{executionValidationError}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="w-full bg-charity-primary hover:bg-charity-dark"
                        onClick={handleCompleteExecution}
                        disabled={completingExecution}
                      >
                        {completingExecution ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            جاري الحفظ...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 ml-2" />
                            تم الانتهاء
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Technician - Final Delivery Report */}
                  {userRole === "technician" && request.current_status === "pending_final_report" && (
                    <div className="space-y-3 p-4 border rounded-lg bg-slate-50">
                      <p className="text-sm font-medium text-slate-800">رفع تقرير التسليم</p>

                      <div className="space-y-2">
                        <Label htmlFor="delivery-report-file">ملف تقرير التسليم (إلزامي)</Label>
                        <Input
                          id="delivery-report-file"
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setDeliveryReportFile(file);
                          }}
                        />
                        {deliveryReportFile && (
                          <p className="text-xs text-slate-600">تم اختيار الملف: {deliveryReportFile.name}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="delivery-report-notes">ملاحظات تقرير التسليم</Label>
                        <Textarea
                          id="delivery-report-notes"
                          value={deliveryReportNotes}
                          onChange={(event) => setDeliveryReportNotes(event.target.value)}
                          placeholder="اكتب ملاحظات تقرير التسليم هنا..."
                          rows={4}
                        />
                      </div>

                      {deliveryReportValidationError && (
                        <Alert className="border-red-200 bg-red-50">
                          <AlertCircle className="h-4 w-4 text-red-600" />
                          <AlertDescription className="text-red-800">{deliveryReportValidationError}</AlertDescription>
                        </Alert>
                      )}

                      <Button
                        className="w-full bg-charity-primary hover:bg-charity-dark"
                        onClick={handleSubmitDeliveryReport}
                        disabled={submittingDeliveryReport}
                      >
                        {submittingDeliveryReport ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            جاري الرفع...
                          </>
                        ) : (
                          <>
                            <FileText className="w-4 h-4 ml-2" />
                            إرسال تقرير التسليم
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Project Manager - Compare & Select Contractor */}
                  {userRole === "project_manager" && request.current_status === "pending_contractor_selection" && (
                    <Link href={`/dashboard/contractor-selection/${id}`} className="w-full">
                      <Button className="w-full bg-charity-primary hover:bg-charity-dark">
                        <Award className="w-4 h-4 ml-2" />
                        مقارنة واختيار المقاول
                      </Button>
                    </Link>
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
                        (userRole === "technician" && ["pending_inspection", "pending_contractor_bids", "in_progress", "pending_final_report"].includes(request.current_status || "")) ||
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
                "beneficiary_approved_pricing",
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
                          {request.funding_type && FUNDING_TYPE_LABELS[request.funding_type as FundingType]}
                          {!request.funding_type && "لم يتم التحديد"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">حالة التمويل</span>
                        <Badge className={request.funding_completed ? "bg-charity-primary text-white" : "bg-charity-medium text-white"}>
                          {request.funding_completed ? "مكتمل" : "غير مكتمل"}
                        </Badge>
                      </div>

                      {(request as any).funding_completion_phrase && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">عبارة التأكيد</span>
                          <span className="text-sm font-semibold text-charity-primary">{(request as any).funding_completion_phrase}</span>
                        </div>
                      )}

                      {fundingChannelData.directDonor?.proofFileUrl && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-slate-600 mb-1">إثبات التحويل</p>
                          <a
                            href={fundingChannelData.directDonor.proofFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-charity-primary underline"
                          >
                            عرض الملف {fundingChannelData.directDonor.proofFileName ? `(${fundingChannelData.directDonor.proofFileName})` : ""}
                          </a>
                        </div>
                      )}

                      {fundingChannelData.storeOpportunity?.opportunityUrl && (
                        <div className="pt-2 border-t">
                          <p className="text-sm text-slate-600 mb-1">رابط الفرصة</p>
                          <a
                            href={fundingChannelData.storeOpportunity.opportunityUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-charity-primary underline break-all"
                          >
                            {fundingChannelData.storeOpportunity.opportunityUrl}
                          </a>
                        </div>
                      )}

                      {fundingChannelData.ehsan?.checklist && (
                        <div className="pt-2 border-t space-y-1">
                          <p className="text-sm text-slate-600">متابعة إحسان</p>
                          <p className="text-xs text-slate-700">{fundingChannelData.ehsan.checklist.submitted ? "✅" : "⬜"} تم تقديم الطلب</p>
                          <p className="text-xs text-slate-700">{fundingChannelData.ehsan.checklist.approved ? "✅" : "⬜"} تمت الموافقة</p>
                          <p className="text-xs text-slate-700">{fundingChannelData.ehsan.checklist.requirementsUploaded ? "✅" : "⬜"} تم رفع المتطلبات</p>
                          <p className="text-xs text-slate-700">{fundingChannelData.ehsan.checklist.amountReceived ? "✅" : "⬜"} وصل المبلغ</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {request && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <LinkIcon className="w-5 h-5" />
                      بيانات المستفيد والمتابعة
                    </CardTitle>
                    <CardDescription>
                      تبقى هذه المعلومات ظاهرة داخل تفاصيل الطلب حتى بعد الانتقال للمراحل التالية.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm text-slate-600 mb-1">اسم المستفيد</p>
                          <p className="font-bold text-slate-900">{request.beneficiary_name || "-"}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm text-slate-600 mb-1">قناة الدعم المختارة</p>
                          <p className="font-bold text-slate-900">
                            {request.funding_type ? FUNDING_TYPE_LABELS[request.funding_type as FundingType] : "لم يتم اختيارها بعد"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-sm text-slate-600 mb-2">رابط متابعة المستفيد</p>
                        {beneficiaryTrackingUrl ? (
                          <div className="flex gap-2">
                            <Input
                              readOnly
                              value={beneficiaryTrackingUrl}
                              className="font-mono text-sm"
                              dir="ltr"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(beneficiaryTrackingUrl);
                                alert("✅ تم نسخ رابط متابعة المستفيد");
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">لا يمكن إنشاء الرابط لعدم توفر رقم الجوال أو معرف الطلب.</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                        <p className="text-sm text-slate-600 mb-1">رقم الجوال المستخدم في الرابط</p>
                        <p className="font-mono text-slate-900 tracking-wider">{request.beneficiary_phone || "-"}</p>
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