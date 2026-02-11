import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  CreditCard,
  TrendingUp,
  DollarSign,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CardSales() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [days, setDays] = useState(30);

  // Fetch card sales analytics
  const { data: salesData, isLoading, refetch } = trpc.analytics.clientCardSales.useQuery({ days });

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (user?.role === 'owner' || user?.role === 'super_admin') {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "غير مصرح" : "Unauthorized"}</CardTitle>
            <CardDescription>
              {language === "ar" 
                ? "هذه الصفحة مخصصة للعملاء فقط"
                : "This page is for clients only"
              }
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ar" ? "تحليلات مبيعات الكروت" : "Card Sales Analytics"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {language === "ar" 
              ? "تتبع مبيعاتك وإيراداتك من الكروت"
              : "Track your card sales and revenue"
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(7)}
          >
            {language === "ar" ? "7 أيام" : "7 days"}
          </Button>
          <Button
            variant={days === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(30)}
          >
            {language === "ar" ? "30 يوم" : "30 days"}
          </Button>
          <Button
            variant={days === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(90)}
          >
            {language === "ar" ? "90 يوم" : "90 days"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-2">
            {language === "ar" ? "جاري التحميل..." : "Loading..."}
          </p>
        </div>
      ) : salesData ? (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {language === "ar" ? "إجمالي الكروت" : "Total Cards"}
                </CardTitle>
                <Package className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatNumber(salesData.totalSales?.total_cards || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "جميع الكروت المنشأة" : "All created cards"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {language === "ar" ? "كروت مباعة" : "Cards Sold"}
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatNumber(salesData.totalSales?.sold_cards || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "كروت مستخدمة" : "Used cards"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {language === "ar" ? "كروت متاحة" : "Available Cards"}
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatNumber(salesData.totalSales?.available_cards || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "جاهزة للبيع" : "Ready to sell"}
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  {language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}
                </CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(salesData.revenue?.total_revenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {language === "ar" ? "من الكروت المباعة" : "From sold cards"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sales Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                {language === "ar" ? "اتجاه المبيعات" : "Sales Trend"}
              </CardTitle>
              <CardDescription>
                {language === "ar" 
                  ? `مبيعات آخر ${days} يوم`
                  : `Sales for the last ${days} days`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesData.salesTrend && salesData.salesTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={salesData.salesTrend.map((item: any) => ({
                    date: new Date(item.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    }),
                    sales: Number(item.cards_sold) || 0,
                  }))}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number) => [value, language === 'ar' ? 'مبيعات' : 'Sales']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات مبيعات" : "No sales data available"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Selling Plans */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                {language === "ar" ? "أكثر الباقات مبيعاً" : "Top Selling Plans"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesData.topPlans && salesData.topPlans.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesData.topPlans.map((item: any) => ({
                    name: item.plan_name || 'N/A',
                    sales: Number(item.cards_sold) || 0,
                    revenue: Number(item.revenue) || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'sales') {
                          return [value, language === 'ar' ? 'مبيعات' : 'Sales'];
                        }
                        return [formatCurrency(value), language === 'ar' ? 'إيرادات' : 'Revenue'];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        if (value === 'sales') return language === 'ar' ? 'مبيعات' : 'Sales';
                        if (value === 'revenue') return language === 'ar' ? 'إيرادات' : 'Revenue';
                        return value;
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data available"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Sales Table */}
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "آخر المبيعات" : "Recent Sales"}</CardTitle>
              <CardDescription>
                {language === "ar" ? "آخر 10 كروت مباعة" : "Last 10 sold cards"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {salesData.recentSales && salesData.recentSales.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "ar" ? "اسم المستخدم" : "Username"}</TableHead>
                        <TableHead>{language === "ar" ? "الباقة" : "Plan"}</TableHead>
                        <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{language === "ar" ? "تاريخ البيع" : "Sold At"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesData.recentSales.map((sale: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{sale.username}</TableCell>
                          <TableCell>{sale.plan_name || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant={sale.status === 'used' ? 'default' : 'secondary'}>
                              {sale.status === 'used' 
                                ? (language === "ar" ? "مستخدم" : "Used")
                                : sale.status
                              }
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(sale.sold_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {language === "ar" ? "لا توجد مبيعات حديثة" : "No recent sales"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {language === "ar" ? "لا توجد بيانات" : "No data available"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
