import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Hook to get feature access permissions for the current user
 * Returns default permissions for owner/super_admin
 * Returns custom permissions for clients if configured
 */
export function useFeatureAccess() {
  const { user } = useAuth();

  // Owner and super_admin have all permissions by default
  if (user?.role === "owner" || user?.role === "super_admin") {
    return {
      permissions: {
        canViewDashboard: true,
        canManageNas: true,
        canManageVouchers: true,
        canManagePlans: true,
        canViewSessions: true,
        canViewReports: true,
        canViewWallet: true,
        canManageSubscribers: true,
        canViewVpn: true,
        canViewRadiusLogs: true,
        canViewAuditLog: true,
        canManageSms: true,
        canViewSupport: true,
        canViewBilling: true,
        canManageInvoices: true,
      },
      isLoading: false,
    };
  }

  // For clients, fetch their custom permissions
  const { data: permissions, isLoading } = trpc.featureAccess.getUserPermissions.useQuery(
    { userId: user?.id || 0 },
    {
      enabled: !!user?.id && user?.role === "client",
    }
  );

  return {
    permissions: permissions || {
      // Default permissions for clients
      canViewDashboard: true,
      canManageNas: true,
      canManageVouchers: true,
      canManagePlans: true,
      canViewSessions: true,
      canViewReports: false,
      canViewWallet: true,
      canManageSubscribers: true,
      canViewVpn: false,
      canViewRadiusLogs: false,
      canViewAuditLog: false,
      canManageSms: false,
      canViewSupport: true,
      canViewBilling: true,
      canManageInvoices: true,
    },
    isLoading,
  };
}
