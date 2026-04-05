import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Edit2, Save, ArrowLeft, CheckCircle2, DollarSign, AlertTriangle, X } from "lucide-react";
import { requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import { authService } from "@/services/authService";
import Link from "next/link";

interface PricingRecord {
  id: string;
  item_main_name: string;
  item_sub_name: string;
  item_specifications: string;
  item_unit: string;
  quantity: number;
  unit_price: number;
  estimated_price: number;
  pricing_notes: string;
  approved: boolean;
}

export default function ViewPricingPage() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [pricings, setPricings] = useState<PricingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<PricingRecord>>({});

  useEffect(() => {
    if (id) {
      checkAuthorization();
      loadData();
    }
  }, [id]);

  const checkAuthorization = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (!user) {
        setHasPermission(false);
        setError("يجب تسجيل الدخول");
        return;
      }

      const role = await authService.getUserRole(user.id);
      setUserRole(role);

      const allowedRoles = ["pricing_expert", "project_manager", "admin"];
      if (!allowedRoles.includes(role || "")) {
        setHasPermission(false);
        setError("لا توجد صلاحيات كافية");
      }
    } catch (error: any) {
      console.error("خطأ في التحقق من الصلاحيات:", error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const requestData = await requestService.getRequestById(id as string);
      if (!requestData) {
        setError("لم يتم العثور على الطلب");
        return;
      }

      setRequest(requestData);

      const existingPricings = await pricingService.getExpertPricing(id as string);
      if (!existingPricings || existingPricings.length === 0) {
        setError("لم يتم العثور على تسعيرات لهذا الطلب");
        return;
      }

      setPricings(existingPricings);
    } catch (error: any) {
      console.error("خطأ في تحميل البيانات:", error);
      setError(`فشل تحميل البيانات: ${error?.message || "خطأ غير معروف"}`);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (pricing: PricingRecord) => {
    setEditingId(pricing.id);
    setEditValues(pricing);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({});
  };

  const updateFieldValue = (field: keyof PricingRecord, value: any) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: value,
    }));

    // إعادة حساب السعر الإجمالي
    if (field === "unit_price") {
      const quantity = editValues.quantity || 1;
      setEditValues((prev) => ({
        ...prev,
        estimated_price: (parseFloat(value) || 0) * quantity,
      }));
    }
  };

  const saveEdit = async (pricingId: string) => {
    try {
      setSaving(true);
      setError("");

      const currentPricing = pricings.find(p => p.id === pricingId);
      if (!currentPricing) return;

      await pricingService.upsertExpertPricing({
        request_id: id as string,
        external_report_item_id: currentPricing.id, // استخدم معرّف البند الحالي
        external_report_issue_id: currentPricing.id, // قد تحتاج إلى تعديل
        item_main_name: currentPricing.item_main_name,
        item_sub_name: currentPricing.item_sub_name,
        item_specifications: currentPricing.item_specifications,
        item_unit: currentPricing.item_unit,
        quantity: editValues.quantity || currentPricing.quantity,
        unit_price: editValues.unit_price || currentPricing.unit_price,
        estimated_price: editValues.estimated_price || currentPricing.estimated_price,
        pricing_notes: editValues.pricing_notes || currentPricing.pricing_notes,
        approved: currentPricing.approved,
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      setEditingId(null);
      setEditValues({});
      await loadData();
    } catch (error: any) {
      console.error("خطأ في الحفظ:", error);
      setError(`فشل الحفظ: ${error?.message || "حاول مرة أخرى"}`);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotal = () => {
    return pricings.reduce((sum, pricing) => sum + (pricing.estimated_price || 0), 0);
  };

  const buildDisplayPricingId = (pricingIndex: number) => {
    const rqNumber = request?.rq_number || "RQ-UNK";
    return `${rqNumber}-P-${String(pricingIndex + 1).padStart(2, "0")}`;
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

  if (!hasPermission) {
    return (
      <DashboardLayout>
        <Alert className="bg-red-50 border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <AlertDescription className="text-red-700 text-right">
            {error}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO
        title="عرض التسعيرات - نظام إدارة صيانة المساجد"
        description="عرض وتعديل التسعيرات المدخلة"
      />

      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={`/dashboard/requests/${id}`}>
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h2 className="text-3xl font-bold text-slate-900">عرض التسعيرات</h2>
                <p className="text-slate-600">
                  {request?.rq_number || `طلب ${request?.id?.substring(0, 8)}`} - {request?.mosque?.name}
                </p>
              </div>
            </div>
          </div>

          {/* Messages */}
          {success && (
            <Alert className="bg-charity-bg-calm border-charity-border-calm">
              <CheckCircle2 className="h-5 w-5 text-charity-primary" />
              <AlertDescription className="text-charity-primary">
                تم حفظ التعديلات بنجاح!
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-700 text-right">{error}</AlertDescription>
            </Alert>
          )}

          {/* Pricing List */}
          <div className="space-y-4">
            {pricings.map((pricing, index) => (
              <Card key={pricing.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">
                      {pricing.item_main_name} - {pricing.item_sub_name}
                    </CardTitle>
                    <span className="text-xs font-semibold px-2 py-1 rounded border border-charity-primary/30 bg-charity-bg-calm text-charity-primary whitespace-nowrap">
                      {buildDisplayPricingId(index)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    معرف التسعير: {buildDisplayPricingId(index)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editingId === pricing.id ? (
                    // Edit Mode
                    <>
                      {pricing.item_specifications && (
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-sm text-slate-600">{pricing.item_specifications}</p>
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>الكمية</Label>
                          <div className="h-10 px-3 rounded-md border bg-slate-50 flex items-center">
                            {editValues.quantity} {editValues.item_unit}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`price-${pricing.id}`}>سعر الوحدة (ريال) *</Label>
                          <div className="relative">
                            <DollarSign className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                            <Input
                              id={`price-${pricing.id}`}
                              type="number"
                              step="0.01"
                              min="0"
                              value={editValues.unit_price || 0}
                              onChange={(e) => updateFieldValue("unit_price", e.target.value)}
                              className="pr-10"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>الإجمالي</Label>
                          <div className="h-10 px-3 rounded-md border bg-slate-50 flex items-center font-semibold text-charity-primary">
                            {(editValues.estimated_price || 0).toLocaleString("ar-SA")} ريال
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`notes-${pricing.id}`}>الملاحظات</Label>
                          <Input
                            id={`notes-${pricing.id}`}
                            value={editValues.pricing_notes || ""}
                            onChange={(e) => updateFieldValue("pricing_notes", e.target.value)}
                            placeholder="إضافة ملاحظات..."
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          onClick={() => saveEdit(pricing.id)}
                          disabled={saving}
                          className="bg-charity-primary text-white hover:bg-charity-dark"
                        >
                          <Save className="w-4 h-4 ml-2" />
                          حفظ
                        </Button>
                        <Button className="border border-slate-400 bg-white text-slate-800 hover:bg-slate-100" onClick={cancelEditing}>
                          <X className="w-4 h-4 ml-2" />
                          إلغاء
                        </Button>
                      </div>
                    </>
                  ) : (
                    // View Mode
                    <>
                      {pricing.item_specifications && (
                        <div className="bg-slate-50 p-3 rounded-lg">
                          <p className="text-sm text-slate-600">{pricing.item_specifications}</p>
                        </div>
                      )}

                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-slate-600">الكمية</p>
                          <p className="font-medium">
                            {pricing.quantity} {pricing.item_unit}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-600">سعر الوحدة</p>
                          <p className="font-medium">
                            {pricing.unit_price?.toLocaleString("ar-SA")} ريال
                          </p>
                        </div>

                        <div className="text-left">
                          <p className="text-sm text-slate-600">الإجمالي</p>
                          <p className="text-lg font-bold text-charity-primary">
                            {pricing.estimated_price?.toLocaleString("ar-SA")} ريال
                          </p>
                        </div>
                      </div>

                      {pricing.pricing_notes && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-900">{pricing.pricing_notes}</p>
                        </div>
                      )}

                      {hasPermission && (
                        <div className="flex justify-end">
                          <Button
                            className="border border-charity-primary bg-charity-bg-calm text-charity-primary hover:bg-charity-primary hover:text-white"
                            size="sm"
                            onClick={() => startEditing(pricing)}
                          >
                            <Edit2 className="w-4 h-4 ml-2" />
                            تعديل
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total */}
          <Card className="bg-charity-bg-calm border-charity-border-calm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-2xl font-bold text-charity-primary">
                <span>الإجمالي التقديري:</span>
                <span>{calculateTotal().toLocaleString("ar-SA")} ريال</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  );
}
