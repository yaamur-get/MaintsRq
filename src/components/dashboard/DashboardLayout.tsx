import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut,
  Menu,
  X,
  Bell,
  Landmark,
  Building,
  MapPin
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type UserRole = Database["public"]["Enums"]["user_role"];

interface DashboardLayoutProps {
  children: ReactNode;
  userRole?: UserRole;
}

export function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [actualUserRole, setActualUserRole] = useState<UserRole | undefined>(userRole);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const session = await authService.getCurrentSession();
    if (!session) {
      router.push("/dashboard/login");
    } else {
      setCurrentUser(session.user);
      
      // If userRole not provided, fetch it from database
      if (!userRole) {
        const role = await authService.getUserRole(session.user.id);
        setActualUserRole(role as UserRole);
      }
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    router.push("/dashboard/login");
  };

  const menuItems = [
    { 
      icon: LayoutDashboard, 
      label: "الرئيسية", 
      href: "/dashboard",
      roles: ["admin", "project_manager", "customer_service", "technician", "pricing_expert"]
    },
    { 
      icon: FileText, 
      label: "الطلبات", 
      href: "/dashboard/requests",
      roles: ["admin", "project_manager", "customer_service", "technician", "pricing_expert"]
    },
    { 
      icon: Landmark, 
      label: "المساجد", 
      href: "/dashboard/mosques",
      roles: ["admin", "project_manager", "customer_service"]
    },
    { 
      icon: Users, 
      label: "المستخدمين", 
      href: "/dashboard/users",
      roles: ["admin"]
    },
    { 
      icon: Settings, 
      label: "الإعدادات", 
      href: "/dashboard/settings",
      roles: ["admin", "project_manager"]
    }
  ];

  const filteredMenuItems = menuItems.filter(item => 
    !actualUserRole || item.roles.includes(actualUserRole)
  );

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="bg-charity-bg-calm p-4 rounded-lg mb-4">
              <h1 className="text-xl font-bold text-charity-dark">نظام إدارة صيانة المساجد</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </Button>
            
            <div className="hidden sm:flex items-center gap-2 border-r border-slate-200 pr-3">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">{currentUser?.email}</p>
                <p className="text-xs text-slate-500">
                  {actualUserRole === "admin" && "مدير النظام"}
                  {actualUserRole === "project_manager" && "مدير المشاريع"}
                  {actualUserRole === "customer_service" && "خدمة العملاء"}
                  {actualUserRole === "technician" && "فني"}
                  {actualUserRole === "pricing_expert" && "خبير التسعير"}
                </p>
              </div>
            </div>

            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside 
          className={`
            fixed lg:sticky top-[57px] right-0 h-[calc(100vh-57px)] 
            w-64 bg-white border-l border-slate-200 
            transition-transform duration-300 z-30
            ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
          `}
        >
          <nav className="p-4 space-y-2">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={`w-full justify-start gap-3 ${
                      isActive 
                        ? "bg-charity-primary text-white hover:bg-charity-dark" 
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
            
            <Link href="/dashboard/mosques">
              <Button
                variant={router.pathname === "/dashboard/mosques" ? "default" : "ghost"}
                className={`w-full justify-start gap-3 ${
                  router.pathname === "/dashboard/mosques"
                    ? "bg-charity-primary text-white hover:bg-charity-dark"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <Building className="w-5 h-5" />
                <span>إدارة المساجد</span>
              </Button>
            </Link>

            {(userRole === "customer_service" || userRole === "admin") && (
              <Link href="/dashboard/mosque-additions">
                <Button
                  variant={router.pathname === "/dashboard/mosque-additions" ? "default" : "ghost"}
                  className={`w-full justify-start gap-3 ${
                    router.pathname === "/dashboard/mosque-additions"
                      ? "bg-charity-primary text-white hover:bg-charity-dark"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <MapPin className="w-5 h-5" />
                  <span>طلبات إضافة المساجد</span>
                </Button>
              </Link>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}