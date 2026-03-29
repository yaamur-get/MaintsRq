import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Landmark, 
  Search, 
  Plus, 
  MapPin, 
  Phone,
  Users,
  Calendar,
  ChevronLeft,
  Building2
} from "lucide-react";
import { mosqueService } from "@/services/mosqueService";
import { requestService } from "@/services/requestService";
import { authService } from "@/services/authService";
import type { Database } from "@/integrations/supabase/types";

type Mosque = Database["public"]["Tables"]["mosques"]["Row"] & {
  city?: { name: string } | null;
  district?: { name: string } | null;
};

export default function MosquesPage() {
  const router = useRouter();
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [filteredMosques, setFilteredMosques] = useState<Mosque[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<any>(null);
  const [mosqueCounts, setMosqueCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterMosques();
  }, [searchQuery, mosques]);

  const loadData = async () => {
    try {
      const session = await authService.getCurrentSession();
      if (!session) return;

      // TODO: Get user role from user_roles table
      setUserRole("customer_service");

      const mosquesData = await mosqueService.getAllMosques();
      setMosques(mosquesData);

      // جلب عدد الطلبات لكل مسجد
      const counts: Record<string, number> = {};
      for (const mosque of mosquesData) {
        const requests = await requestService.getRequestsByMosque(mosque.id);
        counts[mosque.id] = requests.length;
      }
      setMosqueCounts(counts);
    } catch (error) {
      console.error("Error loading mosques:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterMosques = () => {
    if (!searchQuery.trim()) {
      setFilteredMosques(mosques);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = mosques.filter(
      (mosque) =>
        mosque.name.toLowerCase().includes(query) ||
        mosque.city?.name.toLowerCase().includes(query) ||
        mosque.district?.name.toLowerCase().includes(query) ||
        mosque.imam_name?.toLowerCase().includes(query)
    );
    setFilteredMosques(filtered);
  };

  const handleViewMosque = (mosqueId: string) => {
    router.push(`/dashboard/mosques/${mosqueId}`);
  };

  if (loading) {
    return (
      <DashboardLayout userRole={userRole}>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">جاري التحميل...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <>
      <SEO 
        title="إدارة المساجد - نظام إدارة صيانة المساجد"
        description="إدارة وعرض معلومات المساجد"
      />
      
      <DashboardLayout userRole={userRole}>
        <div className="space-y-6">
          {/* Header with Add Button */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">إدارة المساجد</h2>
              <p className="text-slate-600">
                عرض ومتابعة معلومات المساجد المسجلة في النظام
              </p>
            </div>

            {(userRole === "admin" || userRole === "project_manager") && (
              <Button className="bg-charity-primary hover:bg-charity-dark">
                <Building2 className="w-4 h-4 ml-2" />
                إضافة مسجد جديد
              </Button>
            )}
          </div>

          {/* Search */}
          <Card className="border-0 shadow-md">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ابحث عن مسجد (الاسم، المدينة، الحي، الإمام...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 text-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  إجمالي المساجد
                </CardTitle>
                <div className="bg-emerald-500 p-2 rounded-lg">
                  <Landmark className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-charity-primary">
                  {mosques.length}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  المساجد النشطة
                </CardTitle>
                <div className="bg-blue-500 p-2 rounded-lg">
                  <Users className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {mosques.filter(m => m.is_active).length}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  الطلبات النشطة
                </CardTitle>
                <div className="bg-orange-500 p-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {Object.values(mosqueCounts).reduce((a, b) => a + b, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mosques List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredMosques.length === 0 ? (
              <Card className="col-span-full border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Landmark className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">
                    {searchQuery ? "لم يتم العثور على مساجد مطابقة للبحث" : "لا توجد مساجد مسجلة"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredMosques.map((mosque) => (
                <Card 
                  key={mosque.id} 
                  className="p-6 hover:shadow-lg transition-all cursor-pointer border-r-4 border-r-charity-medium"
                >
                  <div className="flex items-start gap-4">
                    <div className="bg-charity-light p-2 rounded-lg">
                      <Landmark className="w-6 h-6 text-charity-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl mb-2">
                        {mosque.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                        <MapPin className="w-4 h-4" />
                        <span>{mosque.city?.name}</span>
                        {mosque.district?.name && (
                          <>
                            <span>•</span>
                            <span>{mosque.district.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {mosqueCounts[mosque.id] || 0} طلب
                      </span>
                    </div>

                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewMosque(mosque.id);
                      }}
                    >
                      عرض التفاصيل
                      <ChevronLeft className="w-4 h-4 mr-1" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}