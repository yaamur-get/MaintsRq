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
import { Plus, Trash2, Upload, Save, ArrowLeft, CheckCircle2, FileText, Building2, MapPin, Calendar, AlertCircle, Loader2, XCircle, Send } from "lucide-react";
import { inspectionService } from "@/services/inspectionService";
import { requestService } from "@/services/requestService";
import { authService } from "@/services/authService";
import Link from "next/link";

type InspectionItem = {
  id?: string;
  item_number: number;
  main_item: string;
  sub_item: string;
  specifications: string;
  photos: File[];
  photoPreviews: string[];
};

export default function InspectionPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [request, setRequest] = useState<any>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [newItem, setNewItem] = useState({
    item_number: 1,
    main_item: "",
    sub_item: "",
    specifications: "",
    photos: [],
    photoPreviews: []
  });

  useEffect(() => {
    if (id) {
      loadRequestData();
    }
  }, [id]);

  const loadRequestData = async () => {
    try {
      setLoading(true);
      const requestData = await requestService.getRequestById(id as string);
      setRequest(requestData);

      // جلب البنود الموجودة إذا كانت المعاينة قد بدأت
      const existingItems = await inspectionService.getInspectionItems(id as string);
      if (existingItems.length > 0) {
        setItems(existingItems.map((item, index) => ({
          id: item.id,
          item_number: index + 1,  // استخدام الفهرس بدلاً من قراءة الخاصية من قاعدة البيانات
          main_item: item.main_item || "",
          sub_item: item.sub_item || "",
          specifications: item.specifications || "",
          photos: [],
          photoPreviews: Array.isArray(item.images) ? item.images.map((img: any) => img.image_url) : []
        })));
      }
    } catch (error) {
      console.error("Error loading request:", error);
      setError("فشل تحميل بيانات الطلب");
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, {
      item_number: items.length + 1,
      main_item: "",
      sub_item: "",
      specifications: "",
      photos: [],
      photoPreviews: []
    }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InspectionItem, value: any) => {
    const newItems = [...items];
    if (!newItems[index]) {
      console.warn(`⚠️ Trying to update non-existent item at index ${index}`);
      return;
    }
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handlePhotoChange = (index: number, files: FileList | null) => {
    if (!files) return;
    if (!items[index]) {
      console.warn(`⚠️ Trying to add photos to non-existent item at index ${index}`);
      return;
    }
    
    const newPhotos = Array.from(files).slice(0, 3);
    const previews = newPhotos.map(file => URL.createObjectURL(file));
    
    updateItem(index, "photos", newPhotos);
    updateItem(index, "photoPreviews", previews);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError("");

      // التحقق من صحة البيانات
      if (items.some(item => !item.main_item || !item.sub_item)) {
        setError("يرجى تعبئة جميع البنود الأساسية");
        return;
      }

      // حفظ كل بند
      for (const item of items) {
        let savedItem;
        
        if (item.id) {
          // تحديث بند موجود
          savedItem = await inspectionService.updateInspectionItem(item.id, {
            main_item: item.main_item,
            sub_item: item.sub_item,
            specifications: item.specifications
          });
        } else {
          // إضافة بند جديد
          savedItem = await inspectionService.addInspectionItem({
            request_id: id as string,
            main_item: item.main_item,
            sub_item: item.sub_item,
            specifications: item.specifications
          });
        }

        // رفع الصور الجديدة
        if (item.photos && item.photos.length > 0) {
          for (const photo of item.photos) {
            await inspectionService.uploadItemPhoto(photo, savedItem.id, id as string);
          }
        }
      }

      // تحديث حالة الطلب
      await requestService.updateRequestStatus(
        id as string,
        "pending_inspection_approval",
        "تم رفع تقرير المعاينة"
      );

      setSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard/requests/${id}`);
      }, 2000);

    } catch (error) {
      console.error("Error saving inspection:", error);
      setError("فشل حفظ المعاينة. يرجى المحاولة مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNewItem({
      main_item: "",
      sub_item: "",
      item_number: items.length + 1,
      specifications: "",
      photos: [],
      photoPreviews: []
    });
    setError("");
    setSuccess(false);
  };

  const handleSubmitReport = async () => {
    try {
      setSubmitting(true);
      setError("");

      if (items.length === 0) {
        setError("يجب إضافة بند واحد على الأقل قبل إرسال التقرير");
        return;
      }

      await requestService.updateRequestStatus(
        id as string,
        "pending_inspection_approval",
        `تم الانتهاء من المعاينة وإضافة ${items.length} بند`
      );

      // Redirect back to request details
      router.push(`/dashboard/requests/${id}`);
    } catch (error) {
      console.error("Error submitting report:", error);
      setError("حدث خطأ أثناء إرسال التقرير");
    } finally {
      setSubmitting(false);
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
        title={`معاينة طلب ${request.rq_number} - نظام إدارة صيانة المساجد`}
        description="إضافة بنود المعاينة"
      />
      
      <DashboardLayout userRole="technician">
        <div className="space-y-6" dir="rtl">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-3 bg-charity-bg-calm rounded-lg">
              <FileText className="w-8 h-8 text-charity-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">معاينة الطلب</h1>
              <p className="text-gray-600">طلب رقم: {request.rq_number}</p>
            </div>
          </div>

          {/* Request Info Card */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-l from-charity-primary to-charity-dark text-white">
              <CardTitle className="text-xl">معلومات الطلب</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-charity-primary" />
                  <div>
                    <p className="text-sm text-gray-600">المسجد</p>
                    <p className="font-semibold text-gray-900">{request.mosque?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <MapPin className="w-5 h-5 text-charity-primary" />
                  <div>
                    <p className="text-sm text-gray-600">الموقع</p>
                    <p className="font-semibold text-gray-900">
                      {request.mosque?.city?.name} - {request.mosque?.district?.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <FileText className="w-5 h-5 text-charity-primary" />
                  <div>
                    <p className="text-sm text-gray-600">نوع الاحتياج</p>
                    <p className="font-semibold text-gray-900">{request.request_type?.name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-charity-primary" />
                  <div>
                    <p className="text-sm text-gray-600">تاريخ الطلب</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(request.created_at).toLocaleDateString("ar-SA-u-ca-gregory")}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-charity-bg-calm rounded-lg border-r-4 border-r-charity-primary">
                <p className="text-sm text-gray-600 mb-1">التفاصيل</p>
                <p className="text-gray-900 leading-relaxed">{request.description}</p>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Alert className="bg-charity-bg-calm border-charity-dark">
              <AlertCircle className="h-5 w-5 text-charity-dark" />
              <AlertDescription className="text-charity-dark">{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-charity-bg-calm border-charity-light">
              <CheckCircle2 className="h-5 w-5 text-charity-light" />
              <AlertDescription className="text-charity-dark">
                تم حفظ البند بنجاح! يمكنك إضافة بند جديد أو إرسال التقرير.
              </AlertDescription>
            </Alert>
          )}

          {/* Items */}
          <div className="space-y-4">
            {items.map((item, index) => {
              // Safety check: ensure item and photoPreviews exist
              if (!item) return null;
              const previews = Array.isArray(item.photoPreviews) ? item.photoPreviews : [];
              
              return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">بند رقم {item.item_number}</CardTitle>
                  {items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`main-item-${index}`}>البند الرئيسي *</Label>
                      <Input
                        id={`main-item-${index}`}
                        value={item.main_item}
                        onChange={(e) => updateItem(index, "main_item", e.target.value)}
                        placeholder="مثال: أعمال كهربائية"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`sub-item-${index}`}>البند الفرعي *</Label>
                      <Input
                        id={`sub-item-${index}`}
                        value={item.sub_item}
                        onChange={(e) => updateItem(index, "sub_item", e.target.value)}
                        placeholder="مثال: استبدال لوحة كهربائية"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`specifications-${index}`}>المواصفات والملاحظات</Label>
                    <Textarea
                      id={`specifications-${index}`}
                      value={item.specifications}
                      onChange={(e) => updateItem(index, "specifications", e.target.value)}
                      placeholder="تفاصيل العمل المطلوب..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>الصور (حد أقصى 3 صور)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handlePhotoChange(index, e.target.files)}
                        className="flex-1"
                      />
                      <Upload className="w-5 h-5 text-slate-400" />
                    </div>
                    
                    {previews.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {previews.map((preview, photoIndex) => (
                          <div key={photoIndex} className="aspect-square rounded-lg overflow-hidden border">
                            <img 
                              src={preview} 
                              alt={`صورة ${photoIndex + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>

          {/* Add Item Form */}
          <Card className="border-charity-medium bg-white shadow-lg">
            <CardHeader className="bg-charity-bg-calm border-b border-charity-medium">
              <CardTitle className="text-xl text-charity-dark flex items-center gap-2">
                <Plus className="w-6 h-6" />
                إضافة بند معاينة جديد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`main-item-new`}>البند الرئيسي *</Label>
                  <Input
                    id={`main-item-new`}
                    value=""
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[items.length - 1] = { ...newItems[items.length - 1], main_item: e.target.value };
                      setItems(newItems);
                    }}
                    placeholder="مثال: أعمال كهربائية"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`sub-item-new`}>البند الفرعي *</Label>
                  <Input
                    id={`sub-item-new`}
                    value=""
                    onChange={(e) => {
                      const newItems = [...items];
                      newItems[items.length - 1] = { ...newItems[items.length - 1], sub_item: e.target.value };
                      setItems(newItems);
                    }}
                    placeholder="مثال: استبدال لوحة كهربائية"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`specifications-new`}>المواصفات والملاحظات</Label>
                <Textarea
                  id={`specifications-new`}
                  value=""
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[items.length - 1] = { ...newItems[items.length - 1], specifications: e.target.value };
                    setItems(newItems);
                  }}
                  placeholder="تفاصيل العمل المطلوب..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>الصور (حد أقصى 3 صور)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const newItems = [...items];
                      const files = e.target.files;
                      if (!files) return;
                      
                      const newPhotos = Array.from(files).slice(0, 3); // حد أقصى 3 صور لكل بند
                      const previews = newPhotos.map(file => URL.createObjectURL(file));
                      
                      newItems[items.length - 1] = { ...newItems[items.length - 1], photos: newPhotos, photoPreviews: previews };
                      setItems(newItems);
                    }}
                    className="flex-1"
                  />
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
                
                {items[items.length - 1].photoPreviews && items[items.length - 1].photoPreviews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {items[items.length - 1].photoPreviews.map((preview, photoIndex) => (
                      <div key={photoIndex} className="aspect-square rounded-lg overflow-hidden border">
                        <img 
                          src={preview} 
                          alt={`صورة ${photoIndex + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              onClick={addItem}
              variant="outline"
              className="flex-1"
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة بند جديد
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-charity-primary hover:bg-charity-dark text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ المعاينة
                </>
              )}
            </Button>
          </div>

          {/* Submit Report */}
          {items.length > 0 && (
            <Card className="border-charity-primary bg-charity-bg-calm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-charity-dark mb-1">
                      هل أنت جاهز لإرسال التقرير؟
                    </h3>
                    <p className="text-sm text-gray-600">
                      تم إضافة {items.length} بند. عند الإرسال سيتم تحويل التقرير لمدير المشاريع.
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitReport}
                    disabled={submitting}
                    className="bg-charity-primary hover:bg-charity-dark text-white"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 ml-2" />
                        إرسال التقرير
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  );
}