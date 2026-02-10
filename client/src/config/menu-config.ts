import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Settings,
  Server,
  Activity,
  Shield,
  PieChart,
  UserCog,
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
 * Simplified menu structure for SaaS-style navigation
 * Owner/Super_Admin: Full access with Admin Console
 * Client: Simplified sidebar (Dashboard, NAS, Cards, Sessions, Staff, Billing)
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

  // 2. Admin Console (Owner/Super_Admin only) - Unified management
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

  // 3. NAS Devices (Infrastructure)
  {
    id: "infrastructure",
    icon: Server,
    label: "NAS Devices",
    labelAr: "أجهزة NAS",
    requiredPermissionGroup: "infrastructure_nas",
    items: [
      { icon: Server, label: "NAS Devices", labelAr: "أجهزة NAS", path: "/nas" },
    ],
  },

  // 4. Cards & Vouchers
  {
    id: "cards",
    icon: CreditCard,
    label: "Cards & Vouchers",
    labelAr: "البطاقات",
    requiredPermissionGroup: "cards_vouchers",
    items: [
      { icon: CreditCard, label: "Vouchers", labelAr: "الكروت", path: "/vouchers" },
    ],
  },

  // 5. Sessions (Monitoring)
  {
    id: "sessions",
    icon: Activity,
    label: "Sessions",
    labelAr: "الجلسات",
    requiredPermissionGroup: "network_management",
    items: [
      { icon: Activity, label: "Active Sessions", labelAr: "الجلسات النشطة", path: "/sessions" },
    ],
  },

  // 6. Staff Management (Client Owner only - for managing their staff)
  {
    id: "staff",
    icon: UserCog,
    label: "Staff",
    labelAr: "الموظفين",
    requiredRole: ["client_owner"],
    items: [
      { 
        icon: UserCog, 
        label: "Staff Management", 
        labelAr: "إدارة الموظفين", 
        path: "/staff-management",
        requiredRole: ["client_owner"]
      },
    ],
  },

  // 7. Billing (Client's subscription)
  {
    id: "billing",
    icon: Wallet,
    label: "Billing",
    labelAr: "الفوترة",
    requiredPermissionGroup: "billing_finance",
    items: [
      { icon: Wallet, label: "Wallet", labelAr: "المحفظة", path: "/wallet" },
      { icon: Wallet, label: "Subscriptions", labelAr: "الاشتراكات", path: "/tenant-subscriptions" },
    ],
  },

  // 8. Reports & Analytics (Owner/Super_Admin)
  {
    id: "reports",
    icon: PieChart,
    label: "Reports",
    labelAr: "التقارير",
    requiredPermissionGroup: "reports_analytics",
    items: [
      { icon: PieChart, label: "Reports", labelAr: "التقارير", path: "/reports" },
    ],
  },

  // 9. Settings (Owner/Super_Admin only)
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    labelAr: "الإعدادات",
    requiredRole: ["super_admin", "owner"],
    items: [
      { 
        icon: Settings, 
        label: "Settings", 
        labelAr: "الإعدادات", 
        path: "/settings",
        requiredRole: ["super_admin", "owner"]
      },
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
