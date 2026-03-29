import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Building2, MapPin, Phone, User, Calendar, ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { mosqueAdditionService } from "@/services/mosqueAdditionService";
import { mosqueService } from "@/services/mosqueService";
import { authService } from "@/services/authService";

interface MosqueAdditionRequest {
  id: string;
  requester_name: string;
  requester_phone: string;
  city_name: string;
  district_name: string;
  mosque_name: string;
  google_maps_link: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface City {
  id: string;
  name: string;
}

interface District {
  id: string;
  name: string;
  city_id: string;
}

export default function MosqueAdditions() {
  const router = useRouter();
  const [requests, setRequests] = useState<MosqueAdditionRequest[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<MosqueAdditionRequest | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await authService.getCurrentSession();
      if (!session) {
        router.push("/dashboard/login");
        return;
      }
      
      const role = await authService.getUserRole(session.user.id);
      if (!role || !["customer_service", "admin"].includes(role)) {
        router.push("/dashboard/login");
        return;
      }
      loadRequests();
      loadCities();
    } catch (err) {
      router.push("/dashboard/login");
    }
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await mosqueAdditionService.getAllAdditionRequests();
      // Cast the data to ensure status type compatibility
      setRequests(data as unknown as MosqueAdditionRequest[]);
    } catch (err: any) {
      setError(err.message || "فشل في تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  };

  const loadCities = async () => {
    try {
      const citiesData = await mosqueService.getCities();
      setCities(citiesData);
    } catch (err) {
      console.error("Error loading cities:", err);
    }
  };

  useEffect(() => {
    if (selectedCityId) {
      const fetchDistricts = async () => {
        try {
          const data = await mosqueService.getDistricts(selectedCityId);
          setDistricts(data);
        } catch (err) {
          console.error("Error loading districts:", err);
          setDistricts([]);
        }
      };
      fetchDistricts();
    } else {
      setDistricts([]);
      setSelectedDistrictId("");
    }
  }, [selectedCityId]);

  const handleApprove = async () => {
    if (!selectedRequest || !selectedCityId || !selectedDistrictId) {
      setError("يرجى اختيار المدينة والحي");
      return;
    }

    try {
      setProcessingAction(true);
      await mosqueAdditionService.approveAndAddMosque(
        selectedRequest.id,
        selectedCityId,
        selectedDistrictId
      );
      setShowApproveDialog(false);
      setSelectedRequest(null);
      setSelectedCityId("");
      setSelectedDistrictId("");
      loadRequests();
    } catch (err: any) {
      setError(err.message || "فشل في إضافة المسجد");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) return;

    try {
      setProcessingAction(true);
      await mosqueAdditionService.rejectAdditionRequest(requestId);
      loadRequests();
    } catch (err: any) {
      setError(err.message || "فشل في رفض الطلب");
    } finally {
      setProcessingAction(false);
    }
  };

  const openApproveDialog = (request: MosqueAdditionRequest) => {
    setSelectedRequest(request);
    setSelectedCityId("");
    setSelectedDistrictId("");
    
    // محاولة العثور على المدينة تلقائياً
    const city = cities.find((c) => c.name === request.city_name);
    if (city) {
      setSelectedCityId(city.id);
    }
    setShowApproveDialog(true);
  };

  const filteredDistricts = selectedCityId
    ? districts.filter((d) => d.city_id === selectedCityId)
    : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500">معلق</Badge>;
      case "approved":
        return <Badge className="bg-green-500">تم الإضافة</Badge>;
      case "rejected":
        return <Badge className="bg-red-500">مرفوض</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const processedRequests = requests.filter((r) => r.status !== "pending");

  return (
    <>
      <SEO title="طلبات إضافة المساجد - نظام إدارة طلبات صيانة المساجد" />
      <DashboardLayout>
        <div className="space-y-6" dir="rtl">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">طلبات إضافة المساجد</h1>
            <p className="text-gray-600 mt-2">
              مراجعة وإضافة المساجد الجديدة المقترحة من المستفيدين
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* الإحصائيات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-green-50 p-4 rounded-lg space-y-2">
              <p>
                <span className="font-semibold">الطلبات المعلقة:</span>{" "}
                {pendingRequests.length}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg space-y-2">
              <p>
                <span className="font-semibold">الطلبات المعالجة:</span>{" "}
                {processedRequests.length}
              </p>
            </div>
          </div>

          {/* الطلبات المعلقة */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>الطلبات المعلقة</span>
                <Badge variant="secondary">{pendingRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : pendingRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  لا توجد طلبات معلقة
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم المستفيد</TableHead>
                      <TableHead className="text-right">رقم الهاتف</TableHead>
                      <TableHead className="text-right">اسم المسجد</TableHead>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الحي</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            {request.requester_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" dir="ltr">
                            <Phone className="h-4 w-4 text-gray-400" />
                            {request.requester_phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {request.mosque_name}
                          </div>
                        </TableCell>
                        <TableCell>{request.city_name}</TableCell>
                        <TableCell>{request.district_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {new Date(request.created_at).toLocaleDateString("ar-SA")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                window.open(request.google_maps_link, "_blank")
                              }
                            >
                              <ExternalLink className="h-4 w-4 ml-1" />
                              الموقع
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openApproveDialog(request)}
                              disabled={processingAction}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle2 className="h-4 w-4 ml-1" />
                              إضافة المسجد
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(request.id)}
                              disabled={processingAction}
                            >
                              <XCircle className="h-4 w-4 ml-1" />
                              رفض
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* الطلبات المعالجة */}
          {processedRequests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>الطلبات المعالجة</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">اسم المسجد</TableHead>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الحي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {request.mosque_name}
                        </TableCell>
                        <TableCell>{request.city_name}</TableCell>
                        <TableCell>{request.district_name}</TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {new Date(request.created_at).toLocaleDateString("ar-SA")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Dialog للموافقة وإضافة المسجد */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة المسجد إلى النظام</DialogTitle>
              <DialogDescription>
                يرجى تحديد المدينة والحي المناسبين لإضافة المسجد
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p>
                    <span className="font-semibold">اسم المسجد:</span>{" "}
                    {selectedRequest.mosque_name}
                  </p>
                  <p>
                    <span className="font-semibold">المدينة المقترحة:</span>{" "}
                    {selectedRequest.city_name}
                  </p>
                  <p>
                    <span className="font-semibold">الحي المقترح:</span>{" "}
                    {selectedRequest.district_name}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>المدينة *</Label>
                  <Select value={selectedCityId} onValueChange={setSelectedCityId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الحي *</Label>
                  <Select
                    value={selectedDistrictId}
                    onValueChange={setSelectedDistrictId}
                    disabled={!selectedCityId}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedCityId ? "اختر الحي" : "اختر المدينة أولاً"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDistricts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowApproveDialog(false)}
                disabled={processingAction}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processingAction || !selectedCityId || !selectedDistrictId}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingAction ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="ml-2 h-4 w-4" />
                    إضافة المسجد
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}