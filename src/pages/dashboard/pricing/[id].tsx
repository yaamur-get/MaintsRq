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
import { Save, ArrowLeft, CheckCircle2, DollarSign } from "lucide-react";
import { requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import { fetchInspectionReport, flattenInspectionReportItems } from "@/services/inspectionReportService";
import Link from "next/link";

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

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // جلب بيانات الطلب
      const requestData = await requestService.getRequestById(id as string);
      setRequest(requestData);

      if (!requestData?.rq_number) {
        setItems([]);
        setError("لا يوجد rq_number مرتبط بهذا الطلب");
        return;
      }

      const externalReport = await fetchInspectionReport(requestData.rq_number);
      if (!externalReport) {
        setItems([]);
        setError("لا يوجد تقرير معاينة خارجي متاح لهذا الطلب حالياً");
        return;
      }
      
      // جلب التسعيرات الموجودة
      const existingPricing = await pricingService.getExpertPricing(id as string);
      const reportItems = flattenInspectionReportItems(externalReport);
      
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
          notes: existing?.pricing_notes || ""
        };
      });

      setItems(pricingItems);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof PricingItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
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

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError("");

      // التحقق من أن جميع البنود لها أسعار
      if (items.some(item => !item.unitPrice || parseFloat(item.unitPrice) <= 0)) {
        setError("يرجى تعبئة جميع الأسعار");
        return;
      }

      // حفظ التسعيرات
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

      // تحديث حالة الطلب
      await requestService.updateRequestStatus(
        id as string,
        "pending_pricing_approval",
        "تم رفع التسعيرة من الخبير"
      );

      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/requests/${id}`);
      }, 2000);

    } catch (error) {
      console.error("Error saving pricing:", error);
      setError("فشل حفظ التسعيرة. يرجى المحاولة مرة أخرى");
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
              <CheckCircle2 className="h-5 w-5 text-charity-green" />
              <AlertDescription className="text-charity-green">
                تم حفظ التسعيرة بنجاح! جاري التحويل...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="bg-charity-bg-calm border-charity-border-calm">
              <AlertDescription className="text-charity-green">{error}</AlertDescription>
            </Alert>
          )}

          {/* Pricing Items */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={item.itemId}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>بند {index + 1}: {item.mainItem} - {item.subItem}</span>
                    <span className="text-sm font-medium text-slate-500">
                      الكمية: {item.quantity} {item.unit || ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {item.specifications && (
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-sm text-slate-600">{item.specifications}</p>
                    </div>
                  )}

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
              <div className="flex items-center justify-between text-2xl font-bold text-charity-green">
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
              className="bg-charity-green hover:bg-charity-green"
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