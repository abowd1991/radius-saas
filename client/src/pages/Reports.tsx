import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import { 
  CalendarIcon, Download, TrendingUp, TrendingDown, Users, 
  CreditCard, Activity, DollarSign, Clock, Wifi, FileText,
  FileSpreadsheet, RefreshCw, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Colors for charts
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// Format duration in Arabic
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  }
  return `${minutes}د`;
}

// Format currency
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

// Date range presets
type DatePreset = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "lastMonth" | "last30Days" | "last90Days" | "custom";

function getDateRange(preset: DatePreset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: new Date(yesterday.setHours(0, 0, 0, 0)), end: new Date(yesterday.setHours(23, 59, 59, 999)) };
    case "thisWeek":
      return { start: startOfWeek(now, { locale: ar }), end: endOfWeek(now, { locale: ar }) };
    case "lastWeek":
      const lastWeek = subDays(now, 7);
      return { start: startOfWeek(lastWeek, { locale: ar }), end: endOfWeek(lastWeek, { locale: ar }) };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "lastMonth":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "last30Days":
      return { start: subDays(now, 30), end: now };
    case "last90Days":
      return { start: subDays(now, 90), end: now };
    default:
      return { start: subDays(now, 30), end: now };
  }
}

// Export Dropdown Component
function ExportDropdown({ 
  dateRange, 
  groupBy, 
  activeTab 
}: { 
  dateRange: { start: Date; end: Date }; 
  groupBy: "day" | "week" | "month";
  activeTab: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const exportRevenueExcel = trpc.reports.exportRevenueExcel.useMutation();
  const exportCardsExcel = trpc.reports.exportCardsExcel.useMutation();
  const exportSessionsExcel = trpc.reports.exportSessionsExcel.useMutation();
  const exportSubscribersExcel = trpc.reports.exportSubscribersExcel.useMutation();
  const exportRevenuePDF = trpc.reports.exportRevenuePDF.useMutation();
  const exportCardsPDF = trpc.reports.exportCardsPDF.useMutation();
  const exportSessionsPDF = trpc.reports.exportSessionsPDF.useMutation();

  const downloadFile = (data: string, filename: string, isBase64: boolean = true) => {
    let blob: Blob;
    if (isBase64) {
      const binaryString = atob(data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    } else {
      blob = new Blob([data], { type: "text/html;charset=utf-8" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params = {
        startDate: dateRange.start.toISOString().split("T")[0],
        endDate: dateRange.end.toISOString().split("T")[0],
      };

      let result;
      switch (activeTab) {
        case "revenue":
          result = await exportRevenueExcel.mutateAsync({ ...params, groupBy });
          break;
        case "cards":
          result = await exportCardsExcel.mutateAsync(params);
          break;
        case "sessions":
          result = await exportSessionsExcel.mutateAsync(params);
          break;
        case "subscribers":
          result = await exportSubscribersExcel.mutateAsync(params);
          break;
        default:
          result = await exportRevenueExcel.mutateAsync({ ...params, groupBy });
      }

      downloadFile(result.data, result.filename, true);
      toast.success("تم تصدير التقرير بنجاح");
    } catch (error) {
      toast.error("فشل في تصدير التقرير");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const params = {
        startDate: dateRange.start.toISOString().split("T")[0],
        endDate: dateRange.end.toISOString().split("T")[0],
      };

      let result;
      switch (activeTab) {
        case "revenue":
          result = await exportRevenuePDF.mutateAsync({ ...params, groupBy });
          break;
        case "cards":
          result = await exportCardsPDF.mutateAsync(params);
          break;
        case "sessions":
          result = await exportSessionsPDF.mutateAsync(params);
          break;
        default:
          result = await exportRevenuePDF.mutateAsync({ ...params, groupBy });
      }

      // Open HTML in new window for printing
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(result.html);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      toast.success("تم فتح التقرير للطباعة");
    } catch (error) {
      toast.error("فشل في تصدير التقرير");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 ml-2" />
          )}
          تصدير
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 ml-2" />
          تصدير Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF}>
          <FileText className="h-4 w-4 ml-2" />
          طباعة PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("revenue");
  const [datePreset, setDatePreset] = useState<DatePreset>("last30Days");
  const [customDateRange, setCustomDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date(),
  });
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");

  // Calculate date range
  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return customDateRange;
    }
    return getDateRange(datePreset);
  }, [datePreset, customDateRange]);

  // Fetch reports data
  const { data: revenueData, isLoading: revenueLoading, refetch: refetchRevenue } = trpc.reports.revenue.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
    groupBy,
  });

  const { data: subscribersData, isLoading: subscribersLoading, refetch: refetchSubscribers } = trpc.reports.subscribers.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  const { data: cardsData, isLoading: cardsLoading, refetch: refetchCards } = trpc.reports.cards.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  const { data: sessionsData, isLoading: sessionsLoading, refetch: refetchSessions } = trpc.reports.sessions.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  // Usage report (peak hours, daily/weekly)
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = trpc.reports.usage.useQuery({
    startDate: dateRange.start.toISOString(),
    endDate: dateRange.end.toISOString(),
  });

  const refetchAll = () => {
    refetchRevenue();
    refetchSubscribers();
    refetchCards();
    refetchSessions();
    refetchUsage();
  };

  // Card status data for pie chart
  const cardStatusData = useMemo(() => {
    if (!cardsData) return [];
    return cardsData.cardsByStatus.map(s => ({
      name: s.status === "unused" ? "غير مستخدم" :
            s.status === "active" ? "نشط" :
            s.status === "used" ? "مستخدم" :
            s.status === "expired" ? "منتهي" :
            s.status === "suspended" ? "موقوف" : s.status,
      value: s.count,
    }));
  }, [cardsData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">التقارير والإحصائيات</h1>
          <p className="text-muted-foreground">تحليل شامل لأداء النظام</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Preset Selector */}
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="الفترة الزمنية" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">اليوم</SelectItem>
              <SelectItem value="yesterday">أمس</SelectItem>
              <SelectItem value="thisWeek">هذا الأسبوع</SelectItem>
              <SelectItem value="lastWeek">الأسبوع الماضي</SelectItem>
              <SelectItem value="thisMonth">هذا الشهر</SelectItem>
              <SelectItem value="lastMonth">الشهر الماضي</SelectItem>
              <SelectItem value="last30Days">آخر 30 يوم</SelectItem>
              <SelectItem value="last90Days">آخر 90 يوم</SelectItem>
            </SelectContent>
          </Select>

          {/* Group By Selector */}
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as "day" | "week" | "month")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="تجميع حسب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">يومي</SelectItem>
              <SelectItem value="week">أسبوعي</SelectItem>
              <SelectItem value="month">شهري</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          {/* Export Dropdown */}
          <ExportDropdown 
            dateRange={dateRange} 
            groupBy={groupBy}
            activeTab={activeTab}
          />
        </div>
      </div>

      {/* Date Range Display */}
      <div className="text-sm text-muted-foreground">
        الفترة: {format(dateRange.start, "dd MMM yyyy", { locale: ar })} - {format(dateRange.end, "dd MMM yyyy", { locale: ar })}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {revenueLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(revenueData?.totalRevenue || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {revenueData?.totalTransactions || 0} معاملة
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">المشتركين النشطين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {subscribersLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{subscribersData?.activeSubscribers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  من أصل {subscribersData?.totalSubscribers || 0} مشترك
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الكروت النشطة</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cardsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{cardsData?.activeCards || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {cardsData?.unusedCards || 0} غير مستخدم
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الجلسات النشطة</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{sessionsData?.activeSessions || 0}</div>
                <p className="text-xs text-muted-foreground">
                  متوسط المدة: {formatDuration(sessionsData?.averageSessionDuration || 0)}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different reports */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
          <TabsTrigger value="subscribers">المشتركين</TabsTrigger>
          <TabsTrigger value="cards">الكروت</TabsTrigger>
          <TabsTrigger value="sessions">الجلسات</TabsTrigger>
          <TabsTrigger value="usage">الاستخدام</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Over Time Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>الإيرادات عبر الزمن</CardTitle>
                <CardDescription>تطور الإيرادات خلال الفترة المحددة</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData?.revenueByPeriod || []}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), "الإيرادات"]}
                        labelFormatter={(label) => `التاريخ: ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Revenue by Client */}
            <Card>
              <CardHeader>
                <CardTitle>الإيرادات حسب العميل</CardTitle>
                <CardDescription>أعلى 10 عملاء من حيث الإيرادات</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueData?.revenueByClient || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="clientName" type="category" width={100} />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), "الإيرادات"]} />
                      <Bar dataKey="revenue" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Revenue Stats */}
            <Card>
              <CardHeader>
                <CardTitle>إحصائيات الإيرادات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي الإيرادات</span>
                  <span className="font-bold">{formatCurrency(revenueData?.totalRevenue || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">عدد المعاملات</span>
                  <span className="font-bold">{revenueData?.totalTransactions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">متوسط المعاملة</span>
                  <span className="font-bold">{formatCurrency(revenueData?.averageTransaction || 0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Subscribers Tab */}
        <TabsContent value="subscribers" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Subscriber Growth Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>نمو المشتركين</CardTitle>
                <CardDescription>عدد المشتركين الجدد عبر الزمن</CardDescription>
              </CardHeader>
              <CardContent>
                {subscribersLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={subscribersData?.subscriberGrowth || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Subscriber Stats */}
            <Card>
              <CardHeader>
                <CardTitle>توزيع المشتركين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>نشط</span>
                    </div>
                    <Badge variant="secondary">{subscribersData?.activeSubscribers || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span>منتهي</span>
                    </div>
                    <Badge variant="secondary">{subscribersData?.expiredSubscribers || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span>موقوف</span>
                    </div>
                    <Badge variant="secondary">{subscribersData?.suspendedSubscribers || 0}</Badge>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t">
                    <span className="font-medium">جدد هذه الفترة</span>
                    <Badge>{subscribersData?.newSubscribersThisPeriod || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscriber Summary */}
            <Card>
              <CardHeader>
                <CardTitle>ملخص المشتركين</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {subscribersData?.totalSubscribers || 0}
                  </div>
                  <p className="text-muted-foreground">إجمالي المشتركين</p>
                  <div className="mt-4 flex justify-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-500">
                        {subscribersData?.activeSubscribers || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">نشط</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-500">
                        {subscribersData?.newSubscribersThisPeriod || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">جديد</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Card Status Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>توزيع حالة الكروت</CardTitle>
              </CardHeader>
              <CardContent>
                {cardsLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={cardStatusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {cardStatusData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Best Selling Plans */}
            <Card>
              <CardHeader>
                <CardTitle>أكثر الباقات مبيعاً</CardTitle>
              </CardHeader>
              <CardContent>
                {cardsLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={cardsData?.bestSellingPlans || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="planName" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f59e0b" name="عدد الكروت" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Time Consumption Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>استهلاك الوقت لكل كرت</CardTitle>
                <CardDescription>أعلى 20 كرت من حيث استهلاك الوقت</CardDescription>
              </CardHeader>
              <CardContent>
                {cardsLoading ? (
                  <Skeleton className="h-[200px] w-full" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-right py-2 px-4">اسم المستخدم</th>
                          <th className="text-right py-2 px-4">الباقة</th>
                          <th className="text-right py-2 px-4">الوقت المستهلك</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cardsData?.timeConsumptionByCard.slice(0, 10).map((card) => (
                          <tr key={card.cardId} className="border-b">
                            <td className="py-2 px-4 font-mono">{card.username}</td>
                            <td className="py-2 px-4">{card.planName}</td>
                            <td className="py-2 px-4">
                              <Badge variant="outline">{formatDuration(card.totalTime)}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sessions Over Time */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>الجلسات عبر الزمن</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={sessionsData?.sessionsByDay || []}>
                      <defs>
                        <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#3b82f6" 
                        fillOpacity={1} 
                        fill="url(#colorSessions)" 
                        name="عدد الجلسات"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sessions by NAS */}
            <Card>
              <CardHeader>
                <CardTitle>الجلسات حسب جهاز NAS</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={sessionsData?.sessionsByNas || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="nasName" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" name="عدد الجلسات" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Session Stats */}
            <Card>
              <CardHeader>
                <CardTitle>إحصائيات الجلسات</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي الجلسات</span>
                  <span className="font-bold">{sessionsData?.totalSessions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">جلسات نشطة</span>
                  <Badge variant="default">{sessionsData?.activeSessions || 0}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">جلسات منتهية</span>
                  <span className="font-bold">{sessionsData?.completedSessions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">متوسط مدة الجلسة</span>
                  <Badge variant="outline">{formatDuration(sessionsData?.averageSessionDuration || 0)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي وقت الجلسات</span>
                  <Badge variant="secondary">{formatDuration(sessionsData?.totalSessionTime || 0)}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Usage Tab */}
        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Peak Hours Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  أوقات الذروة
                </CardTitle>
                <CardDescription>توزيع الجلسات حسب ساعات اليوم</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usageData?.peakHours || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="hour" 
                        tickFormatter={(h) => `${h}:00`}
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(h) => `الساعة ${h}:00`}
                        formatter={(value: number, name: string) => [
                          name === 'sessions' ? value : formatDuration(value),
                          name === 'sessions' ? 'عدد الجلسات' : 'إجمالي الوقت'
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="sessions" fill="#3b82f6" name="عدد الجلسات" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Daily Usage Chart */}
            <Card>
              <CardHeader>
                <CardTitle>الاستخدام اليومي</CardTitle>
                <CardDescription>عدد الجلسات والمستخدمين لكل يوم</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={usageData?.dailyUsage || []}>
                      <defs>
                        <linearGradient id="colorDailySessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="sessions" 
                        stroke="#10b981" 
                        fillOpacity={1} 
                        fill="url(#colorDailySessions)" 
                        name="الجلسات"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Weekly Summary */}
            <Card>
              <CardHeader>
                <CardTitle>الملخص الأسبوعي</CardTitle>
                <CardDescription>إحصائيات كل أسبوع</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto">
                    {usageData?.weeklySummary?.map((week, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-muted/50 border">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">الأسبوع {week.weekNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {week.startDate} - {week.endDate}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">الجلسات:</span>
                            <span className="font-bold mr-1">{week.sessions}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">المستخدمين:</span>
                            <span className="font-bold mr-1">{week.uniqueUsers}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">الوقت:</span>
                            <span className="font-bold mr-1">{formatDuration(week.totalTime)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!usageData?.weeklySummary || usageData.weeklySummary.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        لا توجد بيانات للفترة المحددة
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Users by Time */}
            <Card>
              <CardHeader>
                <CardTitle>أكثر المستخدمين استخداماً</CardTitle>
                <CardDescription>حسب إجمالي وقت الاتصال</CardDescription>
              </CardHeader>
              <CardContent>
                {usageLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={usageData?.topUsersByTime?.slice(0, 10) || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => formatDuration(v)} />
                      <YAxis dataKey="username" type="category" width={80} />
                      <Tooltip formatter={(value: number) => [formatDuration(value), 'الوقت']} />
                      <Bar dataKey="totalTime" fill="#8b5cf6" name="إجمالي الوقت" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Usage Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle>ملخص الاستخدام</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي الجلسات</span>
                  <span className="font-bold">{usageData?.summary?.totalSessions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">إجمالي الوقت</span>
                  <Badge variant="secondary">{formatDuration(usageData?.summary?.totalTime || 0)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">عدد المستخدمين</span>
                  <span className="font-bold">{usageData?.summary?.uniqueUsers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">متوسط مدة الجلسة</span>
                  <Badge variant="outline">{formatDuration(usageData?.summary?.avgSessionDuration || 0)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">ساعة الذروة</span>
                  <Badge variant="default">{usageData?.summary?.peakHour || 0}:00</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">يوم الذروة</span>
                  <Badge variant="default">{usageData?.summary?.peakDay || '-'}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
