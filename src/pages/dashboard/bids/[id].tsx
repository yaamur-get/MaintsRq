import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Save,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Plus,
  Trash2,
  User,
  Phone,
  Mail,
  DollarSign,
  Upload,
  AlertCircle,
} from "lucide-react";
import { requestService } from "@/services/requestService";
import { pricingService, type ContractorBidPayloadItem } from "@/services/pricingService";
import { supabase } from "@/integrations/supabase/client";
import Link from "next/link";

type PricingItem = {
  itemId: string;
  inspectionItemId?: string;
  externalReportItemId?: string;
  mainItem: string;
  subItem: string;
  quantity: number;
  unit: string;
};

type ContractorItemBid = {
  itemId: string;
  bidAmount: string;
  details: string;
  isOffered: boolean;
};

type ContractorEntry = {
  uid: string;
  dbId?: string;
  name: string;
  phone: string;
  email: string;
  bidFile: File | null;
  bidFileUrl: string;
  items: ContractorItemBid[];
};

function makeContractorEntry(pricingItems: PricingItem[]): ContractorEntry {
  return {
    uid: Math.random().toString(36).slice(2) + Date.now(),
    name: "",
    phone: "",
    email: "",
    bidFile: null,
    bidFileUrl: "",
    items: pricingItems.map((p) => ({ itemId: p.itemId, bidAmount: "", details: "", isOffered: false })),
  };
}

