import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
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

export default function Dashboard() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [, setLocation] = useLocation();

  // Fetch dashboard stats
  const { data: stats, isLoading, refetch } = trpc.dashboard.getStats.useQuery();

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

  // Super Admin Dashboard
  if (user?.role === "super_admin") {
    return (
      <div className="space-y-6">
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

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </div>
    );
  }

  // Reseller Dashboard
  if (user?.role === "reseller") {
    return (
      <div className="space-y-6">
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

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
              {formatNumber((stats?.totalDataUsed || 0) / 1024)} GB
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
