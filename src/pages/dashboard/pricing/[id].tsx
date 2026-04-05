import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, ArrowLeft, CheckCircle2, DollarSign, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import { authService } from "@/services/authService";
import { fetchInspectionReport, flattenInspectionReportItems } from "@/services/inspectionReportService";
import Link from "next/link";

type InspectionPhoto = {
  id: string;
  photo_url: string;
  photo_order: number;
};

type PricingItem = {
  itemId: string;
  issueId: string;
  mainItem: string;
  subItem: string;
  specifications: string;
  quantity: number;
  unit: string;
  unitPrice: string;
  notes: string;
  photos: InspectionPhoto[];
};

export default function PricingPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<any>(null);
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

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
        setError("يجب تسجيل الدخول لعرض صفحة التسعير");
        return;
      }

      const role = await authService.getUserRole(user.id);
      setUserRole(role);

      // التحقق من أن المستخدم لديه صلاحية الوصول
      const allowedRoles = ["pricing_expert", "project_manager", "admin"];
      if (!allowedRoles.includes(role || "")) {
        setHasPermission(false);
        setError("ليس لديك صلاحية الوصول إلى صفحة التسعير. هذه الصفحة متاحة فقط لخبراء التسعير ومديري المشاريع.");
      }
    } catch (error: any) {
      console.error("خطأ في التحقق من التفويض:", error);
      setError("حدث خطأ في التحقق من الصلاحيات");
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      
      // جلب بيانات الطلب
      console.log("جاري جلب بيانات الطلب:", id);
      const requestData = await requestService.getRequestById(id as string);
      console.log("بيانات الطلب:", requestData);
      
      if (!requestData) {
        setError("لم يتم العثور على الطلب");
        setItems([]);
        return;
      }
      
      setRequest(requestData);

      if (!requestData?.rq_number) {
        setItems([]);
        setError("لا يوجد رقم طلب (rq_number) مرتبط بهذا الطلب. يرجى التأكد من إتمام بيانات الطلب أولاً.");
        return;
      }

      console.log("جاري جلب تقرير المعاينة الخارجي:", requestData.rq_number);
      const externalReport = await fetchInspectionReport(requestData.rq_number);
      console.log("تقرير المعاينة:", externalReport);
      
      if (!externalReport) {
        setItems([]);
        setError("لا يوجد تقرير معاينة خارجي متاح لهذا الطلب حالياً. يرجى التحقق من أن رقم الطلب صحيح وأن تقرير المعاينة قد تم تحميله.");
        return;
      }

      const reportItems = flattenInspectionReportItems(externalReport);
      console.log("عدد البنود من التقرير:", reportItems.length);
      
      if (reportItems.length === 0) {
        setItems([]);
        setError("لم يتم العثور على أي بنود في تقرير المعاينة.");
        return;
      }
      
      // جلب التسعيرات الموجودة
      console.log("جاري جلب التسعيرات الموجودة");
      const existingPricing = await pricingService.getExpertPricing(id as string);
      console.log("التسعيرات الموجودة:", existingPricing);
      
      // تحويل البنود إلى صيغة مناسبة للتسعير
      const pricingItems = reportItems.map((item) => {
        const existing = existingPricing.find((p: any) => p.external_report_item_id === item.externalItemId);
        return {
          itemId: item.externalItemId,
          issueId: item.externalIssueId,
          mainItem: item.mainItemName,
          subItem: item.subItemName,
          specifications: item.specifications || item.causeName || item.issueNotes || "",
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: existing?.unit_price?.toString() || "",
          notes: existing?.pricing_notes || "",
          photos: (item.photos || []).sort((a: any, b: any) => (a.photo_order || 0) - (b.photo_order || 0))
        };
      });

      console.log("عدد البنود المحضرة للتسعير:", pricingItems.length);
      setItems(pricingItems);
      setError(""); // مسح أي أخطاء سابقة
    } catch (error: any) {
      console.error("خطأ في تحميل البيانات:", error);
      setError(`فشل تحميل البيانات: ${error?.message || "خطأ غير معروف"}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof PricingItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    
    // حفظ فوري عند تحديث السعر
    if (field === "unitPrice" && value && parseFloat(value) > 0) {
      saveItemPrice(index, newItems[index]);
    }
  };

  const saveItemPrice = async (index: number, item: PricingItem) => {
    try {
      const unitPrice = parseFloat(item.unitPrice);
      if (unitPrice <= 0) return;
      
      console.log("جاري الحفظ الفوري للسعر:", item.itemId);
      await pricingService.upsertExpertPricing({
        request_id: id as string,
        external_report_item_id: item.itemId,
        external_report_issue_id: item.issueId,
        item_main_name: item.mainItem,
        item_sub_name: item.subItem,
        item_specifications: item.specifications,
        item_unit: item.unit,
        quantity: item.quantity,
        unit_price: unitPrice,
        estimated_price: unitPrice * item.quantity,
        pricing_notes: item.notes,
        approved: false
      });
      console.log("تم حفظ السعر بنجاح");
    } catch (error) {
      console.error("خطأ في الحفظ الفوري:", error);
    }
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => {
      const unitPrice = parseFloat(item.unitPrice) || 0;
      return sum + (unitPrice * item.quantity);
    }, 0);
  };

  const calculateItemTotal = (item: PricingItem) => {
    const unitPrice = parseFloat(item.unitPrice) || 0;
    return unitPrice * item.quantity;
  };

  const buildDisplayItemId = (itemIndex: number) => {
    const rqNumber = request?.rq_number || "RQ-UNK";
    return `${rqNumber}-B-${String(itemIndex + 1).padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError("");

      // التحقق من أن جميع البنود لها أسعار
      const itemsWithoutPrice = items.filter(item => !item.unitPrice || parseFloat(item.unitPrice) <= 0);
      if (itemsWithoutPrice.length > 0) {
        setError(`يرجى تعبئة أسعار جميع البنود (${itemsWithoutPrice.length} بند بدون سعر)`);
        return;
      }

      // حفظ التسعيرات
      console.log("جاري حفظ جميع التسعيرات");
      for (const item of items) {
        const unitPrice = parseFloat(item.unitPrice);
        await pricingService.upsertExpertPricing({
          request_id: id as string,
          external_report_item_id: item.itemId,
          external_report_issue_id: item.issueId,
          item_main_name: item.mainItem,
          item_sub_name: item.subItem,
          item_specifications: item.specifications,
          item_unit: item.unit,
          quantity: item.quantity,
          unit_price: unitPrice,
          estimated_price: unitPrice * item.quantity,
          pricing_notes: item.notes,
          approved: false // Default to unapproved
        });
      }

      console.log("تم حفظ جميع التسعيرات بنجاح");

      // تحديث حالة الطلب
      console.log("جاري تحديث حالة الطلب");
      await requestService.updateRequestStatus(
        id as string,
        "pending_pricing_approval",
        "تم رفع التسعيرة من الخبير"
      );

      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/requests/${id}`);
      }, 2000);

    } catch (error: any) {
      console.error("خطأ في حفظ التسعيرة:", error);
      setError(`فشل حفظ التسعيرة: ${error?.message || "خطأ غير معروف"}`);
    } finally {
      setSaving(false);
    }
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
        <div className="space-y-6">
          <Alert className="bg-red-50 border-red-200">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <AlertDescription className="text-red-700 text-right">
              {error}
            </AlertDescription>
          </Alert>
          <div className="flex justify-start">
            <Link href="/dashboard">
              <Button variant="outline">العودة إلى لوحة التحكم</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO 
        title="إضافة التسعيرة - نظام إدارة صيانة المساجد"
        description="إضافة تسعيرة تقديرية للبنود"
      />
      
      <DashboardLayout userRole="pricing_expert">
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
                <h2 className="text-3xl font-bold text-slate-900">تسعير البنود</h2>
                <p className="text-slate-600">
                  {request?.rq_number || `طلب ${request?.id?.substring(0, 8)}`} - {request?.mosque?.name}
                </p>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="bg-charity-bg-calm border-charity-border-calm">
              <CheckCircle2 className="h-5 w-5 text-charity-primary" />
              <AlertDescription className="text-charity-primary">
                تم حفظ التسعيرة بنجاح! جاري التحويل...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-700 text-right">{error}</AlertDescription>
            </Alert>
          )}

          {/* No Items Found */}
          {!loading && items.length === 0 && !error && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription className="text-blue-700 text-right">
                لم يتم العثور على بنود للتسعير. يرجى التحقق من أن تقرير المعاينة قد تم تحميله وأن الطلب يحتوي على بيانات صحيحة.
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing Items */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={item.itemId} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-l from-slate-50 to-transparent">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-lg text-slate-900">
                          بند {index + 1}: {item.mainItem}
                        </CardTitle>
                        <p className="text-sm font-semibold text-charity-primary mt-1">
                          {item.subItem}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          معرف البند: {buildDisplayItemId(index)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded border border-charity-primary/30 bg-charity-bg-calm text-charity-primary whitespace-nowrap">
                        {buildDisplayItemId(index)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm bg-white rounded p-2 border border-slate-200">
                      <div className="flex-1">
                        <span className="text-slate-500">الكمية:</span>
                        <p className="font-bold text-slate-900">{item.quantity}</p>
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-500">الوحدة:</span>
                        <p className="font-bold text-slate-900">{item.unit || "-"}</p>
                      </div>
                      <div className="flex-1">
                        <span className="text-slate-500">الإجمالي المقدر:</span>
                        <p className="font-bold text-charity-primary">{calculateItemTotal(item).toLocaleString("ar-SA")} ريال</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* صور البنود */}
                  {item.photos && item.photos.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-base font-semibold flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        صور البند ({item.photos.length})
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {item.photos.map((photo) => (
                          <a
                            key={photo.id}
                            href={photo.photo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative group overflow-hidden rounded-lg border border-slate-200 hover:border-charity-primary transition-colors"
                          >
                            <img
                              src={photo.photo_url}
                              alt={`صورة البند ${index + 1}`}
                              className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                              onError={(e) => {
                                e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3C/svg%3E";
                              }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                              <span className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                اضغط للتكبير
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* المواصفات */}
                  {item.specifications && (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold mb-1">المواصفات والملاحظات</p>
                      <p className="text-sm text-slate-700">{item.specifications}</p>
                    </div>
                  )}

                  {/* إدخال السعر والملاحظات */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`price-${index}`}>سعر الوحدة (ريال) *</Label>
                      <div className="relative">
                        <DollarSign className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                        <Input
                          id={`price-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, "unitPrice", e.target.value)}
                          placeholder="0.00"
                          className="pr-10"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>الإجمالي</Label>
                      <div className="h-10 px-3 rounded-md border bg-slate-50 flex items-center font-semibold text-charity-primary">
                        {calculateItemTotal(item).toLocaleString("ar-SA")} ريال
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`notes-${index}`}>ملاحظات التسعير</Label>
                      <Textarea
                        id={`notes-${index}`}
                        value={item.notes}
                        onChange={(e) => updateItem(index, "notes", e.target.value)}
                        placeholder="ملاحظات إضافية حول التسعير..."
                        rows={2}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total */}
          <Card className="bg-charity-bg-calm border-charity-border-calm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-2xl font-bold text-charity-primary">
                <span>الإجمالي التقديري:</span>
                <span>{calculateTotal().toLocaleString('ar-SA')} ريال</span>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-charity-primary text-white hover:bg-charity-dark"
              size="lg"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ التسعيرة وإرسالها للاعتماد
                </>
              )}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}