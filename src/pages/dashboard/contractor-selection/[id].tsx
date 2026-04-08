import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, CheckCircle2, FileText, Award, AlertCircle } from "lucide-react";
import { requestService } from "@/services/requestService";
import { pricingService } from "@/services/pricingService";
import { supabase } from "@/integrations/supabase/client";
import Link from "next/link";

type PricingItem = {
  itemId: string;
  externalReportItemId?: string;
  inspectionItemId?: string;
  mainItem: string;
  subItem: string;
  quantity: number;
  unit: string;
  specifications: string;
  expertUnitPrice: number | null;
  expertTotal: number;
  expertNotes: string;
};

type ContractorBidItem = {
  itemId: string;
  mainItem: string;
  subItem: string;
  bidAmount: number | null;
  unitPrice: number | null;
  details: string;
  bidStatus: "offered" | "not_offered";
  differenceFromExpert: number | null;
  differencePercent: number | null;
};

type ContractorBidGroup = {
  contractorId: string;
  contractorName: string;
  contractorPhone: string;
  contractorEmail: string;
  contractorSpecialization: string;
  contractorRating: number | null;
  contractorLicenseNumber: string;
  bidFileUrl: string;
  items: ContractorBidItem[];
  total: number;
  coverageCount: number;
  comparableExpertTotal: number;
  totalDifferenceFromExpert: number;
  totalDifferencePercent: number | null;
};

