import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, ArrowLeft, CheckCircle2, Upload, FileText } from "lucide-react";
import { requestService } from "@/services/requestService";
import { inspectionService } from "@/services/inspectionService";
import { pricingService } from "@/services/pricingService";
import { supabase } from "@/integrations/supabase/client";
import Link from "next/link";

type BidItem = {
  itemId: string;
  mainItem: string;
  subItem: string;
  estimatedPrice: string;
  contractorId: string;
  bidAmount: string;
  bidDocument: File | null;
  bidDocumentUrl: string;
  notes: string;
  existingBidId?: string;
};

export default function BidsPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<any>(null);
  const [items, setItems] = useState<BidItem[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
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

      // جلب بنود المعاينة
      const inspectionItems = await inspectionService.getInspectionItems(id as string);
      
      // جلب التسعيرات (لعرض السعر التقديري)
      const pricing = await pricingService.getExpertPricing(id as string);
      
      // جلب العروض الموجودة
      const existingBids = await pricingService.getContractorBids(id as string);
      
      // جلب قائمة المقاولين
      const contractorsList = await pricingService.getContractors();
      setContractors(contractorsList);

      // تحويل البنود إلى صيغة مناسبة للعروض
      const bidItems = inspectionItems.map((item: any) => {
        const itemPricing = pricing.find((p: any) => p.inspection_item_id === item.id);
        const existing = existingBids.find((b: any) => b.inspection_item_id === item.id);
        
        return {
          itemId: item.id,
          mainItem: item.main_item,
          subItem: item.sub_item,
          estimatedPrice: itemPricing?.estimated_price?.toString() || "0",
          contractorId: existing?.contractor_id || "",
          bidAmount: existing?.bid_amount?.toString() || "",
          bidDocument: null,
          bidDocumentUrl: existing?.bid_document_url || "",
          notes: existing?.notes || "",
          existingBidId: existing?.id
        };
      });

      setItems(bidItems);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof BidItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleFileChange = (index: number, file: File | null) => {
    updateItem(index, "bidDocument", file);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError("");

      // التحقق من أن جميع البنود لها عروض
      if (items.some(item => !item.contractorId || !item.bidAmount || parseFloat(item.bidAmount) <= 0)) {
        setError("يرجى تعبئة جميع عروض المقاولين");
        return;
      }

      for (const item of items) {
        let bidId = item.existingBidId;
        let documentUrl = item.bidDocumentUrl;

        if (bidId) {
          // تحديث عرض موجود
          await pricingService.updateContractorBid(bidId, {
            contractor_id: item.contractorId,
            bid_amount: parseFloat(item.bidAmount),
            notes: item.notes
          });
        } else {
          // إضافة عرض جديد
          const newBid = await pricingService.addContractorBid({
            inspection_item_id: item.itemId,
            contractor_id: item.contractorId,
            bid_amount: parseFloat(item.bidAmount),
            notes: item.notes,
            is_selected: false
          });
          bidId = newBid.id;
        }

        // رفع المستند إذا تم اختيار ملف جديد
        if (item.bidDocument && bidId) {
          documentUrl = await pricingService.uploadBidDocument(
            item.bidDocument,
            bidId,
            id as string
          );
          
          // تحديث الرابط في العرض (تم بالفعل داخل uploadBidDocument لكن للتأكيد)
          // الدالة uploadBidDocument تقوم بالتحديث، لذا لا حاجة لخطوة إضافية هنا
        }
      }

      // تحديث حالة الطلب
      await requestService.updateRequestStatus(
        id as string,
        "pending_final_approval",
        "تم رفع عروض المقاولين"
      );

      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/requests/${id}`);
      }, 2000);

    } catch (error) {
      console.error("Error saving bids:", error);
      setError("فشل حفظ العروض. يرجى المحاولة مرة أخرى");
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
        title="إضافة عروض المقاولين - نظام إدارة صيانة المساجد"
        description="رفع عروض المقاولين للبنود"
      />
      
      <DashboardLayout userRole="technician">
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
                <h2 className="text-3xl font-bold text-slate-900">عروض المقاولين</h2>
                <p className="text-slate-600">
                  {request?.rq_number || `طلب ${request?.id?.substring(0, 8)}`} - {request?.mosque?.name}
                </p>
              </div>
            </div>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="bg-charity-bg-calm border-charity-bg-calm">
              <CheckCircle2 className="h-5 w-5 text-charity-green" />
              <AlertDescription className="text-charity-green">
                تم حفظ العروض بنجاح! جاري التحويل...
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="bg-charity-bg-calm border-charity-bg-calm">
              <AlertDescription className="text-charity-green">{error}</AlertDescription>
            </Alert>
          )}

          {/* Bid Items */}
          <div className="space-y-4">
            {items.map((item, index) => (
              <Card key={item.itemId}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    بند {index + 1}: {item.mainItem} - {item.subItem}
                  </CardTitle>
                  <p className="text-sm text-slate-600">
                    التسعير التقديري: {parseFloat(item.estimatedPrice).toLocaleString('ar-SA')} ريال
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`contractor-${index}`}>المقاول *</Label>
                      <Select
                        value={item.contractorId}
                        onValueChange={(value) => updateItem(index, "contractorId", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="اختر المقاول" />
                        </SelectTrigger>
                        <SelectContent>
                          {contractors.map((contractor) => (
                            <SelectItem key={contractor.id} value={contractor.id}>
                              {contractor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`bid-amount-${index}`}>مبلغ العرض (ريال) *</Label>
                      <Input
                        id={`bid-amount-${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.bidAmount}
                        onChange={(e) => updateItem(index, "bidAmount", e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`document-${index}`}>مستند العرض (PDF)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`document-${index}`}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileChange(index, e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      {item.bidDocumentUrl && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(item.bidDocumentUrl, '_blank')}
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`notes-${index}`}>ملاحظات</Label>
                    <Textarea
                      id={`notes-${index}`}
                      value={item.notes}
                      onChange={(e) => updateItem(index, "notes", e.target.value)}
                      placeholder="ملاحظات إضافية..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

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
                  حفظ العروض وإرسالها للاعتماد
                </>
              )}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}