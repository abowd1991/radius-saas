import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { BillingInfo } from "@/components/BillingInfo";
import { AccountStatusBanner } from "@/components/AccountStatusBanner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Users,
  Building2,
  CreditCard,
  FileText,
  Wallet,
  Activity,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";
import { RevenueTrendChart } from "@/components/charts/RevenueTrendChart";
import { SessionsTrendChart } from "@/components/charts/SessionsTrendChart";
import { NasHealthWidget } from "@/components/charts/NasHealthWidget";
import { RevenueChart } from "@/components/charts/RevenueChart";
import { UserGrowthChart } from "@/components/charts/UserGrowthChart";
import { SessionsTimelineChart } from "@/components/charts/SessionsTimelineChart";
import { useState } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [, setLocation] = useLocation();

  // Fetch dashboard stats
  const { data: stats, isLoading, refetch } = trpc.dashboard.getStats.useQuery();
  
  // Fetch admin stats (for owner/super_admin)
  const { data: adminStats, isLoading: isAdminStatsLoading } = trpc.dashboard.getAdminStats.useQuery(
    undefined,
    { enabled: user?.role === 'owner' || user?.role === 'super_admin' }
  );
  
  // Fetch client stats (for clients)
  const { data: clientStats, isLoading: isClientStatsLoading } = trpc.dashboard.getClientStats.useQuery(
    undefined,
    { enabled: user?.role === 'client' || user?.role === 'client_owner' }
  );
  
  // Analytics data
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const { data: revenueData } = trpc.analytics.revenueTrend.useQuery({ days: analyticsDays });
  const { data: sessionsData } = trpc.analytics.sessionsTrend.useQuery({ days: analyticsDays });
  const { data: nasHealthData } = trpc.analytics.nasHealth.useQuery();
  const { data: userGrowthData } = trpc.analytics.userGrowth.useQuery(
    { days: analyticsDays },
    { enabled: user?.role === 'owner' || user?.role === 'super_admin' }
  );
  const { data: sessionsTimelineData } = trpc.analytics.sessionsTimeline.useQuery(
    undefined,
    { enabled: user?.role === 'owner' || user?.role === 'super_admin' }
  );
  const { data: totalCardsData } = trpc.analytics.totalCardsCreated.useQuery(
    undefined,
    { enabled: user?.role === 'owner' || user?.role === 'super_admin' }
  );
  
  // Fetch billing info for clients
  const { data: billingData, isLoading: isBillingLoading } = trpc.billing.getMySummary.useQuery(
    undefined,
    { enabled: user?.role === 'client' }
  );

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US").format(num);
  };

  // Client Owner Dashboard (with widgets)
  if (user?.role === "client_owner") {
    return (
      <div className="space-y-6">
        {/* Account Status Banner */}
        <AccountStatusBanner />
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("dashboard.welcome")}، {user.name}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "لوحة تحكم مالك العميل" : "Client Owner Dashboard"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>

        {/* Stats Grid - Client Owner Widgets */}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 border" onClick={() => setLocation("/staff-management")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {language === "ar" ? "إجمالي الموظفين" : "Total Staff"}
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-stat">{formatNumber((stats as any)?.totalStaff || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "مديرين وموظفين" : "Admins and staff"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 border" onClick={() => setLocation("/nas")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {language === "ar" ? "أجهزة NAS النشطة" : "Active NAS"}
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Activity className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-stat">{formatNumber((stats as any)?.activeNasCount || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "أجهزة متصلة" : "Connected devices"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 border" onClick={() => setLocation("/vouchers")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {language === "ar" ? "الكروت المستخدمة" : "Cards Used"}
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-stat">{formatNumber((stats as any)?.usedCards || 0)}</div>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{language === "ar" ? "اليوم" : "Today"}: {formatNumber((stats as any)?.cardsUsedToday || 0)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{language === "ar" ? "هذا الأسبوع" : "Week"}: {formatNumber((stats as any)?.cardsUsedThisWeek || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 border" onClick={() => setLocation("/wallet")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("dashboard.wallet_balance")}</CardTitle>
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-stat">{formatCurrency(stats?.walletBalance || "0")}</div>
              <Button variant="link" className="p-0 h-auto mt-2 text-xs" onClick={() => setLocation("/wallet")}>
                {language === "ar" ? "إضافة رصيد" : "Add funds"}
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg hover:border-primary/20 transition-all duration-200 border" onClick={() => setLocation("/vouchers")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {language === "ar" ? "إجمالي الكروت" : "Total Cards"}
              </CardTitle>
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-stat">{formatNumber((stats as any)?.totalCards || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber((stats as any)?.usedCards || 0)} {language === "ar" ? "مستخدم" : "used"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{language === "ar" ? "إجراءات سريعة" : "Quick Actions"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-3">
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={() => setLocation("/staff-management")}>
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">{language === "ar" ? "إدارة الموظفين" : "Manage Staff"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={() => setLocation("/vouchers")}>
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">{language === "ar" ? "إنشاء كروت" : "Generate Cards"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex flex-col gap-1.5 hover:bg-primary/5 hover:border-primary/30 transition-all" onClick={() => setLocation("/support")}>
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">{language === "ar" ? "الدعم الفني" : "Support"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Owner/Super Admin Dashboard
  if (user?.role === "owner" || user?.role === "super_admin") {
    return (
      <div className="space-y-6">
        {/* Account Status Banner */}
        <AccountStatusBanner />
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("dashboard.welcome")}، {user.name}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "نظرة عامة على النظام" : "System Overview"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>

        {/* New Admin Stats Cards */}
        {isAdminStatsLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
          </div>
        ) : adminStats && (
          <>
            {/* Financial Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}</CardTitle>
                  <Wallet className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(adminStats.totalRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "من جميع الإيداعات" : "From all deposits"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/bank-transfer-admin")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "طلبات تحويل بنكي" : "Bank Transfer Requests"}</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{formatNumber(adminStats.pendingBankTransfers)}</div>
                  <Badge variant="secondary" className="mt-2 bg-orange-100 text-orange-700">
                    <Clock className="h-3 w-3 mr-1" />
                    {language === "ar" ? "قيد المراجعة" : "Pending Review"}
                  </Badge>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "رصيد النظام الكلي" : "Total System Balance"}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(adminStats.totalSystemBalance)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "مجموع أرصدة العملاء" : "Sum of all wallets"}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "الإيرادات الشهرية" : "Monthly Revenue"}</CardTitle>
                  <TrendingUp className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(adminStats.monthlyRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "هذا الشهر" : "This month"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* User Stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "مستخدمين نشطين" : "Active Users"}</CardTitle>
                  <Users className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatNumber(adminStats.activeUsers)}</div>
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {language === "ar" ? "نشط" : "Active"}
                  </Badge>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "اشتراكات تنتهي قريباً" : "Expiring Soon"}</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{formatNumber(adminStats.expiringSoon)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "خلال 7 أيام" : "Within 7 days"}
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "مستخدمين جدد" : "New Users"}</CardTitle>
                  <Users className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatNumber(adminStats.newUsersThisMonth)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "هذا الشهر" : "This month"}
                  </p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{language === "ar" ? "حسابات منخفضة الرصيد" : "Low Balance Accounts"}</CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{formatNumber(adminStats.lowBalanceAccounts)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "أقل من $5" : "Less than $5"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Old Stats Grid (keep for backward compatibility) */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_users")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.totalUsers || 0)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500">+12%</span>
                {language === "ar" ? "من الشهر الماضي" : "from last month"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/resellers")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_resellers")}</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.totalResellers || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "موزعين نشطين" : "Active resellers"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/sessions")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.active_sessions")}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.activeSessions || 0)}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                {language === "ar" ? "متصلين الآن" : "Online now"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_revenue")}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || "0")}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500">+8%</span>
                {language === "ar" ? "من الشهر الماضي" : "from last month"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/invoices")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.pending_invoices")}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.pendingInvoices || 0)}</div>
              <Badge variant="secondary" className="mt-2">
                <Clock className="h-3 w-3 mr-1" />
                {language === "ar" ? "بانتظار الدفع" : "Awaiting payment"}
              </Badge>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/support")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.open_tickets")}</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.openTickets || 0)}</div>
              <Badge variant={stats?.openTickets && stats.openTickets > 0 ? "destructive" : "secondary"} className="mt-2">
                {stats?.openTickets && stats.openTickets > 0 ? (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {language === "ar" ? "تحتاج اهتمام" : "Needs attention"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {language === "ar" ? "لا توجد تذاكر" : "All clear"}
                  </>
                )}
              </Badge>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/subscriptions")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.active_subscriptions")}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.activeSubscriptions || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "اشتراكات نشطة" : "Active subscriptions"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_clients")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.totalClients || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "عملاء مسجلين" : "Registered clients"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-6">
          {/* Revenue Chart */}
          <div className="lg:col-span-2">
            <RevenueChart data={revenueData || []} isLoading={!revenueData} />
          </div>
          
          {/* Total Cards Created Stat */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي الكروت المنشأة" : "Total Cards Created"}</CardTitle>
              <CreditCard className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isAdminStatsLoading ? (
                <div className="text-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-purple-600">
                    {formatNumber((totalCardsData as any)?.total_cards || 0)}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{language === "ar" ? "نشط" : "Active"}</span>
                      <span className="font-medium text-green-600">{formatNumber((totalCardsData as any)?.active_cards || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{language === "ar" ? "مستخدم" : "Used"}</span>
                      <span className="font-medium text-blue-600">{formatNumber((totalCardsData as any)?.used_cards || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{language === "ar" ? "منتهي" : "Expired"}</span>
                      <span className="font-medium text-red-600">{formatNumber((totalCardsData as any)?.expired_cards || 0)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* User Growth & Sessions Charts */}
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <UserGrowthChart data={userGrowthData || []} isLoading={!userGrowthData} />
          <SessionsTimelineChart data={sessionsTimelineData || []} isLoading={!sessionsTimelineData} />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "إجراءات سريعة" : "Quick Actions"}</CardTitle>
            <CardDescription>
              {language === "ar" ? "الوصول السريع للمهام الشائعة" : "Quick access to common tasks"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/resellers")}>
                <Building2 className="h-5 w-5" />
                <span>{language === "ar" ? "إضافة موزع" : "Add Reseller"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/plans")}>
                <CreditCard className="h-5 w-5" />
                <span>{language === "ar" ? "إدارة الخطط" : "Manage Plans"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/nas")}>
                <Activity className="h-5 w-5" />
                <span>{language === "ar" ? "أجهزة NAS" : "NAS Devices"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/vouchers")}>
                <CreditCard className="h-5 w-5" />
                <span>{language === "ar" ? "إنشاء كروت" : "Generate Vouchers"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <RevenueTrendChart data={revenueData || []} isLoading={!revenueData} />
          <SessionsTrendChart data={sessionsData || []} isLoading={!sessionsData} />
        </div>

        <NasHealthWidget data={nasHealthData || { statusCounts: [], topNas: [] }} isLoading={!nasHealthData} />
      </div>
    );
  }

  // Reseller Dashboard
  if (user?.role === "reseller") {
    return (
      <div className="space-y-6">
        {/* Account Status Banner */}
        <AccountStatusBanner />
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("dashboard.welcome")}، {user.name}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "لوحة تحكم الموزع" : "Reseller Dashboard"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/wallet")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.wallet_balance")}</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.walletBalance || "0")}</div>
              <Button variant="link" className="p-0 h-auto mt-2" onClick={() => setLocation("/wallet")}>
                {language === "ar" ? "إضافة رصيد" : "Add funds"}
                <ArrowUpRight className="h-3 w-3 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/clients")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_clients")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.totalClients || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "ar" ? "عملاء نشطين" : "Active clients"}
              </p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/vouchers")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.total_vouchers")}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber((stats as any)?.totalCards || 0)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {(stats as any)?.usedCards || 0} {language === "ar" ? "مستخدم" : "used"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/subscriptions")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.active_subscriptions")}</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.activeSubscriptions || 0)}</div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/invoices")}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.pending_invoices")}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.pendingInvoices || 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "إجراءات سريعة" : "Quick Actions"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/clients")}>
                <Users className="h-5 w-5" />
                <span>{language === "ar" ? "إضافة عميل" : "Add Client"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/vouchers")}>
                <CreditCard className="h-5 w-5" />
                <span>{language === "ar" ? "إنشاء كروت" : "Generate Vouchers"}</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/support")}>
                <MessageSquare className="h-5 w-5" />
                <span>{language === "ar" ? "الدعم الفني" : "Support"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Client Dashboard
  return (
    <div className="space-y-6">
      {/* Account Status Banner */}
      <AccountStatusBanner />
      
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("dashboard.welcome")}، {user?.name}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "لوحة التحكم الخاصة بك" : "Your Dashboard"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
          {language === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Billing Info - Hidden for clients as requested */}
      {/* <BillingInfo 
        data={billingData || null} 
        isLoading={isBillingLoading} 
      /> */}

      {/* New Client Stats Cards */}
      {isClientStatsLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
        </div>
      ) : clientStats && (
        <>
          {/* Balance & Trial Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card 
              className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${
                parseFloat(clientStats.currentBalance) > 10 ? 'border-l-green-500' :
                parseFloat(clientStats.currentBalance) >= 1 ? 'border-l-orange-500' :
                'border-l-red-500'
              }`}
              onClick={() => setLocation("/wallet")}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "رصيدي الحالي" : "My Balance"}</CardTitle>
                <Wallet className={`h-4 w-4 ${
                  parseFloat(clientStats.currentBalance) > 10 ? 'text-green-500' :
                  parseFloat(clientStats.currentBalance) >= 1 ? 'text-orange-500' :
                  'text-red-500'
                }`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  parseFloat(clientStats.currentBalance) > 10 ? 'text-green-600' :
                  parseFloat(clientStats.currentBalance) >= 1 ? 'text-orange-600' :
                  'text-red-600'
                }`}>
                  {formatCurrency(clientStats.currentBalance)}
                </div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{language === "ar" ? "حالة الرصيد" : "Balance Status"}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        parseFloat(clientStats.currentBalance) > 10 ? 'bg-green-500' :
                        parseFloat(clientStats.currentBalance) >= 1 ? 'bg-orange-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (parseFloat(clientStats.currentBalance) / 20) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "الأيام المتبقية من Trial" : "Trial Days Left"}</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{clientStats.trialDaysLeft}</div>
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{language === "ar" ? "من 7 أيام" : "Out of 7 days"}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${(clientStats.trialDaysLeft / 7) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "مدة استمرار الرصيد" : "Balance Duration"}</CardTitle>
                <TrendingUp className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {clientStats.balanceDuration > 365 ? '∞' : clientStats.balanceDuration}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "يوم متبقي" : "days remaining"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/nas")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "أجهزة NAS النشطة" : "Active NAS Devices"}</CardTitle>
                <Activity className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{clientStats.activeNasCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "جهاز" : "devices"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Billing & Activity Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "التكلفة الشهرية المتوقعة" : "Estimated Monthly Cost"}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(clientStats.estimatedMonthlyCost)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? `$10 × ${clientStats.activeNasCount} NAS` : `$10 × ${clientStats.activeNasCount} NAS`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "آخر عملية شحن" : "Last Deposit"}</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {clientStats.lastDeposit ? (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(clientStats.lastDeposit.amount)}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(clientStats.lastDeposit.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">{language === "ar" ? "لا توجد عمليات شحن" : "No deposits yet"}</p>
                )}
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/bank-transfer-recharge")}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "طلبات التحويل البنكي" : "Bank Transfer Requests"}</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 text-sm">
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                    {clientStats.bankTransferRequests.pending} {language === "ar" ? "قيد المراجعة" : "Pending"}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    {clientStats.bankTransferRequests.approved} {language === "ar" ? "موافق" : "Approved"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي المصروفات" : "Total Spent"}</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(clientStats.totalSpent)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "منذ بداية الاشتراك" : "Since subscription start"}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Old Stats Grid (keep for backward compatibility) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/wallet")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.wallet_balance")}</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats?.walletBalance || "0")}</div>
            <Button variant="link" className="p-0 h-auto mt-2">
              {language === "ar" ? "شحن الرصيد" : "Top up"}
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/subscriptions")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.active_subscriptions")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.activeSubscriptions || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "ar" ? "اشتراكات نشطة" : "Active subscriptions"}
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/invoices")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.pending_invoices")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats?.pendingInvoices || 0)}</div>
            {stats?.pendingInvoices && stats.pendingInvoices > 0 ? (
              <Badge variant="destructive" className="mt-2">
                {language === "ar" ? "بانتظار الدفع" : "Payment due"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="mt-2">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {language === "ar" ? "لا توجد فواتير" : "All paid"}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.data_used")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(((stats as any)?.totalDataUsed || 0) / 1024)} GB
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {language === "ar" ? "هذا الشهر" : "This month"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "إجراءات سريعة" : "Quick Actions"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/vouchers")}>
              <CreditCard className="h-5 w-5" />
              <span>{t("vouchers.redeem")}</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/wallet")}>
              <Wallet className="h-5 w-5" />
              <span>{t("wallet.add_funds")}</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" onClick={() => setLocation("/support")}>
              <MessageSquare className="h-5 w-5" />
              <span>{t("support.new_ticket")}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