const formatCurrency = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("ar-SA")} ر.س`;
};

const getVarianceLabel = (differencePercent: number | null) => {
  if (differencePercent === null || Number.isNaN(differencePercent)) {
    return { label: "لا توجد مقارنة", className: "bg-slate-100 text-slate-700 border-slate-200" };
  }

  const absPercent = Math.abs(differencePercent);
  if (absPercent <= 5) {
    return { label: "قريب من تسعير الخبير", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
  }

  if (differencePercent < 0) {
    return { label: "أقل من تسعير الخبير", className: "bg-amber-100 text-amber-800 border-amber-200" };
  }

  return { label: "أعلى من تسعير الخبير", className: "bg-rose-100 text-rose-800 border-rose-200" };
};

export default function ContractorSelectionPage() {
  const router = useRouter();
  const { id } = router.query;

  const [request, setRequest] = useState<any>(null);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [bidGroups, setBidGroups] = useState<ContractorBidGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);

  useEffect(() => {
    if (id) void loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const requestData = await requestService.getRequestById(id as string);
      setRequest(requestData);

      const pricing = await pricingService.getExpertPricing(id as string);
      const items: PricingItem[] = pricing.map((pricingRow: any) => ({
        itemId: pricingRow.external_report_item_id || pricingRow.inspection_item_id || pricingRow.id,
        externalReportItemId: pricingRow.external_report_item_id,
        inspectionItemId: pricingRow.inspection_item_id,
        mainItem: pricingRow.item_main_name || "بند",
        subItem: pricingRow.item_sub_name || "-",
        quantity: Number(pricingRow.quantity || 1),
        unit: pricingRow.item_unit || "",
        specifications: pricingRow.item_specifications || "",
        expertUnitPrice: typeof pricingRow.unit_price === "number" ? pricingRow.unit_price : Number(pricingRow.unit_price || 0) || null,
        expertTotal: Number(pricingRow.estimated_price || 0),
        expertNotes: pricingRow.pricing_notes || "",
      }));
      setPricingItems(items);

      const bids = await pricingService.getContractorBids(id as string);
      const byContractor = new Map<string, any[]>();

      for (const bid of bids) {
        const contractorId = bid.contractor_id;
        if (!byContractor.has(contractorId)) byContractor.set(contractorId, []);
        byContractor.get(contractorId)!.push(bid);
      }

      const groups: ContractorBidGroup[] = [];

      for (const [contractorId, contractorBids] of byContractor.entries()) {
        const contractor = contractorBids[0].contractor;

        const groupItems: ContractorBidItem[] = items.map((pricingItem) => {
          const match = contractorBids.find(
            (bid: any) =>
              (pricingItem.externalReportItemId && bid.external_report_item_id === pricingItem.externalReportItemId) ||
              (pricingItem.inspectionItemId && bid.inspection_item_id === pricingItem.inspectionItemId) ||
              (bid.item_main_name === pricingItem.mainItem && bid.item_sub_name === pricingItem.subItem)
          );

          const bidStatus = match?.bid_status === "not_offered" ? "not_offered" : "offered";
          const rawBidAmount = bidStatus === "offered" ? Number(match?.bid_amount || 0) : null;
          const bidAmount = rawBidAmount && rawBidAmount > 0 ? rawBidAmount : null;
          const differenceFromExpert = bidAmount !== null ? bidAmount - pricingItem.expertTotal : null;
          const differencePercent = bidAmount !== null && pricingItem.expertTotal > 0
            ? (differenceFromExpert! / pricingItem.expertTotal) * 100
            : null;

          return {
            itemId: pricingItem.itemId,
            mainItem: pricingItem.mainItem,
            subItem: pricingItem.subItem,
            bidAmount,
            unitPrice: bidAmount !== null && pricingItem.quantity > 0 ? bidAmount / pricingItem.quantity : null,
            details: match?.notes || "",
            bidStatus,
            differenceFromExpert,
            differencePercent,
          };
        });

        const coverageCount = groupItems.filter((item) => item.bidAmount !== null).length;
        const total = groupItems.reduce((sum, item) => sum + (item.bidAmount || 0), 0);
        const comparableExpertTotal = items.reduce((sum, pricingItem) => {
          const itemBid = groupItems.find((groupItem) => groupItem.itemId === pricingItem.itemId);
          return itemBid?.bidAmount !== null ? sum + pricingItem.expertTotal : sum;
        }, 0);
        const totalDifferenceFromExpert = total - comparableExpertTotal;
        const totalDifferencePercent = comparableExpertTotal > 0
          ? (totalDifferenceFromExpert / comparableExpertTotal) * 100
          : null;

        const hasSelected = contractorBids.some((bid: any) => bid.is_selected);
        if (hasSelected) setSelectedContractorId(contractorId);

        groups.push({
          contractorId,
          contractorName: contractor?.name || "مقاول",
          contractorPhone: contractor?.phone || "",
          contractorEmail: contractor?.email || "",
          contractorSpecialization: contractor?.specialization || "غير محدد",
          contractorRating: contractor?.rating ?? null,
          contractorLicenseNumber: contractor?.license_number || "",
          bidFileUrl: contractorBids[0]?.bid_document_url || "",
          items: groupItems,
          total,
          coverageCount,
          comparableExpertTotal,
          totalDifferenceFromExpert,
          totalDifferencePercent,
        });
      }

      groups.sort((left, right) => {
        if (right.coverageCount !== left.coverageCount) return right.coverageCount - left.coverageCount;

        const leftDiff = left.totalDifferencePercent === null ? Number.POSITIVE_INFINITY : Math.abs(left.totalDifferencePercent);
        const rightDiff = right.totalDifferencePercent === null ? Number.POSITIVE_INFINITY : Math.abs(right.totalDifferencePercent);
        if (leftDiff !== rightDiff) return leftDiff - rightDiff;

        return left.total - right.total;
      });

      setBidGroups(groups);
    } catch (err) {
      console.error("Error loading:", err);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const expertTotal = useMemo(
    () => pricingItems.reduce((sum, item) => sum + item.expertTotal, 0),
    [pricingItems]
  );

  const lowestPerItem = useMemo(() => {
    const map = new Map<string, number | null>();

    for (const item of pricingItems) {
      const offered = bidGroups
        .map((group) => group.items.find((it) => it.itemId === item.itemId)?.bidAmount)
        .filter((amount): amount is number => typeof amount === "number" && amount > 0);

      map.set(item.itemId, offered.length ? Math.min(...offered) : null);
    }

    return map;
  }, [pricingItems, bidGroups]);

  const closestToExpertPerItem = useMemo(() => {
    const map = new Map<string, number | null>();

    for (const item of pricingItems) {
      const differences = bidGroups
        .map((group) => group.items.find((it) => it.itemId === item.itemId)?.differenceFromExpert)
        .filter((difference): difference is number => typeof difference === "number");

      map.set(item.itemId, differences.length ? Math.min(...differences.map((difference) => Math.abs(difference))) : null);
    }

    return map;
  }, [pricingItems, bidGroups]);

  const fullyCoveredContractors = useMemo(
    () => bidGroups.filter((group) => group.coverageCount === pricingItems.length).length,
    [bidGroups, pricingItems.length]
  );

  const handleSelectContractor = async (contractorId: string) => {
    try {
      setSelecting(contractorId);
      setError("");

      await (supabase as any)
        .from("contractor_bids")
        .update({ is_selected: false })
        .eq("request_id", id as string);

      await (supabase as any)
        .from("contractor_bids")
        .update({ is_selected: true })
        .eq("request_id", id as string)
        .eq("contractor_id", contractorId)
        .eq("bid_status", "offered");

      await requestService.updateRequestStatus(
        id as string,
        "in_progress" as any,
        `تم اختيار المقاول واعتماد العرض - ${bidGroups.find((group) => group.contractorId === contractorId)?.contractorName}`
      );

      setSelectedContractorId(contractorId);
      setSuccess(true);
      setTimeout(() => router.push(`/dashboard/requests/${id}`), 1500);
    } catch (err: any) {
      console.error("Error selecting contractor:", err);
      setError("فشل اختيار المقاول: " + (err?.message || "حاول مرة أخرى"));
    } finally {
      setSelecting(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-charity-primary mx-auto mb-4" />
            <p className="text-slate-600">جاري تحميل عروض المقاولين...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO title="اختيار المقاول - نظام إدارة صيانة المساجد" description="مقارنة عروض المقاولين والاختيار" />
      <DashboardLayout userRole="project_manager">
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/requests/${id}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">اختيار المقاول</h2>
              <p className="text-slate-500 text-sm">
                {request?.rq_number || id} · {request?.mosque?.name} · {bidGroups.length} عرض · مرجع الخبير {formatCurrency(expertTotal)}
              </p>
            </div>
          </div>

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <AlertDescription className="text-green-800">
                تم اختيار المقاول بنجاح! يتم الانتقال إلى مرحلة التنفيذ...
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {bidGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
                  <div>
                    <p className="text-slate-600 font-medium">لا توجد عروض مقاولين بعد لهذا الطلب</p>
                    <p className="text-slate-400 text-sm mt-2">
                      {request?.current_status === "pending_contractor_bids"
                        ? "قيد انتظار رفع عروض المقاولين من قبل الفني المسؤول"
                        : "يقوم الفني برفع العروض في مرحلة بانتظار عروض المقاولين"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-500">إجمالي تسعير الخبير</p>
                    <p className="mt-2 text-2xl font-bold text-charity-primary">{formatCurrency(expertTotal)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-500">عدد البنود المرجعية</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{pricingItems.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-500">العروض كاملة التغطية</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{fullyCoveredContractors}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-slate-500">أقل إجمالي معروض</p>
                    <p className="mt-2 text-2xl font-bold text-emerald-700">
                      {bidGroups.length ? formatCurrency(Math.min(...bidGroups.map((group) => group.total))) : "—"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-charity-primary" />
                    ملخص المقاولين والمقارنة المرجعية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-right py-3 pr-4 font-semibold text-slate-700">المقاول</th>
                          <th className="text-right py-3 font-semibold text-slate-700">بيانات إضافية</th>
                          <th className="text-center py-3 font-semibold text-slate-700">نسبة التغطية</th>
                          <th className="text-left py-3 font-semibold text-slate-700 whitespace-nowrap">إجمالي البنود المقدمة</th>
                          <th className="text-center py-3 font-semibold text-slate-700 whitespace-nowrap">الفرق عن تسعير الخبير</th>
                          <th className="text-center py-3 font-semibold text-slate-700">الملف</th>
                          <th className="text-center py-3 pl-4 font-semibold text-slate-700">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bidGroups.map((group) => {
                          const isSelected = selectedContractorId === group.contractorId;
                          const variance = getVarianceLabel(group.totalDifferencePercent);

                          return (
                            <tr key={group.contractorId} className={`border-b last:border-0 ${isSelected ? "bg-green-50" : ""}`}>
                              <td className="py-3 pr-4 align-top">
                                <div>
                                  <p className="font-semibold text-slate-900">{group.contractorName}</p>
                                  <p className="text-xs text-slate-500" dir="ltr">
                                    {group.contractorPhone || ""} {group.contractorEmail ? `· ${group.contractorEmail}` : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 align-top">
                                <div className="space-y-1 text-xs text-slate-600">
                                  <p>التخصص: <span className="font-semibold text-slate-800">{group.contractorSpecialization}</span></p>
                                  <p>التقييم: <span className="font-semibold text-slate-800">{group.contractorRating ?? "غير متوفر"}</span></p>
                                  <p>الرخصة: <span className="font-semibold text-slate-800">{group.contractorLicenseNumber || "غير متوفرة"}</span></p>
                                </div>
                              </td>
                              <td className="py-3 text-center align-top">
                                <Badge variant="outline" className="font-semibold">
                                  {group.coverageCount}/{pricingItems.length}
                                </Badge>
                              </td>
                              <td className="py-3 align-top">
                                <p className="font-bold text-base text-charity-primary whitespace-nowrap">{formatCurrency(group.total)}</p>
                                <p className="text-xs text-slate-500 mt-1 whitespace-nowrap">
                                  مقابل بنود خبير بقيمة {formatCurrency(group.comparableExpertTotal)}
                                </p>
                              </td>
                              <td className="py-3 text-center align-top">
                                <div className="space-y-2">
                                  <Badge className={`${variance.className} border`}>{variance.label}</Badge>
                                  <p className={`text-xs font-semibold ${group.totalDifferenceFromExpert <= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                    {group.totalDifferencePercent === null
                                      ? "—"
                                      : `${group.totalDifferenceFromExpert >= 0 ? "+" : ""}${group.totalDifferenceFromExpert.toLocaleString("ar-SA")} ر.س (${group.totalDifferencePercent.toFixed(1)}%)`}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 text-center align-top">
                                {group.bidFileUrl ? (
                                  <a href={group.bidFileUrl} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm">
                                      <FileText className="w-3.5 h-3.5 ml-1" /> عرض
                                    </Button>
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 pl-4 text-center align-top">
                                {isSelected ? (
                                  <Badge className="bg-green-600 text-white">تم الاختيار</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-charity-primary hover:bg-charity-dark"
                                    disabled={!!selecting || success}
                                    onClick={() => handleSelectContractor(group.contractorId)}
                                  >
                                    {selecting === group.contractorId ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white ml-1" /> جاري...
                                      </>
                                    ) : (
                                      <>اختيار هذا المقاول</>
                                    )}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-slate-700">Matrix مقارنة البنود والتفاصيل</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-right py-2 pr-3 font-medium text-slate-600 min-w-[240px]">البند</th>
                          <th className="text-center py-2 font-medium text-slate-700 min-w-[180px]">مرجع الخبير</th>
                          {bidGroups.map((group) => (
                            <th key={group.contractorId} className="text-center py-2 font-medium text-slate-700 min-w-[220px]">
                              {group.contractorName}
                            </th>
                          ))}
                          <th className="text-center py-2 font-medium text-green-700 min-w-[120px]">أقل سعر للبند</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingItems.map((item) => {
                          const minBid = lowestPerItem.get(item.itemId);

                          return (
                            <tr key={item.itemId} className="border-b last:border-0 align-top hover:bg-slate-50">
                              <td className="py-3 pr-3">
                                <p className="font-medium text-slate-900">{item.mainItem}</p>
                                <p className="text-xs text-slate-500">{item.subItem} · الكمية: {item.quantity} {item.unit}</p>
                                {item.specifications && <p className="text-xs text-slate-500 mt-1">{item.specifications}</p>}
                              </td>

                              <td className="py-3 text-center bg-slate-50/60">
                                <p className="font-bold text-slate-900 whitespace-nowrap">{formatCurrency(item.expertTotal)}</p>
                                <p className="text-xs text-slate-500 whitespace-nowrap">الوحدة: {formatCurrency(item.expertUnitPrice)}</p>
                                {item.expertNotes && <p className="text-[11px] text-slate-500 mt-1 px-2 leading-5">{item.expertNotes}</p>}
                              </td>

                              {bidGroups.map((group) => {
                                const bid = group.items.find((contractorItem) => contractorItem.itemId === item.itemId);
                                const isBest = typeof bid?.bidAmount === "number" && bid.bidAmount > 0 && bid.bidAmount === minBid;
                                const closestDifference = closestToExpertPerItem.get(item.itemId);
                                const isClosestToExpert =
                                  typeof bid?.differenceFromExpert === "number" &&
                                  typeof closestDifference === "number" &&
                                  Math.abs(bid.differenceFromExpert) === closestDifference;
                                const variance = getVarianceLabel(bid?.differencePercent ?? null);

                                return (
                                  <td
                                    key={group.contractorId}
                                    className={`py-3 text-center ${isBest ? "bg-green-50" : "text-slate-700"}`}
                                  >
                                    {typeof bid?.bidAmount === "number" && bid.bidAmount > 0 ? (
                                      <div className="space-y-1 px-2">
                                        <p className={`font-bold whitespace-nowrap ${isBest ? "text-green-700" : "text-slate-900"}`}>{formatCurrency(bid.bidAmount)}</p>
                                        <p className="text-[11px] text-slate-500 whitespace-nowrap">الوحدة: {formatCurrency(bid.unitPrice)}</p>
                                        <Badge className={`${variance.className} border text-[10px]`}>{variance.label}</Badge>
                                        {isClosestToExpert && <p className="text-[11px] font-semibold text-blue-700">الأقرب لتقدير الخبير</p>}
                                        {typeof bid.differenceFromExpert === "number" && (
                                          <p className={`text-[11px] font-semibold ${bid.differenceFromExpert <= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                                            {bid.differenceFromExpert >= 0 ? "+" : ""}{bid.differenceFromExpert.toLocaleString("ar-SA")} ر.س
                                          </p>
                                        )}
                                        <p className="text-[11px] text-slate-500 leading-5 whitespace-normal">{bid.details || "لم تُذكر تفاصيل ما يشمله العرض"}</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1 px-2">
                                        <p className="text-slate-400">غير مقدم</p>
                                        <p className="text-[11px] text-slate-400 leading-5 whitespace-normal">هذا البند غير مشمول في عرض المقاول</p>
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              <td className="py-3 text-center font-semibold text-green-700 whitespace-nowrap">
                                {typeof minBid === "number" ? formatCurrency(minBid) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-slate-50">
                          <td className="py-3 pr-3 font-bold text-slate-800">الإجمالي</td>
                          <td className="py-3 text-center font-bold text-slate-900 whitespace-nowrap">{formatCurrency(expertTotal)}</td>
                          {bidGroups.map((group) => (
                            <td key={group.contractorId} className="py-3 text-center font-bold text-charity-primary whitespace-nowrap">
                              {formatCurrency(group.total)}
                            </td>
                          ))}
                          <td className="py-3 text-center text-slate-400">—</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-3 pr-3 font-bold text-slate-800">نسبة التغطية</td>
                          <td className="py-3 text-center font-bold text-slate-700 whitespace-nowrap">مرجع كامل</td>
                          {bidGroups.map((group) => (
                            <td key={group.contractorId} className="py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                              {group.coverageCount}/{pricingItems.length}
                            </td>
                          ))}
                          <td className="py-3 text-center text-slate-400">—</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}
