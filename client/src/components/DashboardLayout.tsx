import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  CreditCard,
  FileText,
  Wallet,
  MessageSquare,
  Settings,
  Bell,
  Server,
  Package,
  Activity,
  Globe,
  UserCircle,
  Building2,
  ChevronDown,
  Link2,
  Printer,
  BarChart3,
  Moon,
  Sun,
  Database,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { NotificationBell } from "./NotificationBell";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { SubscriptionBanner } from "./SubscriptionBanner";

// Theme Toggle Button Component
function ThemeToggleButton() {
  const { theme, toggleTheme, switchable } = useTheme();
  
  if (!switchable || !toggleTheme) return null;
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="transition-all duration-300"
      title={theme === "dark" ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-yellow-500 transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="h-5 w-5 text-slate-700 transition-transform duration-300 rotate-0" />
      )}
    </Button>
  );
}

// Menu items based on user role
const getMenuItems = (role: string, t: (key: string) => string) => {
  const superAdminItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
    { icon: Building2, label: t("nav.resellers"), path: "/resellers" },
    { icon: Users, label: t("nav.clients"), path: "/clients" },
    { icon: Package, label: t("nav.plans"), path: "/plans" },
    { icon: Server, label: t("nav.nas"), path: "/nas" },
    { icon: Link2, label: t("nav.mikrotikSetup"), path: "/mikrotik-setup" },
    { icon: CreditCard, label: t("nav.vouchers"), path: "/vouchers" },
    { icon: Printer, label: "طباعة البطاقات", path: "/print-cards" },
    { icon: FileText, label: t("nav.invoices"), path: "/invoices" },
    { icon: Activity, label: t("nav.sessions"), path: "/sessions" },
    { icon: MessageSquare, label: t("nav.support"), path: "/support" },
    { icon: Settings, label: t("nav.settings"), path: "/settings" },
    { icon: CreditCard, label: "إدارة الاشتراكات", path: "/tenant-subscriptions" },
    { icon: BarChart3, label: "التقارير", path: "/reports" },
    { icon: Database, label: "النسخ الاحتياطي", path: "/backups" },
  ];

  const resellerItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
    { icon: Users, label: t("nav.clients"), path: "/clients" },
    { icon: CreditCard, label: t("nav.vouchers"), path: "/vouchers" },
    { icon: FileText, label: t("nav.invoices"), path: "/invoices" },
    { icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { icon: MessageSquare, label: t("nav.support"), path: "/support" },
  ];

  const clientItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
    { icon: Server, label: t("nav.nas"), path: "/nas" },
    { icon: Link2, label: t("nav.mikrotikSetup"), path: "/mikrotik-setup" },
    { icon: Package, label: t("nav.plans"), path: "/plans" },
    { icon: CreditCard, label: t("nav.vouchers"), path: "/vouchers" },
    { icon: Printer, label: "طباعة البطاقات", path: "/print-cards" },
    { icon: Activity, label: t("nav.sessions"), path: "/sessions" },
    { icon: FileText, label: t("nav.invoices"), path: "/invoices" },
    { icon: Wallet, label: t("nav.wallet"), path: "/wallet" },
    { icon: MessageSquare, label: t("nav.support"), path: "/support" },
  ];

  // Support role - view only, no financial access
  const supportItems = [
    { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
    { icon: Users, label: t("nav.clients"), path: "/clients" },
    { icon: Building2, label: t("nav.resellers"), path: "/resellers" },
    { icon: CreditCard, label: t("nav.vouchers"), path: "/vouchers" },
    { icon: Server, label: t("nav.nas"), path: "/nas" },
    { icon: Activity, label: t("nav.sessions"), path: "/sessions" },
    { icon: MessageSquare, label: t("nav.support"), path: "/support" },
  ];

  switch (role) {
    case "super_admin":
      return superAdminItems;
    case "reseller":
      return resellerItems;
    case "support":
      return supportItems;
    case "client":
    default:
      return clientItems;
  }
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  const { language, setLanguage, t, direction } = useLanguage();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  // Redirect to auth page if not logged in
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = '/auth';
    }
  }, [loading, user]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir={direction}>
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Globe className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t("app.name")}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t("app.tagline")}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            {t("auth.login")}
          </Button>
          <div className="flex gap-2">
            <Button
              variant={language === "ar" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("ar")}
            >
              العربية
            </Button>
            <Button
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              onClick={() => setLanguage("en")}
            >
              English
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { language, setLanguage, t, direction } = useLanguage();

  const menuItems = getMenuItems(user?.role || "client", t);
  const activeMenuItem = menuItems.find((item) => item.path === location);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return { label: language === "ar" ? "مدير النظام" : "Super Admin", variant: "destructive" as const };
      case "reseller":
        return { label: language === "ar" ? "موزع" : "Reseller", variant: "default" as const };
      case "support":
        return { label: language === "ar" ? "دعم فني" : "Support", variant: "outline" as const };
      case "client":
      default:
        return { label: language === "ar" ? "عميل" : "Client", variant: "secondary" as const };
    }
  };

  const roleBadge = getRoleBadge(user?.role || "client");

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarRect = sidebarRef.current?.getBoundingClientRect();
      if (!sidebarRect) return;

      let newWidth: number;
      if (direction === "rtl") {
        newWidth = sidebarRect.right - e.clientX;
      } else {
        newWidth = e.clientX - sidebarRect.left;
      }

      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, direction]);

  return (
    <div dir={direction} className="flex min-h-screen w-full">
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          side={direction === "rtl" ? "right" : "left"}
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className={`h-4 w-4 text-muted-foreground ${direction === "rtl" ? "rotate-180" : ""}`} />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center justify-between w-full min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-semibold tracking-tight truncate">
                      {t("app.name")}
                    </span>
                  </div>
                  <ThemeToggleButton />
                </div>
              ) : (
                <ThemeToggleButton />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-start group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <Badge variant={roleBadge.variant} className="text-[10px] px-1.5 py-0">
                        {roleBadge.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={direction === "rtl" ? "start" : "end"} className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer">
                  <UserCircle className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  <span>{t("auth.profile")}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
                  <Settings className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  <span>{t("auth.settings")}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 flex gap-1">
                  <Button
                    variant={language === "ar" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setLanguage("ar")}
                  >
                    العربية
                  </Button>
                  <Button
                    variant={language === "en" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1 h-7 text-xs"
                    onClick={() => setLanguage("en")}
                  >
                    English
                  </Button>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  <span>{t("auth.logout")}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 ${direction === "rtl" ? "left-0" : "right-0"} w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="flex-1">
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? t("nav.dashboard")}
                  </span>
                </div>
              </div>
            </div>
            <ThemeToggleButton />
            <NotificationBell />
          </div>
        )}
        <SubscriptionBanner />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </div>
  );
}
