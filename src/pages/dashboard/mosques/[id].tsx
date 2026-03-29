import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight,
  Landmark, 
  MapPin, 
  Phone,
  Mail,
  Users,
  Calendar,
  FileText,
  Edit,
  Map
} from "lucide-react";
import { mosqueService } from "@/services/mosqueService";
import { getRequesterRoleLabel, requestService } from "@/services/requestService";
import { authService } from "@/services/authService";
import type { Database } from "@/integrations/supabase/types";

type Mosque = Database["public"]["Tables"]["mosques"]["Row"] & {
  city?: { name: string } | null;
  district?: { name: string } | null;
};

type Request = Database["public"]["Tables"]["requests"]["Row"] & {
  request_types?: { name: string } | null;
};

export default function MosqueDetailsPage() {
  const router = useRouter();
  const { id } = router.query;
  const [mosque, setMosque] = useState<Mosque | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<any>(null);

  useEffect(() => {
    if (id) {
      loadMosqueData();
    }
  }, [id]);

  const loadMosqueData = async () => {
    try {
      const session = await authService.getCurrentSession();
      if (!session) return;

      setUserRole("customer_service");

      if (typeof id === "string") {
        const mosqueData = await mosqueService.getMosqueById(id);
        setMosque(mosqueData);

        const requestsData = await requestService.getRequestsByMosque(id);
        setRequests(requestsData);
      }
    } catch (error) {
      console.error("Error loading mosque data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending_review: { label: "بانتظار المراجعة", variant: "secondary" },
      under_review: { label: "قيد المراجعة", variant: "default" },
      approved: { label: "معتمد", variant: "default" },
      in_progress: { label: "قيد التنفيذ", variant: "default" },
      completed: { label: "مكتمل", variant: "default" },
      closed: { label: "مغلق", variant: "outline" },
      rejected: { label: "مرفوض", variant: "destructive" }
    };

    const statusInfo = statusMap[status] || { label: status, variant: "outline" as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout userRole={userRole}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري التحميل...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!mosque) {
    return (
      <DashboardLayout userRole={userRole}>
        <Card className="border-0 shadow-md">
          <CardContent className="py-12 text-center">
            <Landmark className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg">المسجد غير موجود</p>
            <Button 
              onClick={() => router.push("/dashboard/mosques")}
              className="mt-4"
              variant="outline"
            >
              العودة للمساجد
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO 
        title={`${mosque.name} - إدارة المساجد`}
        description={`معلومات وتفاصيل ${mosque.name}`}
      />
      
      <DashboardLayout userRole={userRole}>
        <div className="space-y-6">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            onClick={() => router.push("/dashboard/mosques")}
            className="mb-4"
          >
            <ArrowRight className="w-4 h-4 ml-2" />
            العودة للمساجد
          </Button>

          {/* Mosque Info Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-gradient-to-l from-charity-primary to-charity-dark text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="bg-charity-bg-calm p-4 rounded-xl">
                    <Landmark className="w-8 h-8 text-charity-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-3xl mb-2">{mosque.name}</CardTitle>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      <span>{mosque.city?.name}</span>
                      {mosque.district?.name && (
                        <>
                          <span>•</span>
                          <span>{mosque.district.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={mosque.is_active ? "default" : "secondary"} className="text-sm">
                    {mosque.is_active ? "نشط" : "غير نشط"}
                  </Badge>
                  {(userRole === "admin" || userRole === "project_manager") && (
                    <Button variant="outline" size="sm">
                      <Edit className="w-4 h-4 ml-2" />
                      تعديل
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-charity-primary" />
                    معلومات الاتصال
                  </h3>
                  
                  {mosque.imam_name && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Users className="w-4 h-4" />
                      <div>
                        <p className="text-sm text-slate-500">الإمام</p>
                        <p className="font-medium">{mosque.imam_name}</p>
                      </div>
                    </div>
                  )}

                  {mosque.contact_phone && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <div>
                        <p className="text-sm text-slate-500">رقم الهاتف</p>
                        <p className="font-medium" dir="ltr">{mosque.contact_phone}</p>
                      </div>
                    </div>
                  )}

                  {mosque.contact_email && (
                    <div className="flex items-center gap-3 text-slate-600">
                      <Mail className="w-4 h-4" />
                      <div>
                        <p className="text-sm text-slate-500">البريد الإلكتروني</p>
                        <p className="font-medium" dir="ltr">{mosque.contact_email}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Location Info */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                    <Map className="w-5 h-5 text-charity-primary" />
                    معلومات الموقع
                  </h3>

                  {mosque.address && (
                    <div className="text-slate-600">
                      <p className="text-sm text-slate-500 mb-1">العنوان</p>
                      <p className="font-medium">{mosque.address}</p>
                    </div>
                  )}

                  {mosque.capacity && (
                    <div className="text-slate-600">
                      <p className="text-sm text-slate-500 mb-1">السعة الاستيعابية</p>
                      <p className="font-medium">{mosque.capacity} مصلي</p>
                    </div>
                  )}

                  {(mosque.latitude && mosque.longitude) && (
                    <div className="text-slate-600">
                      <p className="text-sm text-slate-500 mb-1">الإحداثيات</p>
                      <p className="font-medium text-xs" dir="ltr">
                        {mosque.latitude}, {mosque.longitude}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Requests Card */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-charity-primary" />
                الطلبات ({requests.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-charity-primary mx-auto mb-3" />
                  <p className="text-slate-500">لا توجد طلبات لهذا المسجد</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((request) => (
                    <div 
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/requests/${request.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-lg">
                          <FileText className="w-5 h-5 text-charity-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {request.rq_number || `طلب #${request.id.slice(0, 8)}`}
                          </p>
                          <p className="text-sm text-slate-600">
                            {request.request_types?.name || "غير محدد"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {request.beneficiary_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {getRequesterRoleLabel(request.requester_role)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getStatusBadge(request.current_status || "pending_review")}
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-500">
                          {new Date(request.created_at || "").toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}