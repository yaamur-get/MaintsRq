import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Eye, Loader2, FileText, Clock, CheckCircle } from "lucide-react";
import { getRequesterRoleLabel, requestService } from "@/services/requestService";
import { commonDataService } from "@/services/commonDataService";
import { authService } from "@/services/authService";
import { useRouter } from "next/router";
import type { Database } from "@/integrations/supabase/types";

type Request = Database["public"]["Tables"]["requests"]["Row"] & {
  mosque: { name: string; city: { name: string } | null; district: { name: string } | null } | null;
  request_type: { name: string } | null;
  requester: { full_name: string | null; phone: string | null } | null;
};

export default function RequestsList() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>("");
  const [statusTranslations, setStatusTranslations] = useState<Record<string, { label: string; color: string }>>({});
  const router = useRouter();
  
  // Statistics state
  const [totalRequests, setTotalRequests] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [completedRequests, setCompletedRequests] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      await loadRequests(role, user.id);
    } catch (error) {
      console.error("Auth check failed:", error);
      router.push("/dashboard/login");
    }
  };

  useEffect(() => {
    checkAuth();
    loadStatusTranslations();
  }, []);

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

  const loadRequests = async (role: string, userId: string) => {
    try {
      setLoading(true);
      const data = await requestService.getRequestsForRole(role, userId);
      // تحويل البيانات إلى النوع المحلي للواجهة
      const requests = data as unknown as Request[];
      setRequests(requests);

      // Calculate statistics
      setTotalRequests(requests.length);
      // Remove 'completed' check as it is not a valid enum value, use 'closed' instead
      setPendingRequests(requests.filter(r => r.current_status !== 'closed' && r.current_status !== 'rejected').length);
      setCompletedRequests(requests.filter(r => r.current_status === 'closed').length);
    } catch (error) {
      console.error("Error loading requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.rq_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.beneficiary_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getRequesterRoleLabel(request.requester_role).toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.requester_role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.mosque?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.current_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <>
      <SEO 
        title="الطلبات - نظام إدارة صيانة المساجد"
        description="قائمة طلبات الصيانة والاحتياجات"
      />
      
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold text-slate-900">الطلبات</h2>
              <p className="text-slate-600">إدارة ومتابعة طلبات الصيانة</p>
            </div>
          </div>

          {/* الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <FileText className="w-6 h-6 text-charity-primary" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">إجمالي الطلبات</p>
                  <p className="text-3xl font-bold text-charity-primary">{totalRequests}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <Clock className="w-6 h-6 text-charity-medium" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">قيد المعالجة</p>
                  <p className="text-3xl font-bold text-charity-medium">{pendingRequests}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-charity-bg-calm rounded-lg">
                  <CheckCircle className="w-6 h-6 text-charity-light" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">المكتملة</p>
                  <p className="text-3xl font-bold text-charity-light">{completedRequests}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="بحث برقم الطلب، اسم المستفيد، الصفة، أو المسجد..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-9"
                  />
                </div>
                <div className="w-full sm:w-[200px]">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <Filter className="w-4 h-4 ml-2 text-slate-400" />
                      <SelectValue placeholder="تصفية حسب الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="pending_review">بانتظار المراجعة</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="closed">مغلق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">رقم الطلب</TableHead>
                      <TableHead className="text-right">مقدم الطلب</TableHead>
                      <TableHead className="text-right">المسجد</TableHead>
                      <TableHead className="text-right">نوع الاحتياج</TableHead>
                      <TableHead className="text-right">تاريخ الطلب</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2 text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>جاري تحميل البيانات...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          لا توجد طلبات مطابقة
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRequests.map((request) => {
                        const status = request.current_status || "";
                        const statusInfo = statusTranslations[status] || { label: status, color: "bg-slate-100 text-slate-800" };
                        
                        return (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">
                              {request.rq_number || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{request.beneficiary_name || "-"}</span>
                                <span className="text-xs text-slate-500">
                                  {getRequesterRoleLabel(request.requester_role)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{request.mosque?.name}</span>
                                <span className="text-xs text-slate-500">
                                  {request.mosque?.city?.name} - {request.mosque?.district?.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{request.request_type?.name}</TableCell>
                            <TableCell>
                              {request.created_at && new Date(request.created_at).toLocaleDateString('ar-SA')}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusInfo.color} border-0 hover:bg-opacity-80`}>
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Link href={`/dashboard/requests/${request.id}`}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Eye className="w-4 h-4 text-charity-primary" />
                                </Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}