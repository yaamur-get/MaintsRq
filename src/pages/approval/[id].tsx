import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  User, 
  Users,
  Phone, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { getRequesterRoleLabel, requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";

export default function ApprovalPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [step, setStep] = useState<"phone" | "approval">("phone");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [fundingSource, setFundingSource] = useState<string>("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const verifyPhone = async () => {
    try {
      setLoading(true);
      setError("");

      const requestData = await requestService.getRequestById(id as string);
      
      if (!requestData) {
        setError("الطلب غير موجود");
        return;
      }

      // التحقق من رقم الجوال
      if (requestData.beneficiary_phone !== phone) {
        setError("رقم الجوال غير صحيح");
        return;
      }

      // التحقق من حالة الطلب
      if (requestData.current_status !== "pending_beneficiary_approval") {
        setError("هذا الطلب غير متاح للموافقة حالياً");
        return;
      }

      // جلب التسعيرات
      const pricingData = await pricingService.getExpertPricing(id as string);
      
      setRequest(requestData);
      setPricing(pricingData);
      setStep("approval");

    } catch (error) {
      console.error("Error verifying phone:", error);
      setError("حدث خطأ في التحقق. يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    try {
      setLoading(true);
      setError("");

      if (approved) {
        if (!fundingSource) {
          setError("يرجى اختيار قناة الدعم");
          return;
        }
        if (!acceptTerms) {
          setError("يرجى الموافقة على الشروط والأحكام");
          return;
        }

        // تحويل القيمة العربية إلى enum الإنجليزي
        const fundingTypeMap: Record<string, "ehsan" | "direct_donor" | "store_opportunity"> = {
          "إحسان": "ehsan",
          "متبرع مباشر": "direct_donor",
          "فرصة متجر": "store_opportunity"
        };

        const fundingTypeValue = fundingTypeMap[fundingSource];

        // استخدام الدالة الجديدة التي تحدث funding_type
        await requestService.approveBeneficiary(
          id as string,
          fundingTypeValue,
          totalPrice
        );

        setSuccess(true);
      } else {
        // رفض المستفيد
        await requestService.updateRequestStatus(
          id as string,
          "cancelled",
          "رفض المستفيد للتسعيرة"
        );

        setSuccess(true);
      }

    } catch (error: any) {
      console.error("Error submitting approval:", error);
      setError(error.message || "حدث خطأ في الإرسال. يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = pricing.reduce((sum, item) => sum + (item.estimated_price || 0), 0);

  return (
    <>
      <SEO 
        title="موافقة المستفيد - نظام إدارة طلبات صيانة المساجد"
        description="صفحة الموافقة على التسعيرة وتحديد الدعم"
      />
      
      <div className="min-h-screen bg-gradient-to-br from-charity-bg-light via-white to-charity-bg-calm">
        <div className="container max-w-4xl mx-auto px-4 py-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-20 h-20 bg-charity-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Building className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              نظام إدارة صيانة المساجد
            </h1>
            <p className="text-slate-600">صفحة الموافقة على التسعيرة</p>
          </div>

          {/* Success Message */}
          {success && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <CheckCircle2 className="w-16 h-16 text-charity-primary mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">
                    تم استلام ردكم بنجاح
                  </h3>
                  <p className="text-slate-600">
                    شكراً لتعاونكم. سيتم التواصل معكم قريباً
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === "phone" ? (
            /* Phone Verification Step */
            <Card>
              <CardHeader>
                <CardTitle className="text-center">التحقق من رقم الجوال</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {error && (
                  <Alert className="bg-charity-bg-calm border-charity-medium">
                    <AlertCircle className="h-5 w-5 text-charity-dark" />
                    <AlertDescription className="text-charity-dark">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال المسجل في الطلب</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="text-left"
                      dir="ltr"
                    />
                  </div>
                </div>

                <Button
                  onClick={verifyPhone}
                  disabled={loading || !phone}
                  className="w-full bg-charity-primary hover:bg-charity-dark text-white py-6"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      تحقق
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            /* Approval Step */
            <div className="space-y-6">
              {/* Request Info */}
              <Card>
                <CardHeader>
                  <CardTitle>بيانات الطلب</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">المسجد</p>
                        <p className="font-medium text-slate-900">{request?.mosque?.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">مقدم الطلب</p>
                        <p className="font-medium text-slate-900">{request?.beneficiary_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm text-slate-500">صفة مقدم الطلب</p>
                        <p className="font-medium text-slate-900">{getRequesterRoleLabel(request?.requester_role)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-slate-500 mb-2">نوع الاحتياج</p>
                    <Badge variant="outline" className="text-base">
                      {request?.request_type?.name}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Pricing Details */}
              <Card className="border-charity-medium bg-charity-bg-light">
                <CardHeader>
                  <CardTitle className="text-2xl text-right">تفاصيل التسعيرة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pricing.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-900">{item.item_main_name || "بند تسعير"}</p>
                          <p className="text-sm text-slate-600">{item.item_sub_name || "-"}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            الكمية: {Number(item.quantity || 1)} {item.item_unit || ""}
                            {item.unit_price ? ` · سعر الوحدة: ${Number(item.unit_price).toLocaleString("ar-SA")} ريال` : ""}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-charity-primary">
                          {item.estimated_price?.toLocaleString("ar-SA")} ريال
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Funding Source */}
              <Card>
                <CardHeader>
                  <CardTitle>قناة الدعم المالي</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["إحسان", "متبرع مباشر", "فرصة متجر"].map((source) => (
                    <label
                      key={source}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        fundingSource === source
                          ? "border-charity-primary bg-charity-bg-calm"
                          : "border-gray-200 hover:border-charity-medium"
                      }`}
                    >
                      <input
                        type="radio"
                        name="funding"
                        value={source}
                        checked={fundingSource === source}
                        onChange={(e) => setFundingSource(e.target.value)}
                        className="text-charity-primary"
                      />
                      <span className="font-medium text-slate-900">{source}</span>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Terms */}
              <Card>
                <CardContent className="pt-6">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={acceptTerms}
                      onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    />
                    <span className="text-sm text-slate-700">
                      أوافق على الشروط والأحكام وأقر بصحة المعلومات المقدمة
                    </span>
                  </label>
                </CardContent>
              </Card>

              {error && (
                <Alert className="bg-charity-bg-calm border-charity-medium">
                  <AlertCircle className="h-5 w-5 text-charity-dark" />
                  <AlertDescription className="text-charity-dark">{error}</AlertDescription>
                </Alert>
              )}

              {/* Actions */}
              <div className="grid md:grid-cols-2 gap-4">
                <Button
                  onClick={() => handleApproval(false)}
                  disabled={loading}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 ml-2" />
                  رفض التسعيرة
                </Button>

                <Button
                  type="submit"
                  disabled={loading || !fundingSource || !acceptTerms}
                  className="bg-charity-primary hover:bg-charity-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                      موافقة وتأكيد
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}