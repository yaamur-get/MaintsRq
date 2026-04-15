import { useState, useEffect } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { commonDataService } from "@/services/commonDataService";

interface TimelineEvent {
  id: string;
  old_status: string;
  new_status: string;
  notes: string | null;
  created_at: string;
  changed_by_user: {
    full_name: string | null;
  } | null;
}

interface TimelineProps {
  events: TimelineEvent[];
}

const getTimelineActorLabel = (event: TimelineEvent) => {
  const fullName = event.changed_by_user?.full_name?.trim();
  if (fullName) return fullName;
  if (event.new_status === "pending_review" || event.new_status === "pending_rejection_approval") return "خدمة العملاء";
  return "النظام";
};

export function Timeline({ events }: TimelineProps) {
  const [statusTranslations, setStatusTranslations] = useState<Record<string, { label: string; color: string }>>({});

  useEffect(() => {
    loadStatusTranslations();
  }, []);

  const loadStatusTranslations = async () => {
    try {
      const translations = await commonDataService.getStatusTranslations();
      const translationsMap: Record<string, { label: string; color: string }> = {};
      translations.forEach(t => {
        translationsMap[t.status_key] = {
          label: t.arabic_label,
          color: t.color_class
        };
      });
      setStatusTranslations(translationsMap);
    } catch (error) {
      console.error("Error loading status translations:", error);
    }
  };

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        لا توجد سجلات زمنية بعد
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const statusInfo = statusTranslations[event.new_status] || { label: event.new_status, color: "bg-slate-100 text-slate-800" };
        
        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full ${statusInfo.color} flex items-center justify-center`}>
                {isLast ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </div>
              {!isLast && <div className="w-0.5 h-full bg-slate-200 my-2" />}
            </div>
            <div className="flex-1 pb-8">
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-slate-900">
                  {statusInfo.label}
                </p>
                <p className="text-sm text-slate-500">
                  {new Date(event.created_at).toLocaleDateString("ar-SA")}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                بواسطة: {getTimelineActorLabel(event)}
              </p>
              {event.notes && (
                <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-2 rounded">
                  {event.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}