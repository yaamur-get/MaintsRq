import { useMemo, useState } from "react";
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
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Image as ImageIcon,
  Loader2,
  Phone,
  ShieldCheck,
  User,
  Users,
  WalletCards,
} from "lucide-react";
import { getRequesterRoleLabel, requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import {
  fetchInspectionReport,
  flattenInspectionReportItems,
  type ExternalInspectionResponse,
} from "@/services/inspectionReportService";

type WorkflowStep = "phone" | "review" | "funding" | "terms";
type FundingType = "ehsan" | "direct_donor" | "store_opportunity";

const fundingOptions: Array<{ value: FundingType; label: string; description: string }> = [
  { value: "ehsan", label: "إحسان", description: "يتم رفع الطلب على منصة إحسان" },
  { value: "direct_donor", label: "متبرع مباشر", description: "توجيه الطلب مباشرة إلى متبرع" },
  { value: "store_opportunity", label: "متجر (فرصة)", description: "عرض الطلب كفرصة تمويل في المتجر" },
];

const statusLabels: Record<string, string> = {
  pending_beneficiary_approval: "بانتظار موافقتكم على المعاينة والتسعير",
  beneficiary_approved_pricing: "تمت الموافقة على المعاينة والتسعير",
  pending_funding: "تم تأكيد الطلب وإحالته للتمويل",
};

export default function ApprovalPage() {
  const router = useRouter();
  const { id } = router.query;

  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("phone");
  const [phone, setPhone] = useState("");
  const [request, setRequest] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [externalReport, setExternalReport] = useState<ExternalInspectionResponse | null>(null);
  const [fundingSource, setFundingSource] = useState<FundingType | "">("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const reportItems = useMemo(
    () => flattenInspectionReportItems(externalReport),
    [externalReport]
  );

  const reviewItems = useMemo(() => {
    return reportItems.map((item, index) => {
      const matchedPricing = pricing.find((pricingItem: any) => {
        if (pricingItem.external_report_item_id && pricingItem.external_report_item_id === item.externalItemId) {
          return true;
        }

        return (
          (pricingItem.item_main_name || "") === item.mainItemName &&
          (pricingItem.item_sub_name || "") === item.subItemName
        );
      });

      return {
        ...item,
        displayItemId: `${request?.rq_number || "RQ-UNK"}-B-${String(index + 1).padStart(2, "0")}`,
        displayPricingId: `${request?.rq_number || "RQ-UNK"}-P-${String(index + 1).padStart(2, "0")}`,
        pricingRow: matchedPricing || null,
      };
    });
  }, [pricing, reportItems, request?.rq_number]);

  const totalPrice = useMemo(() => {
    return reviewItems.reduce((sum, item) => sum + Number(item.pricingRow?.estimated_price || 0), 0);
  }, [reviewItems]);

  const missingPricingCount = useMemo(() => {
    return reviewItems.filter((item) => Number(item.pricingRow?.estimated_price || 0) <= 0).length;
  }, [reviewItems]);

  const verifyPhone = async () => {
    try {
      setLoading(true);
      setError("");
      setInfoMessage("");

      const requestData = await requestService.getRequestById(id as string);
      if (!requestData) {
        setError("الطلب غير موجود");
        return;
      }

      if (requestData.beneficiary_phone !== phone) {
        setError("رقم الجوال غير مطابق للطلب");
        return;
      }

      if (!["pending_beneficiary_approval", "beneficiary_approved_pricing", "pending_funding"].includes(requestData.current_status || "")) {
        setError("هذا الطلب غير متاح حالياً في مرحلة موافقة المستفيد");
        return;
      }

      if (!requestData.rq_number) {
        setError("لا يمكن عرض المعاينة لعدم وجود رقم طلب مرتبط");
        return;
      }

      const reportData = await fetchInspectionReport(requestData.rq_number);
      if (!reportData) {
        setError("لا يمكن عرض التسعير قبل توفر تقرير المعاينة الكامل");
        return;
      }

      const pricingData = await pricingService.getExpertPricing(id as string);
      if (!pricingData || pricingData.length === 0) {
        setError("لا يمكن عرض صفحة الموافقة قبل توفر التسعير الكامل");
        return;
      }

      setRequest(requestData);
      setExternalReport(reportData);
      setPricing(pricingData);

      if (requestData.current_status === "pending_funding") {
        await router.replace(`/approval/tracking/${requestData.id}?phone=${encodeURIComponent(phone)}`);
        return;
      }

      if (requestData.current_status === "beneficiary_approved_pricing") {
        setWorkflowStep("funding");
        setInfoMessage("تمت موافقتكم مسبقاً على المعاينة والتسعير. يرجى اختيار قناة الدعم لإكمال الطلب.");
        return;
      }

      setWorkflowStep("review");
    } catch (verifyError) {
      console.error("Error verifying beneficiary approval page:", verifyError);
      setError("حدث خطأ أثناء جلب بيانات الطلب. يرجى المحاولة مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReview = () => {
    setError("");

    if (!externalReport || reviewItems.length === 0) {
      setError("لا يمكن الموافقة بدون عرض تقرير المعاينة كاملاً");
      return;
    }

    if (missingPricingCount > 0) {
      setError("بعض البنود لا تحتوي على تسعير مكتمل بعد");
      return;
    }

    setInfoMessage("تم حفظ موافقتكم على المعاينة والتسعير. بقي اختيار قناة الدعم ثم التأكيد النهائي.");
    setWorkflowStep("funding");
  };

  const handleFundingSelection = (value: FundingType) => {
    setFundingSource(value);
    setWorkflowStep("terms");
    setError("");
  };

  const handleFinalConfirmation = async () => {
    try {
      setLoading(true);
      setError("");

      if (!fundingSource) {
        setError("يرجى اختيار قناة الدعم المالي أولاً");
        return;
      }

      if (!acceptTerms) {
        setError("يلزم الموافقة على الشروط والأحكام قبل تأكيد الطلب");
        return;
      }

      await requestService.approveBeneficiary(id as string, fundingSource, totalPrice);
      await router.push(`/approval/tracking/${id}?phone=${encodeURIComponent(phone)}`);
    } catch (confirmError: any) {
      console.error("Error confirming beneficiary funding:", confirmError);
      setError(confirmError?.message || "تعذر تأكيد الطلب");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="موافقة المستفيد على التسعيرة - نظام إدارة صيانة المساجد"
        description="مراجعة تقرير المعاينة والتسعير ثم اختيار قناة الدعم وتأكيد الطلب"
      />

      <div className="min-h-screen bg-[linear-gradient(180deg,#f8faf7_0%,#ffffff_45%,#eef7f0_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-charity-primary shadow-lg">
              <Building className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">موافقة المستفيد على الطلب</h1>
            <p className="mt-2 text-slate-600">المعاينة ثم التسعير ثم الموافقة ثم تحديد قناة الدعم ثم التأكيد النهائي</p>
          </div>

          {workflowStep === "phone" ? (
            <Card className="mx-auto max-w-xl border-charity-border-calm shadow-sm">
              <CardHeader>
                <CardTitle className="text-center">التحقق من رقم الجوال</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال المسجل على الطلب</Label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Phone className="h-5 w-5 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      dir="ltr"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="05XXXXXXXX"
                      className="border-0 px-0 text-left shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                <Button
                  onClick={verifyPhone}
                  disabled={loading || !phone}
                  className="w-full bg-charity-primary text-white hover:bg-charity-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                      دخول صفحة الموافقة
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="border-charity-border-calm shadow-sm">
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">رقم الطلب</p>
                      <p className="mt-1 font-bold text-slate-900">{request?.rq_number || request?.id}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">المسجد</p>
                      <p className="mt-1 font-bold text-slate-900">{request?.mosque?.name || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">مقدم الطلب</p>
                      <p className="mt-1 font-bold text-slate-900">{request?.beneficiary_name || "-"}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">الحالة الحالية</p>
                      <p className="mt-1 font-bold text-charity-primary">{statusLabels[request?.current_status || ""] || request?.current_status}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <User className="h-5 w-5 text-charity-primary" />
                      <div>
                        <p className="text-sm text-slate-500">نوع مقدم الطلب</p>
                        <p className="font-semibold text-slate-900">{getRequesterRoleLabel(request?.requester_role)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <Users className="h-5 w-5 text-charity-primary" />
                      <div>
                        <p className="text-sm text-slate-500">نوع الاحتياج</p>
                        <p className="font-semibold text-slate-900">{request?.request_type?.name || "-"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-charity-border-calm shadow-sm">
                <CardHeader>
                  <CardTitle>خطوات الموافقة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { key: "review", title: "1. مراجعة المعاينة والتسعير", active: true },
                      { key: "funding", title: "2. اختيار قناة الدعم", active: workflowStep !== "review" },
                      { key: "terms", title: "3. الشروط والأحكام", active: workflowStep === "terms" || acceptTerms },
                      { key: "confirm", title: "4. تأكيد الطلب", active: acceptTerms },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className={`rounded-2xl border p-4 text-sm font-medium ${
                          item.active
                            ? "border-charity-primary bg-charity-bg-calm text-charity-primary"
                            : "border-slate-200 bg-white text-slate-500"
                        }`}
                      >
                        {item.title}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {infoMessage && (
                <Alert className="border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                  <AlertDescription className="text-emerald-800">{infoMessage}</AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <Card className="border-charity-border-calm shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-charity-primary" />
                    المرحلة 1: تقرير المعاينة الكامل
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    {externalReport?.report?.mosques?.main_photo_url && (
                      <img
                        src={externalReport.report.mosques.main_photo_url}
                        alt="صورة المسجد"
                        className="h-56 w-full rounded-2xl object-cover"
                      />
                    )}
                    {externalReport?.report?.map_photo_url && (
                      <img
                        src={externalReport.report.map_photo_url}
                        alt="صورة الموقع"
                        className="h-56 w-full rounded-2xl object-cover"
                      />
                    )}
                  </div>

                  <div className="space-y-4">
                    {reviewItems.map((item) => (
                      <Card key={item.externalItemId} className="border border-slate-200 shadow-none">
                        <CardContent className="pt-6">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge className="bg-charity-bg-calm text-charity-primary hover:bg-charity-bg-calm">{item.displayItemId}</Badge>
                                <span className="text-sm text-slate-500">معرف البند</span>
                              </div>
                              <h3 className="text-lg font-bold text-slate-900">{item.mainItemName}</h3>
                              <p className="mt-1 font-semibold text-charity-primary">{item.subItemName}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                              <p className="text-slate-500">الكمية</p>
                              <p className="font-bold text-slate-900">{item.quantity} {item.unit || "-"}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="mb-1 text-xs font-semibold text-slate-500">الوصف / المواصفات</p>
                              <p className="text-sm leading-7 text-slate-800">{item.specifications || "لا يوجد وصف إضافي"}</p>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <p className="mb-1 text-xs font-semibold text-slate-500">سبب الملاحظة / الملاحظات</p>
                              <p className="text-sm leading-7 text-slate-800">{item.causeName || item.issueNotes || "لا توجد ملاحظات إضافية"}</p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                              <ImageIcon className="h-4 w-4" />
                              الصور المرتبطة بالبند ({item.photos.length})
                            </div>
                            {item.photos.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {item.photos.map((photo) => (
                                  <a
                                    key={photo.id}
                                    href={photo.photo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                  >
                                    <img src={photo.photo_url} alt={item.displayItemId} className="h-44 w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                                لا توجد صور مرفقة لهذا البند.
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-charity-border-calm shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-charity-primary" />
                    المرحلة 2: التسعير المرتبط بالمعاينة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reviewItems.map((item) => (
                    <div key={item.externalItemId} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className="bg-charity-bg-calm text-charity-primary hover:bg-charity-bg-calm">{item.displayPricingId}</Badge>
                            <span className="text-sm text-slate-500">معرف التسعير</span>
                          </div>
                          <h3 className="font-bold text-slate-900">{item.mainItemName}</h3>
                          <p className="text-sm text-slate-600">{item.subItemName}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-slate-500">إجمالي البند</p>
                          <p className="text-xl font-bold text-charity-primary">
                            {Number(item.pricingRow?.estimated_price || 0).toLocaleString("ar-SA")} ريال
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">سعر الوحدة</p>
                          <p className="mt-1 font-bold text-slate-900">
                            {Number(item.pricingRow?.unit_price || 0).toLocaleString("ar-SA")} ريال
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">الكمية</p>
                          <p className="mt-1 font-bold text-slate-900">{item.quantity} {item.unit || "-"}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-4">
                          <p className="text-xs text-slate-500">ربط المشكلة بالسعر</p>
                          <p className="mt-1 text-sm text-slate-700">{item.specifications || item.issueNotes || "-"}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-3xl border border-charity-primary/20 bg-charity-bg-calm p-5">
                    <div className="flex items-center justify-between text-lg font-bold text-charity-primary">
                      <span>الإجمالي الكلي</span>
                      <span>{totalPrice.toLocaleString("ar-SA")} ريال</span>
                    </div>
                    {missingPricingCount > 0 && (
                      <p className="mt-3 text-sm text-red-700">
                        يوجد {missingPricingCount} بند بدون تسعير مكتمل، لذلك لا يمكن إتمام الموافقة حالياً.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {workflowStep === "review" && (
                <Card className="border-charity-border-calm shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-charity-primary" />
                      المرحلة 3: الموافقة على المعاينة والتسعير
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleApproveReview}
                      disabled={loading || missingPricingCount > 0 || reviewItems.length === 0}
                      className="w-full bg-charity-primary text-white hover:bg-charity-dark"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                          جاري حفظ الموافقة...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="ml-2 h-4 w-4" />
                          موافق على المعاينة والتسعير
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {workflowStep !== "review" && (
                <Card className="border-charity-border-calm shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <WalletCards className="h-5 w-5 text-charity-primary" />
                      المرحلة 4: اختيار قناة الدعم المالي
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {fundingOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleFundingSelection(option.value)}
                        className={`w-full rounded-2xl border p-4 text-right transition ${
                          fundingSource === option.value
                            ? "border-charity-primary bg-charity-bg-calm"
                            : "border-slate-200 bg-white hover:border-charity-primary/40"
                        }`}
                      >
                        <p className="font-bold text-slate-900">{option.label}</p>
                        <p className="mt-1 text-sm text-slate-600">{option.description}</p>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {workflowStep === "terms" && (
                <>
                  <Card className="border-charity-border-calm shadow-sm">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-charity-primary" />
                        المرحلة 5: الشروط والأحكام
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <Checkbox
                          checked={acceptTerms}
                          onCheckedChange={(checked) => setAcceptTerms(Boolean(checked))}
                        />
                        <span className="text-sm leading-7 text-slate-700">
                          أوافق على الشروط والأحكام، وأقر أنني اطلعت على المعاينة والتسعير بالكامل، وأن اختيار قناة الدعم المالي سيتم اعتماده على هذا الطلب.
                        </span>
                      </label>
                    </CardContent>
                  </Card>

                  <Card className="border-charity-border-calm shadow-sm">
                    <CardHeader>
                      <CardTitle>المرحلة 6: التأكيد النهائي</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={handleFinalConfirmation}
                        disabled={loading || !fundingSource || !acceptTerms}
                        className="w-full bg-charity-primary text-white hover:bg-charity-dark"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            جاري تأكيد الطلب...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="ml-2 h-4 w-4" />
                            تأكيد الطلب
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}