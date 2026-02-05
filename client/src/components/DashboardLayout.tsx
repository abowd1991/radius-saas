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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
// Using local auth page instead of OAuth
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
  ChevronRight,
  Link2,
  Printer,
  BarChart3,
  Moon,
  Sun,
  Database,
  UserCheck,
  Wifi,
  History,
  Network,
  Smartphone,
  Monitor,
  Shield,
  Receipt,
  PieChart,
  Cog,
  type LucideIcon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
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

// Menu section type
type MenuSection = {
  id: string;
  icon: LucideIcon;
  label: string;
  items: {
    icon: LucideIcon;
    label: string;
    path: string;
  }[];
};

// Menu items based on user role - REFACTORED WITH GLOBAL NAMING
const getMenuSections = (role: string, t: (key: string) => string, permissions: any): MenuSection[] => {
  const superAdminSections: MenuSection[] = [
    // 1. Dashboard
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
      ],
    },
    // 2. Monitoring (المراقبة)
    {
      id: "monitoring",
      icon: Monitor,
      label: "المراقبة",
      items: [
        { icon: Wifi, label: "الجلسات النشطة", path: "/sessions" },
        { icon: FileText, label: "سجلات RADIUS", path: "/radius-logs" },
        { icon: Activity, label: "مراقبة NAS", path: "/nas-health" },
        { icon: Network, label: "حالة IP Pool", path: "/ip-pool" },
      ],
    },
    // 3. Infrastructure (البنية التحتية)
    {
      id: "infrastructure",
      icon: Globe,
      label: "البنية التحتية",
      items: [
        { icon: Server, label: "أجهزة NAS", path: "/nas" },
        { icon: Link2, label: "إعداد MikroTik", path: "/mikrotik-setup" },
        { icon: Globe, label: "اتصالات VPN", path: "/vpn" },
        { icon: History, label: "سجلات VPN", path: "/vpn-logs" },
      ],
    },
    // 4. Users & Clients (المستخدمين والعملاء)
    {
      id: "users",
      icon: Users,
      label: "المستخدمين والعملاء",
      items: [
        { icon: UserCheck, label: "المشتركين", path: "/subscribers" },
        { icon: Users, label: "العملاء", path: "/users-management" },
        { icon: Building2, label: "الموزعين", path: "/resellers" },
      ],
    },
    // 5. Access Control (التحكم بالوصول)
    {
      id: "access",
      icon: Shield,
      label: "التحكم بالوصول",
      items: [
        { icon: Package, label: "الخطط", path: "/plans" },
        { icon: Server, label: "لوحة تحكم RADIUS", path: "/radius-control" },
      ],
    },
    // 6. Cards & Vouchers (البطاقات)
    {
      id: "cards",
      icon: CreditCard,
      label: "البطاقات",
      items: [
        { icon: CreditCard, label: "الكروت", path: "/vouchers" },
        { icon: Printer, label: "طباعة الكروت", path: "/print-cards" },
      ],
    },
    // 7. Billing (الفوترة)
    {
      id: "billing",
      icon: Receipt,
      label: "الفوترة",
      items: [
        { icon: LayoutDashboard, label: "لوحة الفوترة", path: "/owner-billing" },
        { icon: FileText, label: "الفواتير", path: "/invoices" },
        { icon: Wallet, label: "المحفظة", path: "/wallet" },
        { icon: Wallet, label: "سجل المحفظة", path: "/wallet-ledger" },
        { icon: CreditCard, label: "الاشتراكات", path: "/tenant-subscriptions" },
        { icon: Package, label: "خطط SaaS", path: "/saas-plans" },
      ],
    },
    // 8. Reports & Analytics (التقارير والتحليلات)
    ...(permissions.canViewReports ? [{
      id: "reports",
      icon: PieChart,
      label: "التقارير",
      items: [
        { icon: BarChart3, label: "التقارير", path: "/reports" },
        { icon: Activity, label: "الباندويث", path: "/bandwidth" },
      ],
    }] : []),
    // 9. System (النظام)
    {
      id: "system",
      icon: Cog,
      label: "النظام",
      items: [
        { icon: Settings, label: "الإعدادات", path: "/settings" },
        { icon: History, label: "سجل العمليات", path: "/audit-log" },
        { icon: Database, label: "النسخ الاحتياطي", path: "/backup-management" },
        { icon: Settings, label: "إعدادات الموقع", path: "/site-settings" },
        { icon: CreditCard, label: "خطط الاشتراك", path: "/subscription-plans" },
        { icon: Settings, label: "إدارة النظام", path: "/system-admin" },
        { icon: Shield, label: "التحكم بالصلاحيات", path: "/feature-access" },
        { icon: Smartphone, label: "إدارة SMS", path: "/sms" },
        { icon: MessageSquare, label: "الدعم الفني", path: "/support" },
      ],
    },
  ];

  const resellerSections: MenuSection[] = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
      ],
    },
    {
      id: "users",
      icon: Users,
      label: "العملاء",
      items: [
        { icon: Users, label: "عملائي", path: "/clients" },
      ],
    },
    {
      id: "cards",
      icon: CreditCard,
      label: "البطاقات",
      items: [
        { icon: CreditCard, label: "الكروت", path: "/vouchers" },
      ],
    },
    {
      id: "billing",
      icon: Receipt,
      label: "الفوترة",
      items: [
        { icon: FileText, label: "الفواتير", path: "/invoices" },
        { icon: Wallet, label: "المحفظة", path: "/wallet" },
      ],
    },
    {
      id: "support",
      icon: MessageSquare,
      label: "الدعم",
      items: [
        { icon: MessageSquare, label: "الدعم الفني", path: "/support" },
      ],
    },
  ];

  const clientSections: MenuSection[] = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
      ],
    },
    ...(permissions.canViewSessions ? [{
      id: "monitoring",
      icon: Monitor,
      label: "المراقبة",
      items: [
        { icon: Wifi, label: "الجلسات النشطة", path: "/sessions" },
      ],
    }] : []),
    ...(permissions.canManageNas ? [{
      id: "network",
      icon: Globe,
      label: "الشبكة",
      items: [
        { icon: Server, label: "أجهزة NAS الخاصة بي", path: "/nas" },
        { icon: Link2, label: "إعداد MikroTik", path: "/mikrotik-setup" },
      ],
    }] : []),
    ...(permissions.canManageSubscribers ? [{
      id: "users",
      icon: Users,
      label: "المشتركين",
      items: [
        { icon: UserCheck, label: "مشتركيني", path: "/subscribers" },
      ],
    }] : []),
    ...(permissions.canManageVouchers ? [{
      id: "cards",
      icon: CreditCard,
      label: "البطاقات",
      items: [
        { icon: CreditCard, label: "كروتي", path: "/vouchers" },
        { icon: Printer, label: "طباعة الكروت", path: "/print-cards" },
        ...(permissions.canManagePlans ? [{ icon: Package, label: "الخطط", path: "/plans" }] : []),
      ],
    }] : []),
    ...(permissions.canViewBilling ? [{
      id: "billing",
      icon: Receipt,
      label: "الفوترة",
      items: [
        ...(permissions.canManageInvoices ? [{ icon: FileText, label: "فواتيري", path: "/invoices" }] : []),
        ...(permissions.canViewWallet ? [{ icon: Wallet, label: "محفظتي", path: "/wallet" }] : []),
      ],
    }] : []),
    {
      id: "reports",
      icon: PieChart,
      label: "التقارير",
      items: [
        { icon: BarChart3, label: "تقاريري", path: "/reports" },
      ],
    },
    {
      id: "system",
      icon: Cog,
      label: "الإعدادات",
      items: [
        { icon: History, label: "سجل العمليات", path: "/audit-log" },
        { icon: MessageSquare, label: "الدعم الفني", path: "/support" },
      ],
    },
  ];

  const supportSections: MenuSection[] = [
    {
      id: "dashboard",
      icon: LayoutDashboard,
      label: t("nav.dashboard"),
      items: [
        { icon: LayoutDashboard, label: t("nav.dashboard"), path: "/dashboard" },
      ],
    },
    {
      id: "users",
      icon: Users,
      label: "المستخدمين",
      items: [
        { icon: Users, label: t("nav.clients"), path: "/clients" },
        { icon: Building2, label: t("nav.resellers"), path: "/resellers" },
      ],
    },
    {
      id: "cards",
      icon: CreditCard,
      label: "البطاقات",
      items: [
        { icon: CreditCard, label: t("nav.vouchers"), path: "/vouchers" },
      ],
    },
    {
      id: "network",
      icon: Globe,
      label: "الشبكة",
      items: [
        { icon: Server, label: t("nav.nas"), path: "/nas" },
        { icon: Activity, label: t("nav.sessions"), path: "/sessions" },
      ],
    },
    {
      id: "support",
      icon: MessageSquare,
      label: t("nav.support"),
      items: [
        { icon: MessageSquare, label: t("nav.support"), path: "/support" },
      ],
    },
  ];

  switch (role) {
    case "owner":
    case "super_admin":
      return superAdminSections;
    case "reseller":
      return resellerSections;
    case "support":
      return supportSections;
    case "client":
    default:
      return clientSections;
  }
};

