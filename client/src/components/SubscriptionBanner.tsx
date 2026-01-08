import { trpc } from "@/lib/trpc";
import { AlertTriangle, XCircle } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export function SubscriptionBanner() {
  const { user } = useAuth();
  const { data: status, isLoading } = trpc.tenantSubscriptions.myStatus.useQuery(undefined, {
    enabled: !!user && user.role !== 'super_admin',
    staleTime: 60000, // Cache for 1 minute
  });

  // Don't show for super_admin or while loading
  if (!user || user.role === 'super_admin' || isLoading) {
    return null;
  }

  // Don't show if subscription is active
  if (status?.isActive) {
    // Show warning if expiring soon (within 7 days)
    if (status.daysRemaining !== null && status.daysRemaining <= 7 && status.daysRemaining > 0) {
      return (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-3">
          <div className="flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              تحذير: اشتراكك سينتهي خلال {status.daysRemaining} يوم. يرجى التواصل مع الدعم للتجديد.
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  // Show frozen banner
  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-4">
      <div className="flex flex-col items-center justify-center gap-2 text-red-700 dark:text-red-400">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          <span className="text-base font-bold">
            حسابك مجمّد - الاشتراك منتهي أو معلق
          </span>
        </div>
        <p className="text-sm text-center max-w-lg">
          لا يمكنك إنشاء أو تعديل أي بيانات حالياً. جميع بياناتك محفوظة ولن يتم حذفها.
          <br />
          للتجديد، يرجى التواصل مع الدعم الفني أو إرسال تذكرة دعم.
        </p>
        <div className="flex gap-2 mt-2">
          <a
            href="/support"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            تواصل مع الدعم
          </a>
        </div>
      </div>
    </div>
  );
}
