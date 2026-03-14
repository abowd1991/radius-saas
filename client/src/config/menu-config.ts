import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  Wallet,
  MessageSquare,
  Settings,
  Server,
  Package,
  Activity,
  Globe,
  Building2,
  Shield,
  Receipt,
  PieChart,
  Cog,
  Monitor,
  Wifi,
  Link2,
  History,
  Network,
  UserCheck,
  Printer,
  BarChart3,
  Database,
  Smartphone,
  type LucideIcon,
} from "lucide-react";

export type MenuSection = {
  id: string;
  icon: LucideIcon;
  label: string;
  labelAr: string;
  requiredPermissionGroup?: string; // Permission group key (e.g., 'client_management')
  requiredRole?: string[]; // Required roles (e.g., ['super_admin', 'owner'])
  items: {
    icon: LucideIcon;
    label: string;
    labelAr: string;
    path: string;
    requiredPermissionGroup?: string;
    requiredRole?: string[];
  }[];
};

/**
 * All menu sections in the system
 * Each section and item can have:
 * - requiredPermissionGroup: Permission group key required to view
 * - requiredRole: Specific roles required (bypasses permission check)
 */
export const ALL_MENU_SECTIONS: MenuSection[] = [
  // 1. Dashboard (Always visible)
  {
    id: "dashboard",
    icon: LayoutDashboard,
    label: "Dashboard",
    labelAr: "لوحة التحكم",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", labelAr: "لوحة التحكم", path: "/dashboard" },
    ],
  },

  // 2. Monitoring (Network Management)
  {
    id: "monitoring",
    icon: Monitor,
    label: "Monitoring",
    labelAr: "المراقبة",
    requiredPermissionGroup: "network_management",
    items: [
      { icon: Wifi, label: "Active Sessions", labelAr: "الجلسات النشطة", path: "/sessions" },
      { icon: FileText, label: "RADIUS Logs", labelAr: "سجلات RADIUS", path: "/radius-logs", requiredRole: ["super_admin", "owner"] },
      { icon: Activity, label: "NAS Health", labelAr: "مراقبة NAS", path: "/nas-health", requiredRole: ["super_admin", "owner"] },
      { icon: Network, label: "IP Pool Status", labelAr: "حالة IP Pool", path: "/ip-pool", requiredRole: ["super_admin", "owner"] },
    ],
  },

  // 3. Infrastructure (NAS Management)
  {
    id: "infrastructure",
    icon: Globe,
    label: "Infrastructure",
    labelAr: "البنية التحتية",
    requiredPermissionGroup: "infrastructure_nas",
    items: [
      { icon: Server, label: "NAS Devices", labelAr: "أجهزة NAS", path: "/nas" },
      { icon: Monitor, label: "Winbox Access", labelAr: "Winbox عن بُعد", path: "/winbox" },
      { icon: Link2, label: "MikroTik Setup", labelAr: "إعداد MikroTik", path: "/mikrotik-setup" },
    ],
  },

  // 4. VPN Management
  {
    id: "vpn",
    icon: Globe,
    label: "VPN",
    labelAr: "VPN",
    requiredPermissionGroup: "vpn_management",
    items: [
      { icon: Globe, label: "VPN Connections", labelAr: "اتصالات VPN", path: "/vpn" },
      { icon: History, label: "VPN Logs", labelAr: "سجلات VPN", path: "/vpn-logs" },
    ],
  },

  // 5. Admin Console (Owner/Super_Admin only) - Unified Management
  {
    id: "admin",
    icon: Shield,
    label: "Admin Console",
    labelAr: "لوحة الإدارة",
    requiredRole: ["super_admin", "owner"],
    items: [
      { 
        icon: Shield, 
        label: "Admin Console", 
        labelAr: "لوحة الإدارة", 
        path: "/admin",
        requiredRole: ["super_admin", "owner"]
      },
    ],
  },

  // 6. Users & Clients (Client Management)
  {
    id: "users",
    icon: Users,
    label: "Users & Clients",
    labelAr: "المستخدمين والعملاء",
    requiredPermissionGroup: "client_management",
    items: [
      { icon: UserCheck, label: "Subscribers", labelAr: "المشتركين", path: "/subscribers" },
      { icon: Users, label: "Staff Management", labelAr: "إدارة الموظفين", path: "/staff-management", requiredRole: ["client_owner"] },
    ],
  },

  // 7. Access Control (Cards & Vouchers)
  {
    id: "access",
    icon: Shield,
    label: "Access Control",
    labelAr: "التحكم بالوصول",
    requiredPermissionGroup: "cards_vouchers",
    items: [
      { icon: Package, label: "Plans", labelAr: "الخطط", path: "/plans" },
      { icon: Server, label: "RADIUS Control", labelAr: "لوحة تحكم RADIUS", path: "/radius-control", requiredRole: ["super_admin", "owner"] },
    ],
  },

  // 8. Cards & Vouchers
  {
    id: "cards",
    icon: CreditCard,
    label: "Cards & Vouchers",
    labelAr: "البطاقات",
    requiredPermissionGroup: "cards_vouchers",
    items: [
      { icon: CreditCard, label: "Vouchers", labelAr: "الكروت", path: "/vouchers" },
      { icon: Printer, label: "Print Cards", labelAr: "طباعة الكروت", path: "/print-cards" },
      { icon: BarChart3, label: "Card Sales Analytics", labelAr: "تحليلات مبيعات الكروت", path: "/card-sales" },
    ],
  },

  // 9. Billing & Wallet (Billing & Finance)
  {
    id: "billing",
    icon: Receipt,
    label: "Billing & Wallet",
    labelAr: "الفوترة والمحفظة",
    requiredPermissionGroup: "billing_finance",
    items: [
      { 
        icon: Receipt, 
        label: "Bank Transfer Requests", 
        labelAr: "طلبات التحويل البنكي", 
        path: "/bank-transfer-admin",
        requiredRole: ["super_admin", "owner"]
      },
      { icon: Wallet, label: "Wallet", labelAr: "المحفظة", path: "/wallet" },
      { icon: History, label: "Wallet Ledger", labelAr: "سجل المحفظة", path: "/wallet-ledger", requiredRole: ["super_admin", "owner"] },
      { icon: FileText, label: "Invoices", labelAr: "الفواتير", path: "/invoices" },
      { icon: CreditCard, label: "Subscriptions", labelAr: "الاشتراكات", path: "/tenant-subscriptions", requiredRole: ["super_admin", "owner"] },
      { 
        icon: LayoutDashboard, 
        label: "Billing Dashboard", 
        labelAr: "لوحة الفوترة", 
        path: "/owner-billing",
        requiredRole: ["super_admin", "owner"]
      },
    ],
  },

  // 10. Reports & Analytics
  {
    id: "reports",
    icon: PieChart,
    label: "Reports",
    labelAr: "التقارير",
    requiredPermissionGroup: "reports_analytics",
    items: [
      { icon: BarChart3, label: "Reports", labelAr: "التقارير", path: "/reports" },
      { icon: Activity, label: "Bandwidth", labelAr: "الباندويث", path: "/bandwidth" },
    ],
  },

  // 11. Support
  {
    id: "support",
    icon: MessageSquare,
    label: "Support",
    labelAr: "الدعم الفني",
    requiredPermissionGroup: "support_tickets",
    items: [
      { icon: MessageSquare, label: "Support", labelAr: "الدعم الفني", path: "/support" },
    ],
  },

  // 12. System Settings (Owner/Super Admin only)
  {
    id: "system",
    icon: Cog,
    label: "System",
    labelAr: "النظام",
    requiredRole: ["super_admin", "owner"],
    items: [
      { icon: Settings, label: "Settings", labelAr: "الإعدادات", path: "/settings" },
      { icon: Shield, label: "Default Plans", labelAr: "الخطط الافتراضية", path: "/default-plans" },
      { icon: History, label: "Audit Log", labelAr: "سجل العمليات", path: "/audit-log" },
      { icon: Database, label: "Backups", labelAr: "النسخ الاحتياطي", path: "/backup-management" },
      { icon: Settings, label: "Site Settings", labelAr: "إعدادات الموقع", path: "/site-settings" },
      { icon: CreditCard, label: "Subscription Plans", labelAr: "خطط الاشتراك", path: "/subscription-plans" },
      { icon: Smartphone, label: "SMS Management", labelAr: "إدارة SMS", path: "/sms" },
    ],
  },
];