// Flatten sections to get all menu items for finding active item
const flattenSections = (sections: MenuSection[]) => {
  return sections.flatMap(section => section.items);
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

// Key for storing expanded sections in localStorage
const EXPANDED_SECTIONS_KEY = "sidebar-expanded-sections";

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
              window.location.href = "/auth";
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
  const { permissions } = useFeatureAccess();

  const menuSections = getMenuSections(user?.role || "client", t, permissions);
  const allMenuItems = flattenSections(menuSections);
  const activeMenuItem = allMenuItems.find((item) => item.path === location);

  // Find which section contains the active item
  const activeSectionId = menuSections.find(section => 
    section.items.some(item => item.path === location)
  )?.id;

  // Expanded sections state
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    const saved = localStorage.getItem(EXPANDED_SECTIONS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Default: expand dashboard and the section containing active item
    const defaults = ["dashboard"];
    if (activeSectionId && !defaults.includes(activeSectionId)) {
      defaults.push(activeSectionId);
    }
    return defaults;
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem(EXPANDED_SECTIONS_KEY, JSON.stringify(expandedSections));
  }, [expandedSections]);

  // Auto-expand section when navigating to a new page
  useEffect(() => {
    if (activeSectionId && !expandedSections.includes(activeSectionId)) {
      setExpandedSections(prev => [...prev, activeSectionId]);
    }
  }, [activeSectionId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return { label: language === "ar" ? "مالك النظام" : "Owner", variant: "destructive" as const };
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

          <SidebarContent className="gap-0 overflow-y-auto">
            {menuSections.map((section) => {
              const isExpanded = expandedSections.includes(section.id);
              const isSingleItem = section.items.length === 1;
              const sectionHasActiveItem = section.items.some(item => item.path === location);

              // For single-item sections (like Dashboard), render directly
              if (isSingleItem) {
                const item = section.items[0];
                const isActive = location === item.path;
                return (
                  <SidebarMenu key={section.id} className="px-2 py-0.5">
                    <SidebarMenuItem>
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
                  </SidebarMenu>
                );
              }

              // For multi-item sections, render collapsible
              return (
                <Collapsible
                  key={section.id}
                  open={isExpanded}
                  onOpenChange={() => toggleSection(section.id)}
                  className="group/collapsible"
                >
                  <SidebarMenu className="px-2 py-0.5">
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={section.label}
                          className={`h-10 transition-all font-medium ${sectionHasActiveItem ? "bg-accent/50" : ""}`}
                        >
                          <section.icon
                            className={`h-4 w-4 ${sectionHasActiveItem ? "text-primary" : ""}`}
                          />
                          <span className="flex-1">{section.label}</span>
                          <ChevronRight
                            className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                          />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                        <SidebarMenu className={`${direction === "rtl" ? "pr-4 border-r" : "pl-4 border-l"} border-border/50 mt-1 space-y-0.5`}>
                          {section.items.map((item) => {
                            const isActive = location === item.path;
                            return (
                              <SidebarMenuItem key={item.path}>
                                <SidebarMenuButton
                                  isActive={isActive}
                                  onClick={() => setLocation(item.path)}
                                  tooltip={item.label}
                                  className="h-9 transition-all font-normal text-sm"
                                >
                                  <item.icon
                                    className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`}
                                  />
                                  <span>{item.label}</span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </Collapsible>
              );
            })}
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
                <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer">
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
