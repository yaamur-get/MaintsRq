import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  CheckCircle,
  Timer,
  FileText,
  AlertCircle,
  ArrowLeft,
  Activity,
  Wrench,
  Wallet,
  Briefcase,
  ShieldCheck,
  HardHat,
  SearchCheck
} from "lucide-react";
import { authService } from "@/services/authService";
import { requestService } from "@/services/requestService";

interface Request {
  id: string;
  rq_number: string;
  current_status: string;
  updated_at?: string;
  request_type?: {
    name: string;
  };
  created_at: string;
  mosque?: {
    name: string;
    city?: {
      name: string;
    };
    district?: {
      name: string;
    };
  };
}

interface Stats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

interface RoleTaskCard {
  id: string;
  title: string;
  icon: any;
  tone: string;
  activeStatuses: string[];
  doneStatuses: string[];
}

interface RoleTaskCardSummary {
  id: string;
  title: string;
  icon: any;
  tone: string;
  active: number;
  stalled: number;
  completed: number;
  total: number;
}

const STALLED_AFTER_DAYS = 10;

const isStalledRequest = (request: Request) => {
  const rawDate = request.updated_at || request.created_at;
  if (!rawDate) return false;
  const ageDays = Math.floor((Date.now() - new Date(rawDate).getTime()) / (1000 * 60 * 60 * 24));
  return ageDays >= STALLED_AFTER_DAYS;
};

const getRoleTaskCardsDefinition = (role: string): RoleTaskCard[] => {
  switch (role) {
    case "customer_service":
      return [
        {
          id: "cs-review",
          title: "طلبات المراجعة الأولية",
          icon: SearchCheck,
          tone: "from-amber-50 to-orange-50 border-amber-200",
          activeStatuses: ["pending_review"],
          doneStatuses: ["accepted_initial", "rejected"],
        },
      ];

    case "project_manager":
      return [
        {
          id: "pm-team",
          title: "تعيين الفرق",
          icon: Briefcase,
          tone: "from-blue-50 to-cyan-50 border-blue-200",
          activeStatuses: ["accepted_initial"],
          doneStatuses: ["pending_inspection"],
        },
        {
          id: "pm-inspection-approval",
          title: "اعتماد المعاينة",
          icon: ShieldCheck,
          tone: "from-violet-50 to-indigo-50 border-violet-200",
          activeStatuses: ["pending_inspection_approval"],
          doneStatuses: ["pending_expert_pricing"],
        },
        {
          id: "pm-pricing-funding",
          title: "اعتماد التسعير والتمويل",
          icon: Wallet,
          tone: "from-pink-50 to-rose-50 border-pink-200",
          activeStatuses: ["pending_pricing_approval", "beneficiary_approved_pricing", "pending_funding"],
          doneStatuses: ["pending_contractor_bids"],
        },
        {
          id: "pm-final",
          title: "اختيار المقاول والإغلاق",
          icon: CheckCircle,
          tone: "from-emerald-50 to-green-50 border-emerald-200",
          activeStatuses: ["pending_contractor_selection", "pending_final_approval", "pending_closure"],
          doneStatuses: ["in_progress", "closed"],
        },
      ];

    case "technician":
      return [
        {
          id: "tech-inspection",
          title: "طلبات المعاينة",
          icon: HardHat,
          tone: "from-sky-50 to-blue-50 border-sky-200",
          activeStatuses: ["pending_inspection"],
          doneStatuses: ["pending_inspection_approval", "pending_expert_pricing"],
        },
        {
          id: "tech-bids",
          title: "طلبات عروض المقاولين",
          icon: Wrench,
          tone: "from-orange-50 to-amber-50 border-orange-200",
          activeStatuses: ["pending_contractor_bids"],
          doneStatuses: ["pending_contractor_selection", "pending_final_approval"],
        },
        {
          id: "tech-execution",
          title: "طلبات التنفيذ",
          icon: Activity,
          tone: "from-emerald-50 to-green-50 border-emerald-200",
          activeStatuses: ["in_progress", "pending_final_report"],
          doneStatuses: ["pending_closure", "closed"],
        },
      ];

    case "pricing_expert":
      return [
        {
          id: "pricing-work",
          title: "طلبات التسعير",
          icon: FileText,
          tone: "from-indigo-50 to-blue-50 border-indigo-200",
          activeStatuses: ["pending_expert_pricing"],
          doneStatuses: ["pending_pricing_approval", "pending_beneficiary_approval"],
        },
      ];

    default:
      return [
        {
          id: "admin-intake",
          title: "المراجعة الأولية",
          icon: SearchCheck,
          tone: "from-amber-50 to-orange-50 border-amber-200",
          activeStatuses: ["pending_review", "accepted_initial"],
          doneStatuses: ["pending_inspection"],
        },
        {
          id: "admin-evaluation",
          title: "المعاينة والتسعير",
          icon: ShieldCheck,
          tone: "from-blue-50 to-indigo-50 border-blue-200",
          activeStatuses: [
            "pending_inspection",
            "pending_inspection_approval",
            "pending_expert_pricing",
            "pending_pricing_approval",
            "pending_beneficiary_approval",
          ],
          doneStatuses: ["beneficiary_approved_pricing", "pending_funding"],
        },
        {
          id: "admin-contractors",
          title: "التمويل والعروض",
          icon: Wallet,
          tone: "from-pink-50 to-rose-50 border-pink-200",
          activeStatuses: ["beneficiary_approved_pricing", "pending_funding", "pending_contractor_bids", "pending_contractor_selection"],
          doneStatuses: ["pending_final_approval", "in_progress"],
        },
        {
          id: "admin-execution",
          title: "التنفيذ والإغلاق",
          icon: CheckCircle,
          tone: "from-emerald-50 to-green-50 border-emerald-200",
          activeStatuses: ["in_progress", "pending_final_report", "pending_final_approval", "pending_closure"],
          doneStatuses: ["closed"],
        },
      ];
  }
};

