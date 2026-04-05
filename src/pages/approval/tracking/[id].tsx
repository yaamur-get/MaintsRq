import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building, CheckCircle2, Clock3, Loader2, Phone, RefreshCcw } from "lucide-react";
import { requestService } from "@/services/requestService";

const statusLabels: Record<string, string> = {
  pending_beneficiary_approval: "بانتظار موافقة المستفيد",
  beneficiary_approved_pricing: "تمت الموافقة على المعاينة والتسعير",
  pending_funding: "جاري البحث عن تمويل",
  pending_contractor_bids: "تم اكتمال التمويل وبانتظار عروض المقاولين",
  pending_final_approval: "بانتظار الموافقة النهائية",
  in_progress: "الطلب قيد التنفيذ",
  pending_final_report: "بانتظار التقرير الختامي",
  pending_closure: "بانتظار إغلاق الطلب",
  closed: "تم إغلاق الطلب",
  cancelled: "تم إلغاء الطلب",
};

const statusStyles: Record<string, string> = {
  pending_beneficiary_approval: "bg-amber-100 text-amber-800 border-amber-200",
  beneficiary_approved_pricing: "bg-emerald-100 text-emerald-800 border-emerald-200",
  pending_funding: "bg-sky-100 text-sky-800 border-sky-200",
  pending_contractor_bids: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pending_final_approval: "bg-violet-100 text-violet-800 border-violet-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  pending_final_report: "bg-orange-100 text-orange-800 border-orange-200",
  pending_closure: "bg-slate-100 text-slate-800 border-slate-200",
  closed: "bg-charity-bg-calm text-charity-primary border-charity-border-calm",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const fundingLabels: Record<string, string> = {
  ehsan: "إحسان",
  direct_donor: "متبرع مباشر",
  store_opportunity: "متجر (فرصة)",
};

export default function ApprovalTrackingPage() {
  const router = useRouter();
  const { id, phone: phoneQuery } = router.query;

  const [phone, setPhone] = useState("");
  const [verified, setVerified] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const latestUpdate = useMemo(() => {
    if (!timeline.length) return null;
    return timeline[timeline.length - 1];
  }, [timeline]);

  const loadTracking = async (phoneValue: string) => {
    try {
      setLoading(true);
      setError("");

      const requestData = await requestService.getRequestById(id as string);
      if (!requestData) {
        setError("الطلب غير موجود");
        return;
      }

      if (requestData.beneficiary_phone !== phoneValue) {
        setError("رقم الجوال غير مطابق للطلب");
        return;
      }

      const timelineData = await requestService.getRequestTimeline(id as string).catch(() => []);

      setRequest(requestData);
      setTimeline(timelineData);
      setVerified(true);
    } catch (loadError) {
      console.error("Error loading approval tracking:", loadError);
      setError("تعذر تحميل صفحة متابعة الطلب");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof phoneQuery === "string" && phoneQuery && !verified) {
      setPhone(phoneQuery);
      void loadTracking(phoneQuery);
    }
  }, [phoneQuery, verified]);

  useEffect(() => {
    if (!verified || !phone || !id) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadTracking(phone);
    }, 30000);

    return () => window.clearInterval(interval);
  }, [verified, phone, id]);

  return (
    <>
      <SEO
        title="متابعة الطلب - نظام إدارة صيانة المساجد"
        description="متابعة حالة الطلب بعد موافقة المستفيد على التسعير"
      />

      <div className="min-h-screen bg-[linear-gradient(180deg,#f8faf7_0%,#ffffff_45%,#eef7f0_100%)]">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-charity-primary shadow-lg">
              <Building className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">متابعة الطلب</h1>
            <p className="mt-2 text-slate-600">أي تحديث في النظام سيظهر هنا مباشرة</p>
          </div>

          {!verified ? (
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
                  <Label htmlFor="tracking-phone">رقم الجوال المسجل على الطلب</Label>
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <Phone className="h-5 w-5 text-slate-400" />
                    <Input
                      id="tracking-phone"
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
                  onClick={() => loadTracking(phone)}
                  disabled={loading || !phone}
                  className="w-full bg-charity-primary text-white hover:bg-charity-dark"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري فتح المتابعة...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="ml-2 h-4 w-4" />
                      عرض حالة الطلب
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-end">
                <Button
                  onClick={() => loadTracking(phone)}
                  disabled={loading}
                  className="border border-charity-primary bg-white text-charity-primary hover:bg-charity-bg-calm"
                >
                  <RefreshCcw className="ml-2 h-4 w-4" />
                  تحديث الآن
                </Button>
              </div>

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
                      <p className="text-sm text-slate-500">الحالة الحالية</p>
                      <Badge className={`${statusStyles[request?.current_status || ""] || "bg-slate-100 text-slate-800 border-slate-200"} mt-2 border`}>
                        {statusLabels[request?.current_status || ""] || request?.current_status}
                      </Badge>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">قناة الدعم</p>
                      <p className="mt-1 font-bold text-slate-900">{fundingLabels[request?.funding_type || ""] || "لم تحدد بعد"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-charity-border-calm shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-charity-primary" />
                    المرحلة الحالية
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">المرحلة</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {request?.current_status === "pending_funding"
                        ? `تمت الموافقة - جاري البحث عن تمويل${request?.funding_type ? ` عبر ${fundingLabels[request.funding_type]}` : ""}`
                        : statusLabels[request?.current_status || ""] || "يتم تحديث الحالة"}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">آخر تحديث</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {latestUpdate?.created_at
                          ? new Date(latestUpdate.created_at).toLocaleString("ar-SA")
                          : request?.updated_at
                            ? new Date(request.updated_at).toLocaleString("ar-SA")
                            : "غير متوفر"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm text-slate-500">المبلغ المعتمد</p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {Number(request?.approved_amount || 0).toLocaleString("ar-SA")} ريال
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>
      </div>
    </>
  );
}