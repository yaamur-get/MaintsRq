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
  ArrowLeft
} from "lucide-react";
import { authService } from "@/services/authService";
import { requestService } from "@/services/requestService";

interface Request {
  id: string;
  rq_number: string;
  current_status: string;
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
      // تحويل البيانات إلى النوع المحلي للواجهة
      const requests = requestsData as unknown as Request[];
      
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
            "pending_inspection_approval",
            "pending_pricing_approval",
            "pending_funding",
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
      pending_inspection: { label: "بانتظار المعاينة", variant: "secondary" },
      pending_inspection_approval: { label: "بانتظار اعتماد المعاينة", variant: "outline" },
      pending_expert_pricing: { label: "بانتظار التسعير", variant: "secondary" },
      pending_pricing_approval: { label: "بانتظار اعتماد التسعير", variant: "outline" },
      pending_beneficiary_approval: { label: "بانتظار موافقة المستفيد", variant: "secondary" },
      pending_funding: { label: "بانتظار التمويل", variant: "secondary" },
      pending_contractor_bids: { label: "بانتظار عروض المقاولين", variant: "secondary" },
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

          {/* الإحصائيات */}
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