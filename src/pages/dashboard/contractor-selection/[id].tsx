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
};

type ContractorBidItem = {
  itemId: string;
  mainItem: string;
  subItem: string;
  bidAmount: number | null;
  details: string;
  bidStatus: "offered" | "not_offered";
};

type ContractorBidGroup = {
  contractorId: string;
  contractorName: string;
  contractorPhone: string;
  contractorEmail: string;
  bidFileUrl: string;
  items: ContractorBidItem[];
  total: number;
  coverageCount: number;
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
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const requestData = await requestService.getRequestById(id as string);
      setRequest(requestData);

      const pricing = await pricingService.getExpertPricing(id as string);
      const items: PricingItem[] = pricing.map((p: any) => ({
        itemId: p.external_report_item_id || p.inspection_item_id || p.id,
        externalReportItemId: p.external_report_item_id,
        inspectionItemId: p.inspection_item_id,
        mainItem: p.item_main_name || "بند",
        subItem: p.item_sub_name || "-",
        quantity: Number(p.quantity || 1),
        unit: p.item_unit || "",
      }));
      setPricingItems(items);

      const bids = await pricingService.getContractorBids(id as string);

      const byContractor = new Map<string, any[]>();
      for (const bid of bids) {
        const cid = bid.contractor_id;
        if (!byContractor.has(cid)) byContractor.set(cid, []);
        byContractor.get(cid)!.push(bid);
      }

      const groups: ContractorBidGroup[] = [];

      for (const [cid, cBids] of byContractor.entries()) {
        const c = cBids[0].contractor;

        const groupItems: ContractorBidItem[] = items.map((p) => {
          const match = cBids.find(
            (b: any) =>
              (p.externalReportItemId && b.external_report_item_id === p.externalReportItemId) ||
              (p.inspectionItemId && b.inspection_item_id === p.inspectionItemId) ||
              (b.item_main_name === p.mainItem && b.item_sub_name === p.subItem)
          );

          const bidStatus = match?.bid_status === "not_offered" ? "not_offered" : "offered";
          const bidAmount = bidStatus === "offered" ? Number(match?.bid_amount || 0) : null;

          return {
            itemId: p.itemId,
            mainItem: p.mainItem,
            subItem: p.subItem,
            bidAmount: bidAmount && bidAmount > 0 ? bidAmount : null,
            details: match?.notes || "",
            bidStatus,
          };
        });

        const coverageCount = groupItems.filter((item) => item.bidStatus === "offered" && (item.bidAmount || 0) > 0).length;
        const total = groupItems.reduce((s, it) => s + (it.bidAmount || 0), 0);

        const hasSelected = cBids.some((b: any) => b.is_selected);
        if (hasSelected) setSelectedContractorId(cid);

        groups.push({
          contractorId: cid,
          contractorName: c?.name || "مقاول",
          contractorPhone: c?.phone || "",
          contractorEmail: c?.email || "",
          bidFileUrl: cBids[0]?.bid_document_url || "",
          items: groupItems,
          total,
          coverageCount,
        });
      }

      groups.sort((a, b) => {
        if (b.coverageCount !== a.coverageCount) return b.coverageCount - a.coverageCount;
        return a.total - b.total;
      });

      setBidGroups(groups);
    } catch (err) {
      console.error("Error loading:", err);
      setError("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

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
        `تم اختيار المقاول واعتماد العرض - ${bidGroups.find((g) => g.contractorId === contractorId)?.contractorName}`
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
                {request?.rq_number || id} · {request?.mosque?.name} · {bidGroups.length} عرض
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-charity-primary" />
                    ملخص المقاولين (إجمالي + تغطية)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-right py-3 pr-4 font-semibold text-slate-700">المقاول</th>
                          <th className="text-center py-3 font-semibold text-slate-700">نسبة التغطية</th>
                          <th className="text-left py-3 font-semibold text-slate-700 whitespace-nowrap">إجمالي البنود المقدمة</th>
                          <th className="text-center py-3 font-semibold text-slate-700">الملف</th>
                          <th className="text-center py-3 pl-4 font-semibold text-slate-700">الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bidGroups.map((g) => {
                          const isSelected = selectedContractorId === g.contractorId;
                          return (
                            <tr key={g.contractorId} className={`border-b last:border-0 ${isSelected ? "bg-green-50" : ""}`}>
                              <td className="py-3 pr-4">
                                <div>
                                  <p className="font-semibold text-slate-900">{g.contractorName}</p>
                                  <p className="text-xs text-slate-500" dir="ltr">
                                    {g.contractorPhone || ""} {g.contractorEmail ? `· ${g.contractorEmail}` : ""}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 text-center">
                                <Badge variant="outline" className="font-semibold">
                                  {g.coverageCount}/{pricingItems.length}
                                </Badge>
                              </td>
                              <td className="py-3">
                                <p className="font-bold text-base text-charity-primary whitespace-nowrap">
                                  {g.total.toLocaleString("ar-SA")} ر.س
                                </p>
                              </td>
                              <td className="py-3 text-center">
                                {g.bidFileUrl ? (
                                  <a href={g.bidFileUrl} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm">
                                      <FileText className="w-3.5 h-3.5 ml-1" /> عرض
                                    </Button>
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </td>
                              <td className="py-3 pl-4 text-center">
                                {isSelected ? (
                                  <Badge className="bg-green-600 text-white">تم الاختيار</Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="bg-charity-primary hover:bg-charity-dark"
                                    disabled={!!selecting || success}
                                    onClick={() => handleSelectContractor(g.contractorId)}
                                  >
                                    {selecting === g.contractorId ? (
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
                  <CardTitle className="text-base text-slate-700">Matrix مقارنة البنود</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="text-right py-2 pr-3 font-medium text-slate-600 min-w-[180px]">البند</th>
                          {bidGroups.map((g) => (
                            <th key={g.contractorId} className="text-center py-2 font-medium text-slate-700 min-w-[130px]">
                              {g.contractorName}
                            </th>
                          ))}
                          <th className="text-center py-2 font-medium text-green-700 min-w-[120px]">أقل سعر للبند</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingItems.map((item) => {
                          const minBid = lowestPerItem.get(item.itemId);

                          return (
                            <tr key={item.itemId} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="py-2.5 pr-3">
                                <p className="font-medium text-slate-900">{item.mainItem}</p>
                                <p className="text-xs text-slate-500">
                                  {item.subItem} · الكمية: {item.quantity} {item.unit}
                                </p>
                              </td>

                              {bidGroups.map((group) => {
                                const bid = group.items.find((it) => it.itemId === item.itemId);
                                const isBest = typeof bid?.bidAmount === "number" && bid.bidAmount > 0 && bid.bidAmount === minBid;

                                return (
                                  <td
                                    key={group.contractorId}
                                    className={`py-2.5 text-center whitespace-nowrap ${isBest ? "bg-green-50 text-green-700 font-bold" : "text-slate-700"}`}
                                  >
                                    {typeof bid?.bidAmount === "number" && bid.bidAmount > 0
                                      ? `${bid.bidAmount.toLocaleString("ar-SA")} ر.س`
                                      : "غير مقدم"}
                                  </td>
                                );
                              })}

                              <td className="py-2.5 text-center font-semibold text-green-700 whitespace-nowrap">
                                {typeof minBid === "number" ? `${minBid.toLocaleString("ar-SA")} ر.س` : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 bg-slate-50">
                          <td className="py-3 pr-3 font-bold text-slate-800">الإجمالي</td>
                          {bidGroups.map((group) => (
                            <td key={group.contractorId} className="py-3 text-center font-bold text-charity-primary whitespace-nowrap">
                              {group.total.toLocaleString("ar-SA")} ر.س
                            </td>
                          ))}
                          <td className="py-3 text-center text-slate-400">—</td>
                        </tr>
                        <tr className="bg-slate-50">
                          <td className="py-3 pr-3 font-bold text-slate-800">نسبة التغطية</td>
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