/**
 * Filter menu sections based on user role and permissions
 */
export function filterMenuSections(
  sections: MenuSection[],
  role: string,
  permissions: Record<string, boolean>
): MenuSection[] {
  return sections
    .map((section) => {
      // Check section-level permissions
      if (section.requiredRole && !section.requiredRole.includes(role)) {
        return null;
      }
      
      // Check permission group requirement
      if (section.requiredPermissionGroup) {
        // Owner/super_admin bypass permission checks
        const hasPermission = permissions[section.requiredPermissionGroup];
        const isSuperUser = role === "super_admin" || role === "owner";
        
        if (!hasPermission && !isSuperUser) {
          return null;
        }
      }

      // Filter items within the section
      const filteredItems = section.items.filter((item) => {
        if (item.requiredRole && !item.requiredRole.includes(role)) {
          return false;
        }
        
        if (item.requiredPermissionGroup) {
          const hasPermission = permissions[item.requiredPermissionGroup];
          const isSuperUser = role === "super_admin" || role === "owner";
          
          if (!hasPermission && !isSuperUser) {
            return false;
          }
        }
        
        return true;
      });

      // If no items remain, hide the section
      if (filteredItems.length === 0) {
        return null;
      }

      return {
        ...section,
        items: filteredItems,
      };
    })
    .filter((section): section is MenuSection => section !== null);
}