const buildRoleTaskSummaries = (role: string, requests: Request[]): RoleTaskCardSummary[] => {
  const definitions = getRoleTaskCardsDefinition(role);

  return definitions.map((def) => {
    const activeRequests = requests.filter((r) => def.activeStatuses.includes(r.current_status));
    const stalledRequests = activeRequests.filter(isStalledRequest);
    const completedRequests = requests.filter((r) => def.doneStatuses.includes(r.current_status));

    return {
      id: def.id,
      title: def.title,
      icon: def.icon,
      tone: def.tone,
      active: activeRequests.length,
      stalled: stalledRequests.length,
      completed: completedRequests.length,
      total: activeRequests.length + completedRequests.length,
    };
  });
};

export default function DashboardHome() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [myActionRequests, setMyActionRequests] = useState<Request[]>([]);
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [roleTaskCards, setRoleTaskCards] = useState<RoleTaskCardSummary[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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

      setUserRole(role);
      await loadDashboardData(role, user.id);
    } catch (error) {
      console.error("خطأ في التحقق من الصلاحيات:", error);
      router.push("/dashboard/login");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async (role: string, userId: string) => {
    try {
      const requestsData = await requestService.getRequestsForRole(role, userId);
      const systemRequestsData = await requestService.getAllRequests();
      // تحويل البيانات إلى النوع المحلي للواجهة
      const requests = requestsData as unknown as Request[];
      const systemRequests = systemRequestsData as unknown as Request[];
      
      // تصفية الطلبات التي تحتاج إجراء من المستخدم الحالي
      const myActions = filterRequestsRequiringMyAction(requests, role);
      const others = requests.filter(r => !myActions.find(m => m.id === r.id));

      setMyActionRequests(myActions);
      setAllRequests(others);

      // حساب الإحصائيات
      const total = requests.length;
      const pending = requests.filter(r => 
        r.current_status.includes("pending")
      ).length;
      const inProgress = requests.filter(r => 
        r.current_status === "in_progress"
      ).length;
      const completed = requests.filter(r => 
        r.current_status === "closed"
      ).length;

      setStats({ total, pending, inProgress, completed });
      setRoleTaskCards(buildRoleTaskSummaries(role, systemRequests));
    } catch (error) {
      console.error("خطأ في تحميل البيانات:", error);
    }
  };

  // دالة لتحديد الطلبات التي تحتاج إجراء من المستخدم حسب دوره
  const filterRequestsRequiringMyAction = (requests: Request[], role: string): Request[] => {
    return requests.filter(request => {
      const status = request.current_status;

      switch (role) {
        case "customer_service":
          return status === "pending_review";

        case "project_manager":
          return [
            "accepted_initial",
            "pending_rejection_approval",
            "pending_inspection_approval",
            "pending_pricing_approval",
            "beneficiary_approved_pricing",
            "pending_funding",
            "pending_contractor_selection",
            "pending_final_approval",
            "pending_closure"
          ].includes(status);

        case "technician":
          return [
            "pending_inspection",
            "pending_contractor_bids",
            "pending_final_report"
          ].includes(status);

        case "pricing_expert":
          return status === "pending_expert_pricing";

        default:
          return false;
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_review: { label: "بانتظار مراجعة خدمة العملاء", variant: "outline" },
      accepted_initial: { label: "بانتظار إجراء مدير المشاريع", variant: "outline" },
      pending_rejection_approval: { label: "مرفوض من خدمة العملاء - بانتظار تأكيد المدير", variant: "destructive" },
      pending_inspection: { label: "بانتظار المعاينة", variant: "secondary" },
      pending_inspection_approval: { label: "بانتظار اعتماد المعاينة", variant: "outline" },
      pending_expert_pricing: { label: "بانتظار التسعير", variant: "secondary" },
      pending_pricing_approval: { label: "بانتظار اعتماد التسعير", variant: "outline" },
      pending_beneficiary_approval: { label: "بانتظار موافقة المستفيد", variant: "secondary" },
      beneficiary_approved_pricing: { label: "وافق المستفيد على التسعير", variant: "secondary" },
      pending_funding: { label: "بانتظار التمويل", variant: "secondary" },
      pending_contractor_bids: { label: "بانتظار عروض المقاولين", variant: "secondary" },
      pending_contractor_selection: { label: "بانتظار اختيار المقاول", variant: "outline" },
      pending_final_approval: { label: "بانتظار الموافقة النهائية", variant: "outline" },
      in_progress: { label: "قيد التنفيذ", variant: "default" },
      pending_final_report: { label: "بانتظار التقرير الختامي", variant: "outline" },
      pending_closure: { label: "بانتظار الإغلاق", variant: "outline" },
      rejected: { label: "مرفوض", variant: "destructive" },
      closed: { label: "مغلق", variant: "secondary" }
    };

    const config = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleViewRequest = (requestId: string) => {
    router.push(`/dashboard/requests/${requestId}`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-charity-primary mx-auto mb-4"></div>
            <p className="text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO
        title="لوحة التحكم - نظام إدارة طلبات صيانة المساجد"
        description="نظرة عامة على الطلبات والمشاريع"
      />
      <DashboardLayout>
        <div className="space-y-6" dir="rtl">
          {/* العنوان */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">لوحة التحكم</h1>
            <p className="text-gray-600 mt-1">نظرة عامة على الطلبات والمشاريع</p>
          </div>

          {/* الإحصائيات العامة */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <FileText className="w-6 h-6 text-charity-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">إجمالي الطلبات</p>
                  <p className="text-3xl font-bold text-charity-primary">{stats.total}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <Clock className="w-6 h-6 text-charity-medium" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">بانتظار المراجعة</p>
                  <p className="text-3xl font-bold text-charity-medium">{stats.pending}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <Timer className="w-6 h-6 text-charity-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">قيد التنفيذ</p>
                  <p className="text-3xl font-bold text-charity-primary">{stats.inProgress}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <CheckCircle className="w-6 h-6 text-charity-light" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">المكتملة</p>
                  <p className="text-3xl font-bold text-charity-light">{stats.completed}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* بطاقات المهام حسب الدور */}
          {roleTaskCards.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">إحصائيات أنواع المهام حسب دورك</h2>
                  <p className="text-sm text-gray-600 mt-1">تحت التنفيذ، متعثر، منجز لكل نوع مهمة</p>
                </div>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {roleTaskCards.length} أنواع مهام
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {roleTaskCards.map((taskCard) => {
                  const Icon = taskCard.icon;
                  return (
                    <Card
                      key={taskCard.id}
                      className={`p-5 border bg-gradient-to-br ${taskCard.tone} shadow-sm hover:shadow-md transition-all`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <p className="text-sm text-slate-600 mb-1">نوع المهمة</p>
                          <h3 className="text-xl font-bold text-slate-900">{taskCard.title}</h3>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white/80 border border-white flex items-center justify-center">
                          <Icon className="w-6 h-6 text-charity-primary" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-white/70 border border-white p-3 text-center">
                          <p className="text-xs text-slate-600">تحت التنفيذ</p>
                          <p className="text-2xl font-extrabold text-charity-primary leading-none mt-1">{taskCard.active}</p>
                        </div>
                        <div className="rounded-lg bg-white/70 border border-white p-3 text-center">
                          <p className="text-xs text-slate-600">متعثر</p>
                          <p className="text-2xl font-extrabold text-amber-700 leading-none mt-1">{taskCard.stalled}</p>
                        </div>
                        <div className="rounded-lg bg-white/70 border border-white p-3 text-center">
                          <p className="text-xs text-slate-600">منجز</p>
                          <p className="text-2xl font-extrabold text-emerald-700 leading-none mt-1">{taskCard.completed}</p>
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-slate-600">
                        إجمالي الحركة على هذه المهمة: <span className="font-bold text-slate-800">{taskCard.total}</span>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* الطلبات المطلوب إجراء فيها */}
          {myActionRequests.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-charity-bg-calm rounded-lg">
                  <AlertCircle className="w-6 h-6 text-charity-dark" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">الطلبات المطلوب إجراء فيها</h2>
                  <p className="text-sm text-gray-600">هذه الطلبات تحتاج إلى إجراء منك الآن</p>
                </div>
                <Badge variant="default" className="mr-auto text-lg px-4 py-1 bg-charity-dark text-white">
                  {myActionRequests.length}
                </Badge>
              </div>

              <div className="grid gap-4">
                {myActionRequests.map((request) => (
                  <Card
                    key={request.id}
                    className="p-6 hover:shadow-lg transition-all cursor-pointer border-r-4 border-r-charity-dark bg-charity-bg-calm/30"
                    onClick={() => handleViewRequest(request.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {request.rq_number}
                          </h3>
                          {getStatusBadge(request.current_status)}
                          <Badge variant="outline" className="bg-charity-bg-calm text-charity-dark border-charity-medium">
                            يتطلب إجراء منك
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">المسجد:</span> {request.mosque?.name || "غير محدد"}
                          </p>
                          {request.mosque?.city?.name && (
                            <p>
                              <span className="font-medium">المدينة:</span> {request.mosque.city.name}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">نوع الاحتياج:</span> {request.request_type?.name || "غير محدد"}
                          </p>
                          <p>
                            <span className="font-medium">تاريخ الإنشاء:</span>{" "}
                            {new Date(request.created_at).toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      <Button variant="default" size="sm" className="gap-2">
                        اتخاذ الإجراء
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* كل الطلبات */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">كل الطلبات</h2>
            
            {allRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">لا توجد طلبات أخرى</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {allRequests.map((request) => (
                  <Card
                    key={request.id}
                    className="p-6 hover:shadow-lg transition-all cursor-pointer"
                    onClick={() => handleViewRequest(request.id)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {request.rq_number}
                          </h3>
                          {getStatusBadge(request.current_status)}
                        </div>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">المسجد:</span> {request.mosque?.name || "غير محدد"}
                          </p>
                          {request.mosque?.city?.name && (
                            <p>
                              <span className="font-medium">المدينة:</span> {request.mosque.city.name}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">نوع الاحتياج:</span> {request.request_type?.name || "غير محدد"}
                          </p>
                          <p>
                            <span className="font-medium">تاريخ الإنشاء:</span>{" "}
                            {new Date(request.created_at).toLocaleDateString("ar-SA")}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-2">
                        عرض التفاصيل
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}