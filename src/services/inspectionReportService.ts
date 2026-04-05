export interface InspectionMosque {
  id: string;
  name: string;
  city: string;
  district: string;
  latitude?: number;
  longitude?: number;
  location_link?: string;
  main_photo_url?: string;
  supervisor_name?: string;
  supervisor_phone?: string;
}

export interface InspectionIssueItem {
  id: string;
  quantity: number;
  unit_price: number;
  sub_items?: { name_ar: string; unit_ar: string; unit_price: number };
  causes?: { name_ar: string };
  specs?: { name: string };
  sub_item?: { name_ar: string; unit_ar: string; unit_price: number };
  cause?: { name_ar: string };
  spec?: { name: string };
}

export interface InspectionIssuePhoto {
  id: string;
  photo_url: string;
  photo_order: number;
}

export interface InspectionIssue {
  id: string;
  issue_type: string;
  notes: string;
  main_item: { id: string; name_ar: string };
  items: InspectionIssueItem[];
  photos: InspectionIssuePhoto[];
}

export interface InspectionReport {
  id: string;
  rq_number: string;
  status: string;
  report_date: string;
  created_at: string;
  updated_at: string;
  map_photo_url?: string;
  report_type: string;
  mosques: InspectionMosque;
}

export interface ExternalInspectionResponse {
  report: InspectionReport;
  issues: InspectionIssue[];
}

export interface FlattenedInspectionReportItem {
  externalItemId: string;
  externalIssueId: string;
  mainItemName: string;
  subItemName: string;
  specifications: string;
  quantity: number;
  unit: string;
  causeName: string;
  issueNotes: string;
  photos: InspectionIssuePhoto[];
}

export async function fetchInspectionReport(
  rqNumber: string
): Promise<ExternalInspectionResponse | null> {
  try {
    const requestUrl = `/api/inspection-report/${encodeURIComponent(rqNumber)}?_ts=${Date.now()}`;
    const response = await fetch(
      requestUrl,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error(`Inspection report API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching inspection report:", error);
    return null;
  }
}

export function flattenInspectionReportItems(
  response: ExternalInspectionResponse | null
): FlattenedInspectionReportItem[] {
  if (!response) return [];

  return response.issues.flatMap((issue) =>
    issue.items.map((item) => ({
      externalItemId: item.id,
      externalIssueId: issue.id,
      mainItemName: issue.main_item?.name_ar || "بند معاينة",
      subItemName: item.sub_items?.name_ar ?? item.sub_item?.name_ar ?? "-",
      specifications: item.specs?.name ?? item.spec?.name ?? "",
      quantity: item.quantity ?? 0,
      unit: item.sub_items?.unit_ar ?? item.sub_item?.unit_ar ?? "",
      causeName: item.causes?.name_ar ?? item.cause?.name_ar ?? "",
      issueNotes: issue.notes ?? "",
      photos: issue.photos ?? [],
    }))
  );
}

export function getReportStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "مسودة",
    submitted: "مُرسل",
    approved: "معتمد",
    rejected: "مرفوض",
  };
  return labels[status] ?? status;
}
