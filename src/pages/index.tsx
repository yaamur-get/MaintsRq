import { useState, useEffect } from "react";
import Image from "next/image";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import {
  requestService,
  type CreateRequestData,
  REQUESTER_ROLE_LABELS,
} from "@/services/requestService";
import { mosqueService, type Mosque } from "@/services/mosqueService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mosqueAdditionService } from "@/services/mosqueAdditionService";
import { commonDataService, type City, type District, type RequestType } from "@/services/commonDataService";

// Define extended type for Mosque with relations
interface MosqueWithDetails extends Mosque {
  city: { name: string } | null;
  district: { name: string } | null;
}

export default function Home() {
  const requesterRoleOptions = Object.entries(REQUESTER_ROLE_LABELS).filter(
    ([value]) => value !== "mosque_congregation"
  );

  const [formData, setFormData] = useState<CreateRequestData>({
    requester_name: "",
    requester_phone: "",
    requester_role: "",
    city: "",
    district: "",
    mosque_id: "",
    need_type: "",
    details: "",
  });

  const [mosques, setMosques] = useState<MosqueWithDetails[]>([]);
  const [filteredMosques, setFilteredMosques] = useState<MosqueWithDetails[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [requestNumber, setRequestNumber] = useState("");

  // حالة نموذج إضافة مسجد جديد
  const [showAddMosqueDialog, setShowAddMosqueDialog] = useState(false);
  const [addMosqueData, setAddMosqueData] = useState({
    requester_name: "",
    requester_phone: "",
    city: "",
    district: "",
    name: "",
    google_maps_link: "",
  });
  const [addMosqueLoading, setAddMosqueLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (formData.city) {
      loadDistrictsByCity(formData.city);
      setFormData((prev) => ({ ...prev, district: "", mosque_id: "" }));
    }
  }, [formData.city]);

  useEffect(() => {
    if (formData.district) {
      const filtered = mosques.filter(
        (m) => m.city?.name === formData.city && m.district?.name === formData.district
      );
      setFilteredMosques(filtered);
      setFormData((prev) => ({ ...prev, mosque_id: "" }));
    }
  }, [formData.district, formData.city, mosques]);

  const loadInitialData = async () => {
    try {
      setDataLoading(true);
      const [citiesData, mosquesData, requestTypesData] = await Promise.all([
        commonDataService.getAllCities(),
        mosqueService.getAllMosques(),
        commonDataService.getAllRequestTypes(),
      ]);

      setCities(citiesData);
      setMosques(mosquesData as unknown as MosqueWithDetails[]);
      setRequestTypes(requestTypesData);
    } catch (err) {
      console.error("Error loading initial data:", err);
      setError("حدث خطأ في تحميل البيانات");
    } finally {
      setDataLoading(false);
    }
  };

  const loadDistrictsByCity = async (cityName: string) => {
    try {
      // Find city ID by name
      const city = cities.find((c) => c.name === cityName);
      if (!city) return;

      const districtsData = await commonDataService.getDistrictsByCity(city.id);
      setDistricts(districtsData);
    } catch (err) {
      console.error("Error loading districts:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await requestService.createRequest(formData);
      setRequestNumber(result.rq_number || "");
      setSuccess(true);
      setFormData({
        requester_name: "",
        requester_phone: "",
        requester_role: "",
        city: "",
        district: "",
        mosque_id: "",
        need_type: "",
        details: "",
      });
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إرسال الطلب");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMosque = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setAddMosqueLoading(true);

    try {
      await mosqueAdditionService.createAdditionRequest({
        requester_name: addMosqueData.requester_name,
        requester_phone: addMosqueData.requester_phone,
        city: addMosqueData.city,
        district: addMosqueData.district,
        mosque_name: addMosqueData.name,
        google_maps_link: addMosqueData.google_maps_link,
      });

      setRequestNumber("AM-" + Date.now().toString().slice(-6));
      setSuccess(true);
      setShowAddMosqueDialog(false);
      setAddMosqueData({
        requester_name: "",
        requester_phone: "",
        city: "",
        district: "",
        name: "",
        google_maps_link: "",
      });
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء إرسال طلب إضافة المسجد");
    } finally {
      setAddMosqueLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <>
        <SEO
          title="نظام إدارة طلبات صيانة المساجد"
          description="جاري تحميل البيانات..."
        />
        <div className="min-h-screen bg-charity-bg-light flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-charity-primary mx-auto mb-4" />
            <p className="text-gray-600">جاري تحميل البيانات...</p>
          </div>
        </div>
      </>
    );
  }

  if (success) {
    return (
      <>
        <SEO
          title="تم استلام الطلب - نظام إدارة طلبات صيانة المساجد"
          description="تم استلام طلبك بنجاح"
        />
        <div
          className="min-h-screen bg-charity-bg-light flex items-center justify-center p-4"
          dir="rtl"
        >
          <Card className="w-full max-w-2xl shadow-2xl border-0">
            <CardContent className="p-12 text-center">
              <div className="mb-8 flex justify-center">
                <div className="w-24 h-24 bg-charity-bg-calm rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-16 h-16 text-charity-primary" />
                </div>
              </div>

              <h1 className="text-4xl font-bold text-gray-800 mb-6">
                تم استلام طلبك بنجاح
              </h1>

              {requestNumber && (
                <div className="bg-charity-bg-calm border-2 border-charity-medium rounded-xl p-6 mb-8">
                  <p className="text-lg text-gray-600 mb-2">رقم الطلب</p>
                  <p className="text-3xl font-bold text-charity-primary">
                    {requestNumber}
                  </p>
                </div>
              )}

              <div className="space-y-4 text-right bg-gray-50 rounded-xl p-6 mb-8">
                <p className="text-lg text-gray-700">
                  <span className="font-semibold text-gray-800">✓</span> تم استلام
                  طلبك وسيتم مراجعته من قبل فريق خدمة العملاء
                </p>
                <p className="text-lg text-gray-700">
                  <span className="font-semibold text-gray-800">✓</span> سيتم
                  التواصل معك قريباً لتأكيد تفاصيل الطلب
                </p>
                <p className="text-lg text-gray-700">
                  <span className="font-semibold text-gray-800">✓</span> يمكنك
                  متابعة حالة طلبك من خلال رقم الطلب أعلاه
                </p>
              </div>

              <div className="bg-charity-bg-calm border-2 border-charity-medium rounded-xl p-6 mb-8">
                <p className="text-gray-700 mb-2">
                  للاستفسارات أو المساعدة، يرجى التواصل على:
                </p>
                <p className="text-3xl font-bold text-charity-dark" dir="ltr">
                  920011204
                </p>
              </div>

              {requestNumber && requestNumber.includes("AM-") ? (
                <div className="bg-charity-bg-calm border-2 border-charity-medium rounded-xl p-6 mb-8">
                  <p className="text-lg text-charity-dark font-semibold text-center">
                    سيتم مراجعة طلب إضافة المسجد والتواصل معك قريباً
                  </p>
                </div>
              ) : null}

            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO
        title="نظام إدارة طلبات صيانة المساجد"
        description="نسعد بخدمتكم من خلال تقديم طلبات الصيانة والاحتياجات للمساجد بكل سهولة ويسر"
      />
      <div
        className="min-h-screen bg-charity-bg-light py-12 px-4"
        dir="rtl"
      >
        <div className="max-w-3xl mx-auto">
          <div className="mb-5 flex justify-start">
            <div className="relative h-12 w-[190px] sm:h-14 sm:w-[230px] md:h-16 md:w-[260px]">
              <Image
                src="/logo/logo-topline.svg"
                alt="شعار الجمعية"
                fill
                priority
                sizes="(max-width: 639px) 190px, (max-width: 767px) 230px, 260px"
                className="object-contain object-right"
              />
            </div>
          </div>

          <Card className="shadow-2xl border-0 overflow-hidden">
            <div className="bg-gradient-to-l from-charity-primary to-charity-dark px-5 py-8 sm:px-6 sm:py-10 md:px-8 md:py-12 text-white">
              <div className="mx-auto w-full max-w-2xl">
                <div className="flex flex-col items-center justify-center text-center gap-4 sm:gap-5">
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                    نموذج طلب صيانة
                  </h1>
                </div>
              </div>
            </div>

            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-charity-bg-calm border-r-4 border-charity-dark p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-charity-dark mt-0.5 flex-shrink-0" />
                    <p className="text-charity-dark text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label
                    htmlFor="requester_name"
                    className="text-base font-semibold text-gray-700"
                  >
                    اسم مقدم الطلب <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="requester_name"
                    placeholder="أدخل الاسم الكامل"
                    value={formData.requester_name}
                    onChange={(e) =>
                      setFormData({ ...formData, requester_name: e.target.value })
                    }
                    required
                    className="text-base py-6 text-right"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="requester_phone"
                    className="text-base font-semibold text-gray-700"
                  >
                    رقم الهاتف <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="requester_phone"
                    type="tel"
                    placeholder="05xxxxxxxx"
                    value={formData.requester_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, requester_phone: e.target.value })
                    }
                    required
                    className="text-base py-6 text-right"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="requester_role"
                    className="text-base font-semibold text-gray-700"
                  >
                    صفة مقدم الطلب <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    dir="rtl"
                    value={formData.requester_role}
                    onValueChange={(value) =>
                      setFormData({ ...formData, requester_role: value as CreateRequestData["requester_role"] })
                    }
                  >
                    <SelectTrigger className="text-base py-6 text-right" id="requester_role">
                      <SelectValue placeholder="اختر صفة مقدم الطلب" />
                    </SelectTrigger>
                    <SelectContent>
                      {requesterRoleOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-right">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="city"
                    className="text-base font-semibold text-gray-700"
                  >
                    المدينة <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    dir="rtl"
                    value={formData.city}
                    onValueChange={(value) =>
                      setFormData({ ...formData, city: value })
                    }
                    required
                  >
                    <SelectTrigger className="text-base py-6 text-right">
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={city.name} className="text-right">
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="district"
                    className="text-base font-semibold text-gray-700"
                  >
                    الحي <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    dir="rtl"
                    value={formData.district}
                    onValueChange={(value) =>
                      setFormData({ ...formData, district: value })
                    }
                    disabled={!formData.city}
                    required
                  >
                    <SelectTrigger className="text-base py-6 text-right">
                      <SelectValue
                        placeholder={formData.city ? "اختر الحي" : "اختر المدينة أولاً"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem
                          key={district.id}
                          value={district.name}
                          className="text-right"
                        >
                          {district.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="mosque_id"
                    className="text-base font-semibold text-gray-700"
                  >
                    المسجد <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    dir="rtl"
                    value={formData.mosque_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, mosque_id: value })
                    }
                    disabled={!formData.district}
                    required
                  >
                    <SelectTrigger className="text-base py-6 text-right">
                      <SelectValue
                        placeholder={
                          formData.district ? "اختر المسجد" : "اختر الحي أولاً"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMosques.map((mosque) => (
                        <SelectItem
                          key={mosque.id}
                          value={mosque.id}
                          className="text-right"
                        >
                          {mosque.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Dialog open={showAddMosqueDialog} onOpenChange={setShowAddMosqueDialog}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="link"
                        className="text-charity-primary hover:text-charity-dark p-0 h-auto font-semibold"
                      >
                        <MapPin className="w-4 h-4 ml-1" />
                        لم أجد مسجدي
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl text-right">
                          إضافة مسجد جديد
                        </DialogTitle>
                        <DialogDescription className="text-right">
                          يرجى تعبئة البيانات التالية وسيتم التواصل معك لإضافة المسجد
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddMosque} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="add_requester_name" className="text-right">
                            اسم مقدم الطلب <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="add_requester_name"
                            placeholder="أدخل الاسم الكامل"
                            value={addMosqueData.requester_name}
                            onChange={(e) =>
                              setAddMosqueData({
                                ...addMosqueData,
                                requester_name: e.target.value,
                              })
                            }
                            required
                            className="text-right"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add_requester_phone" className="text-right">
                            رقم الهاتف <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="add_requester_phone"
                            type="tel"
                            placeholder="05xxxxxxxx"
                            value={addMosqueData.requester_phone}
                            onChange={(e) =>
                              setAddMosqueData({
                                ...addMosqueData,
                                requester_phone: e.target.value,
                              })
                            }
                            required
                            className="text-right"
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add_city" className="text-right">
                            المدينة <span className="text-red-500">*</span>
                          </Label>
                          <Select
                            dir="rtl"
                            value={addMosqueData.city}
                            onValueChange={(value) =>
                              setAddMosqueData({ ...addMosqueData, city: value })
                            }
                            required
                          >
                            <SelectTrigger className="text-right">
                              <SelectValue placeholder="اختر المدينة" />
                            </SelectTrigger>
                            <SelectContent>
                              {cities.map((city) => (
                                <SelectItem
                                  key={city.id}
                                  value={city.name}
                                  className="text-right"
                                >
                                  {city.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add_district" className="text-right">
                            الحي <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="add_district"
                            placeholder="أدخل اسم الحي"
                            value={addMosqueData.district}
                            onChange={(e) =>
                              setAddMosqueData({
                                ...addMosqueData,
                                district: e.target.value,
                              })
                            }
                            required
                            className="text-right"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add_name" className="text-right">
                            اسم المسجد <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="add_name"
                            placeholder="أدخل اسم المسجد"
                            value={addMosqueData.name}
                            onChange={(e) =>
                              setAddMosqueData({
                                ...addMosqueData,
                                name: e.target.value,
                              })
                            }
                            required
                            className="text-right"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="add_google_maps" className="text-right">
                            رابط الموقع من Google Maps <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="add_google_maps"
                            type="url"
                            placeholder="https://maps.google.com/..."
                            value={addMosqueData.google_maps_link}
                            onChange={(e) =>
                              setAddMosqueData({
                                ...addMosqueData,
                                google_maps_link: e.target.value,
                              })
                            }
                            required
                            className="text-left"
                            dir="ltr"
                          />
                        </div>

                        <div className="flex gap-3 pt-4">
                          <Button
                            type="submit"
                            disabled={addMosqueLoading}
                            className="flex-1 bg-charity-primary hover:bg-charity-dark"
                          >
                            {addMosqueLoading ? (
                              <>
                                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                                جاري الإرسال...
                              </>
                            ) : (
                              "إرسال الطلب"
                            )}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowAddMosqueDialog(false)}
                            disabled={addMosqueLoading}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="need_type"
                    className="text-base font-semibold text-gray-700"
                  >
                    نوع الاحتياج <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    dir="rtl"
                    value={formData.need_type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, need_type: value })
                    }
                    required
                  >
                    <SelectTrigger className="text-base py-6 text-right">
                      <SelectValue placeholder="اختر نوع الاحتياج" />
                    </SelectTrigger>
                    <SelectContent>
                      {requestTypes.map((type) => (
                        <SelectItem key={type.id} value={type.name} className="text-right">
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="details"
                    className="text-base font-semibold text-gray-700"
                  >
                    تفاصيل الطلب <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="details"
                    placeholder="يرجى كتابة تفاصيل الاحتياج أو المشكلة..."
                    value={formData.details}
                    onChange={(e) =>
                      setFormData({ ...formData, details: e.target.value })
                    }
                    required
                    rows={5}
                    className="text-base text-right resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-l from-charity-primary to-charity-dark hover:from-charity-dark hover:to-charity-primary text-white py-6 text-lg font-semibold shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    "إرسال الطلب"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-gray-600 mt-6 text-sm">
            للاستفسارات أو المساعدة:{" "}
            <span className="font-bold text-gray-800" dir="ltr">
              920011204
            </span>
          </p>
        </div>
      </div>
    </>
  );
}