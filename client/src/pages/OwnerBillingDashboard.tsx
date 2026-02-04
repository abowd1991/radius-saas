import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function OwnerBillingDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.billing.getDashboardStats.useQuery();
  const { data: revenueHistory, isLoading: revenueLoading } = trpc.billing.getRevenueHistory.useQuery({ days: 30 });
  const { data: lowBalanceClients, isLoading: clientsLoading } = trpc.billing.getLowBalanceClients.useQuery();

  if (statsLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
      </div>
    );
  }

  // Prepare pie chart data
  const clientStatusData = [
    { name: "نشط", value: stats.activeClients, color: "#10b981" },
    { name: "متأخر", value: stats.pastDueClients, color: "#f59e0b" },
    { name: "معلق", value: stats.suspendedClients, color: "#ef4444" },
  ];

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">لوحة التحكم المالية</h1>
        <p className="text-muted-foreground mt-2">
          إحصائيات الفوترة والإيرادات الشاملة
        </p>
      </div>

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Daily Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إيرادات اليوم</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.dailyRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              الخصومات اليومية
            </p>
          </CardContent>
        </Card>

        {/* Monthly Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إيرادات الشهر</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.monthlyRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              الشهر الحالي
            </p>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              منذ البداية
            </p>
          </CardContent>
        </Card>

        {/* Average Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">متوسط الرصيد</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.averageBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              لكل عميل
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>اتجاه الإيرادات</CardTitle>
            <CardDescription>آخر 30 يوم</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : revenueHistory && revenueHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={revenueHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString("ar-EG", { month: "short", day: "numeric" })}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(value) => new Date(value).toLocaleDateString("ar-EG")}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "الإيرادات"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-16">لا توجد بيانات</p>
            )}
          </CardContent>
        </Card>

        {/* Client Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>توزيع العملاء</CardTitle>
            <CardDescription>حسب حالة الفوترة</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={clientStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {clientStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm">عملاء نشطون</span>
                </div>
                <span className="font-semibold">{stats.activeClients}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-sm">متأخرون في الدفع</span>
                </div>
                <span className="font-semibold">{stats.pastDueClients}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">معلقون</span>
                </div>
                <span className="font-semibold">{stats.suspendedClients}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Balance Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            عملاء بأرصدة منخفضة
          </CardTitle>
          <CardDescription>
            العملاء الذين لديهم رصيد $5 أو أقل ({stats.lowBalanceCount} عميل)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : lowBalanceClients && lowBalanceClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-3 px-4">العميل</th>
                    <th className="text-right py-3 px-4">البريد الإلكتروني</th>
                    <th className="text-right py-3 px-4">الرصيد</th>
                    <th className="text-right py-3 px-4">NAS الفعّالة</th>
                    <th className="text-right py-3 px-4">الحالة</th>
                    <th className="text-right py-3 px-4">آخر خصم</th>
                  </tr>
                </thead>
                <tbody>
                  {lowBalanceClients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4 font-medium">{client.username}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{client.email}</td>
                      <td className="py-3 px-4">
                        <span className={client.balance <= 2 ? "text-red-600 font-semibold" : "text-orange-600 font-semibold"}>
                          ${client.balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">{client.activeNasCount}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            client.billingStatus === "active"
                              ? "default"
                              : client.billingStatus === "past_due"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {client.billingStatus === "active"
                            ? "نشط"
                            : client.billingStatus === "past_due"
                            ? "متأخر"
                            : "معلق"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {client.lastDailyBillingDate
                          ? new Date(client.lastDailyBillingDate).toLocaleDateString("ar-EG")
                          : "لم يتم"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              لا يوجد عملاء بأرصدة منخفضة 🎉
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