export default function BidsPage() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [contractors, setContractors] = useState<ContractorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const requestData = await requestService.getRequestById(id as string);
      setRequest(requestData);

      const pricing = await pricingService.getExpertPricing(id as string);
      if (!pricing.length) {
        setError("لا توجد تسعيرات محفوظة لهذا الطلب. أضف التسعيرات أولاً.");
        return;
      }

      const items: PricingItem[] = pricing.map((p: any) => ({
        itemId: p.external_report_item_id || p.inspection_item_id || p.id,
        inspectionItemId: p.inspection_item_id || undefined,
        externalReportItemId: p.external_report_item_id || undefined,
        mainItem: p.item_main_name || "بند",
        subItem: p.item_sub_name || "-",
        quantity: Number(p.quantity || 1),
        unit: p.item_unit || "",
      }));
      setPricingItems(items);

      try {
        const existingBids = await pricingService.getContractorBids(id as string);
        if (existingBids.length > 0) {
          const byContractor = new Map<string, any[]>();
          for (const bid of existingBids) {
            const cid = bid.contractor_id;
            if (!byContractor.has(cid)) byContractor.set(cid, []);
            byContractor.get(cid)!.push(bid);
          }

          const rebuilt: ContractorEntry[] = [];
          for (const [cid, bids] of byContractor.entries()) {
            const c = bids[0].contractor;
            rebuilt.push({
              uid: cid,
              dbId: cid,
              name: c?.name || "",
              phone: c?.phone || "",
              email: c?.email || "",
              bidFile: null,
              bidFileUrl: bids[0]?.bid_document_url || "",
              items: items.map((p) => {
                const match = bids.find(
                  (b: any) =>
                    (p.externalReportItemId && b.external_report_item_id === p.externalReportItemId) ||
                    (p.inspectionItemId && b.inspection_item_id === p.inspectionItemId)
                );
                return {
                  itemId: p.itemId,
                  bidAmount: match?.bid_amount?.toString() || "",
                  details: match?.notes || "",
                  isOffered: match ? match.bid_status !== "not_offered" : false,
                };
              }),
            });
          }
          setContractors(rebuilt);
        } else {
          setContractors([makeContractorEntry(items)]);
        }
      } catch (bidsError) {
        console.warn("Non-critical error loading existing bids, starting with empty contractor form:", bidsError);
        setContractors([makeContractorEntry(items)]);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const addContractor = () => {
    setDraftSaved(false);
    setContractors((prev) => [...prev, makeContractorEntry(pricingItems)]);
  };

  const removeContractor = (uid: string) => {
    setDraftSaved(false);
    setContractors((prev) => prev.filter((c) => c.uid !== uid));
  };

  const updateContractor = (
    uid: string,
    field: keyof Omit<ContractorEntry, "items" | "uid" | "dbId">,
    value: any
  ) => {
    setDraftSaved(false);
    setContractors((prev) => prev.map((c) => (c.uid === uid ? { ...c, [field]: value } : c)));
  };

  const updateContractorItem = (uid: string, itemId: string, field: keyof Omit<ContractorItemBid, "itemId" | "isOffered">, value: string) => {
    setDraftSaved(false);
    setContractors((prev) =>
      prev.map((c) =>
        c.uid === uid
          ? { ...c, items: c.items.map((it) => (it.itemId === itemId ? { ...it, [field]: value } : it)) }
          : c
      )
    );
  };

  const toggleContractorItemOffered = (uid: string, itemId: string, checked: boolean) => {
    setDraftSaved(false);
    setContractors((prev) =>
      prev.map((c) =>
        c.uid === uid
          ? {
              ...c,
              items: c.items.map((it) =>
                it.itemId === itemId
                  ? {
                      ...it,
                      isOffered: checked,
                      bidAmount: checked ? it.bidAmount : "",
                      details: checked ? it.details : "",
                    }
                  : it
              ),
            }
          : c
      )
    );
  };

  const contractorTotal = (c: ContractorEntry) =>
    c.items.reduce((s, it) => (it.isOffered ? s + (parseFloat(it.bidAmount) || 0) : s), 0);

  const coverageSummary = useMemo(() => {
    const covered = new Set<string>();

    for (const item of pricingItems) {
      const hasOffer = contractors.some((c) => {
        const matched = c.items.find((it) => it.itemId === item.itemId);
        return Boolean(matched?.isOffered && (parseFloat(matched.bidAmount || "0") > 0));
      });

      if (hasOffer) {
        covered.add(item.itemId);
      }
    }

    const missingItems = pricingItems.filter((item) => !covered.has(item.itemId));

    return {
      totalItems: pricingItems.length,
      coveredItems: covered.size,
      missingItems,
    };
  }, [pricingItems, contractors]);

  const ensureEditableRequestStatus = () => {
    if (request?.current_status !== "pending_contractor_bids") {
      setError("تم إرسال العروض مسبقاً أو أن الطلب ليس في مرحلة عروض المقاولين، لذلك لا يمكن التعديل.");
      return false;
    }
    return true;
  };

  const validateContractors = (requireFullCoverage: boolean) => {
    if (contractors.length === 0) {
      setError("يرجى إضافة مقاول واحد على الأقل");
      return false;
    }

    const normalizedNames = contractors.map((c) => c.name.trim().toLowerCase()).filter(Boolean);
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      setError("يوجد تكرار في أسماء المقاولين. يرجى إدخال اسم فريد لكل مقاول");
      return false;
    }

    for (const c of contractors) {
      if (!c.name.trim()) {
        setError("يرجى إدخال اسم المقاول لجميع المقاولين");
        return false;
      }
      if (!c.phone.trim()) {
        setError("يرجى إدخال رقم جوال المقاول لجميع المقاولين");
        return false;
      }

      const offeredItems = c.items.filter((it) => it.isOffered);
      if (offeredItems.length === 0) {
        setError(`المقاول "${c.name}" لا يحتوي أي بند محدد كعرض. اختر بنداً واحداً على الأقل أو احذفه.`);
        return false;
      }

      if (!c.bidFile && !c.bidFileUrl) {
        setError(`يرجى رفع ملف عرض السعر للمقاول "${c.name}"`);
        return false;
      }

      const invalidOfferedItem = offeredItems.find((it) => !it.bidAmount || parseFloat(it.bidAmount) <= 0);
      if (invalidOfferedItem) {
        const itemMeta = pricingItems.find((p) => p.itemId === invalidOfferedItem.itemId);
        setError(`يرجى إدخال مبلغ صحيح للبند "${itemMeta?.mainItem || "بند"}" للمقاول "${c.name}"`);
        return false;
      }
    }

    if (requireFullCoverage && coverageSummary.missingItems.length > 0) {
      const labels = coverageSummary.missingItems.map((item) => `${item.mainItem} - ${item.subItem}`).join("، ");
      setError(`لا يمكن الإرسال: البنود التالية بلا عروض: ${labels}`);
      return false;
    }

    return true;
  };

  const resolveContractorId = async (entry: ContractorEntry) => {
    const contractorName = entry.name.trim();
    const contractorPhone = entry.phone.trim();
    const contractorEmail = entry.email.trim();

    if (entry.dbId) {
      await (supabase as any)
        .from("contractors")
        .update({ name: contractorName, phone: contractorPhone, email: contractorEmail || null })
        .eq("id", entry.dbId);
      return entry.dbId;
    }

    const { data: existingContractor } = await (supabase as any)
      .from("contractors")
      .select("id")
      .eq("name", contractorName)
      .maybeSingle();

    if (existingContractor?.id) {
      await (supabase as any)
        .from("contractors")
        .update({ phone: contractorPhone, email: contractorEmail || null, is_active: true })
        .eq("id", existingContractor.id);
      return existingContractor.id;
    }

    const { data: newContractor, error } = await (supabase as any)
      .from("contractors")
      .insert({ name: contractorName, phone: contractorPhone, email: contractorEmail || null, is_active: true })
      .select("id")
      .single();

    if (error) throw error;
    return newContractor.id;
  };

  const uploadContractorFileIfNeeded = async (entry: ContractorEntry, contractorId: string) => {
    if (!entry.bidFile) {
      return entry.bidFileUrl || null;
    }

    const ext = entry.bidFile.name.split(".").pop();
    const path = `${id as string}/bids/${contractorId}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("bid-documents")
      .upload(path, entry.bidFile, { upsert: true });

    if (uploadErr) throw uploadErr;

    const {
      data: { publicUrl },
    } = supabase.storage.from("bid-documents").getPublicUrl(path);

    return publicUrl || null;
  };

  const buildBidPayload = async (): Promise<ContractorBidPayloadItem[]> => {
    const payload: ContractorBidPayloadItem[] = [];

    const nextContractors: ContractorEntry[] = [];

    for (const contractor of contractors) {
      const contractorId = await resolveContractorId(contractor);
      const fileUrl = await uploadContractorFileIfNeeded(contractor, contractorId);

      nextContractors.push({
        ...contractor,
        dbId: contractorId,
        bidFile: null,
        bidFileUrl: fileUrl || contractor.bidFileUrl,
      });

      for (const pricingItem of pricingItems) {
        const itemBid = contractor.items.find((it) => it.itemId === pricingItem.itemId);
        const isOffered = Boolean(itemBid?.isOffered);

        payload.push({
          contractor_id: contractorId,
          external_report_item_id: pricingItem.externalReportItemId || null,
          inspection_item_id: pricingItem.inspectionItemId || null,
          item_main_name: pricingItem.mainItem,
          item_sub_name: pricingItem.subItem,
          quantity: pricingItem.quantity,
          bid_amount: isOffered ? parseFloat(itemBid?.bidAmount || "0") : null,
          notes: isOffered ? (itemBid?.details || "") : null,
          bid_document_url: fileUrl || contractor.bidFileUrl || null,
          bid_status: isOffered ? "offered" : "not_offered",
        });
      }
    }

    setContractors(nextContractors);

    return payload;
  };

  const handleSaveDraft = async () => {
    setError("");
    setDraftSaved(false);

    if (!ensureEditableRequestStatus()) return;
    if (!validateContractors(false)) return;

    try {
      setSavingDraft(true);
      const payload = await buildBidPayload();
      await pricingService.saveContractorBidsDraft(id as string, payload);
      setDraftSaved(true);
    } catch (err: any) {
      console.error("Error saving bids draft:", err);
      setError("فشل حفظ المسودة: " + (err?.message || "يرجى المحاولة مرة أخرى"));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    setError("");

    if (!ensureEditableRequestStatus()) return;
    if (!validateContractors(true)) return;

    try {
      setSaving(true);
      const payload = await buildBidPayload();
      await pricingService.submitContractorBidsWithCoverage(
        id as string,
        payload,
        "تم رفع عروض المقاولين - بانتظار اختيار المقاول من مهندس المشروع"
      );

      setSuccess(true);
      setTimeout(() => router.push(`/dashboard/requests/${id}`), 1800);
    } catch (err: any) {
      console.error("Error submitting bids:", err);
      setError("فشل إرسال العروض: " + (err?.message || "يرجى المحاولة مرة أخرى"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-charity-primary mx-auto mb-4" />
            <p className="text-slate-600">جاري التحميل...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const canSubmit =
    !saving &&
    !savingDraft &&
    !success &&
    request?.current_status === "pending_contractor_bids" &&
    coverageSummary.totalItems > 0 &&
    coverageSummary.missingItems.length === 0;

  return (
    <>
      <SEO title="عروض المقاولين - نظام إدارة صيانة المساجد" description="رفع عروض المقاولين للبنود" />
      <DashboardLayout userRole="technician">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/requests/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">عروض المقاولين</h2>
              <p className="text-slate-500 text-sm">
                {request?.rq_number || id} · {request?.mosque?.name}
              </p>
            </div>
          </div>

          {request?.current_status !== "pending_contractor_bids" && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <AlertDescription className="text-amber-800">
                هذا الطلب لم يعد في مرحلة عروض المقاولين. التعديل مقفل بعد الإرسال النهائي.
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                تم إرسال العروض بنجاح وإحالتها لمهندس المشروع.
              </AlertDescription>
            </Alert>
          )}

          {draftSaved && !success && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle2 className="h-5 w-5 text-blue-600" />
              <AlertDescription className="text-blue-800">
                تم حفظ المسودة بنجاح. يمكنك المتابعة ثم الإرسال النهائي لاحقاً.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <Card className="border-charity-medium bg-charity-bg-calm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">مؤشر تغطية البنود</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-slate-700">
                التغطية الحالية: <span className="font-bold text-charity-primary">{coverageSummary.coveredItems}/{coverageSummary.totalItems}</span>
              </p>
              {coverageSummary.missingItems.length > 0 ? (
                <div className="text-sm text-red-700">
                  <p className="font-semibold mb-1">البنود غير المغطاة:</p>
                  <p>
                    {coverageSummary.missingItems
                      .map((item) => `${item.mainItem} - ${item.subItem}`)
                      .join("، ")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-green-700 font-semibold">كل البنود مغطاة بعرض واحد على الأقل.</p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {contractors.map((c, ci) => {
              const total = contractorTotal(c);
              const coverageCount = c.items.filter((it) => it.isOffered && (parseFloat(it.bidAmount || "0") > 0)).length;

              return (
                <Card key={c.uid} className="border-2 border-slate-200">
                  <CardHeader className="border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-charity-primary text-white text-sm flex items-center justify-center font-bold shrink-0">
                          {ci + 1}
                        </span>
                        {c.name || `مقاول ${ci + 1}`}
                      </CardTitle>
                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <p className="text-xs text-slate-500">تغطية البنود</p>
                          <p className="font-bold text-sm text-slate-700">{coverageCount}/{pricingItems.length}</p>
                        </div>
                        {total > 0 && (
                          <div className="text-left">
                            <p className="text-xs text-slate-500">إجمالي العرض</p>
                            <p className="font-bold text-sm text-charity-primary">{total.toLocaleString("ar-SA")} ر.س</p>
                          </div>
                        )}
                        {contractors.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeContractor(c.uid)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-5">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <User className="w-4 h-4 text-charity-primary" /> بيانات المقاول
                      </p>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                          <Label>اسم المقاول / الشركة *</Label>
                          <Input
                            value={c.name}
                            onChange={(e) => updateContractor(c.uid, "name", e.target.value)}
                            placeholder="مثال: شركة المقاول للإنشاءات"
                            disabled={success}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> رقم الجوال *
                          </Label>
                          <Input
                            value={c.phone}
                            onChange={(e) => updateContractor(c.uid, "phone", e.target.value)}
                            placeholder="05xxxxxxxx"
                            dir="ltr"
                            disabled={success}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> البريد الإلكتروني
                          </Label>
                          <Input
                            value={c.email}
                            onChange={(e) => updateContractor(c.uid, "email", e.target.value)}
                            placeholder="contractor@example.com"
                            dir="ltr"
                            disabled={success}
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <Upload className="w-4 h-4 text-charity-primary" /> ملف عرض السعر *
                      </p>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          className="flex-1"
                          onChange={(e) => updateContractor(c.uid, "bidFile", e.target.files?.[0] || null)}
                          disabled={success}
                        />
                        {c.bidFileUrl && (
                          <a href={c.bidFileUrl} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm">
                              <FileText className="w-4 h-4 ml-1" /> الملف الحالي
                            </Button>
                          </a>
                        )}
                      </div>
                      {c.bidFile && <p className="text-xs text-slate-500 mt-1.5">الملف: {c.bidFile.name}</p>}
                    </div>

                    <Separator />

                    <div>
                      <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-charity-primary" /> البنود المشمولة
                      </p>
                      <div className="space-y-3">
                        {pricingItems.map((p, pi) => {
                          const itBid = c.items.find((x) => x.itemId === p.itemId);
                          const isOffered = Boolean(itBid?.isOffered);

                          return (
                            <div key={p.itemId} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-slate-900 text-sm">
                                    {pi + 1}. {p.mainItem}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {p.subItem} · الكمية: {p.quantity} {p.unit}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={isOffered}
                                    onCheckedChange={(checked) =>
                                      toggleContractorItemOffered(c.uid, p.itemId, Boolean(checked))
                                    }
                                    disabled={success}
                                  />
                                  <Label className="text-xs">يشمل هذا البند</Label>
                                </div>
                              </div>

                              {isOffered ? (
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">مبلغ العرض (ريال) *</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={itBid?.bidAmount || ""}
                                      onChange={(e) => updateContractorItem(c.uid, p.itemId, "bidAmount", e.target.value)}
                                      placeholder="0.00"
                                      disabled={success}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">ما يشمله العرض / ملاحظات</Label>
                                    <Input
                                      value={itBid?.details || ""}
                                      onChange={(e) => updateContractorItem(c.uid, p.itemId, "details", e.target.value)}
                                      placeholder="مثال: يشمل التوريد والتركيب والضمان"
                                      disabled={success}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500">تم تحديد هذا البند كـ "غير مقدم" لهذا المقاول.</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="w-full border-dashed border-2 border-charity-primary text-charity-primary hover:bg-charity-bg-calm"
            onClick={addContractor}
            disabled={success || saving || savingDraft}
          >
            <Plus className="w-4 h-4 ml-2" /> إضافة مقاول آخر
          </Button>

          <div className="flex flex-wrap justify-end gap-3 pb-8">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={savingDraft || saving || success || request?.current_status !== "pending_contractor_bids"}
            >
              {savingDraft ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-700 ml-2" /> جاري حفظ المسودة...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ml-2" /> حفظ كمسودة
                </>
              )}
            </Button>

            <Button onClick={handleSubmit} disabled={!canSubmit} className="bg-charity-primary hover:bg-charity-dark px-8" size="lg">
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" /> جاري الإرسال...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 ml-2" /> إرسال العروض لمهندس المشروع
                </>
              )}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
