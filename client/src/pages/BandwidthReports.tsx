import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Download, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  Users,
  Server,
  Calendar,
  HardDrive
} from "lucide-react";
import { toast } from "sonner";

interface UsageData {
  username: string;
  totalDownload: number;
  totalUpload: number;
  totalData: number;
  sessionCount: number;
  totalTime: number;
  lastActivity: Date | null;
}

interface NasUsageData {
  nasipaddress: string;
  nasShortname: string | null;
  totalDownload: number;
  totalUpload: number;
  totalData: number;
  userCount: number;
  sessionCount: number;
}

export default function BandwidthReports() {
  const { user } = useAuth();
  const language = user?.language || "ar";
  const isRtl = language === "ar";

  const [activeTab, setActiveTab] = useState("users");
  const [dateRange, setDateRange] = useState("today");
  const [sortBy, setSortBy] = useState("totalData");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Queries
  const { data: usageData, refetch: refetchUsage, isLoading } = trpc.reports.getBandwidthUsage.useQuery({
    dateRange,
    sortBy,
    sortOrder,
  });

  const { data: nasDevices } = trpc.nas.list.useQuery();

  const handleRefresh = () => {
    refetchUsage();
    toast.success(language === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  const handleExport = () => {
    if (!usageData) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    let csv = "";
    if (activeTab === "users") {
      csv = "Username,Download (MB),Upload (MB),Total (MB),Sessions,Total Time (hours)\n";
      usageData.userUsage?.forEach((u: UsageData) => {
        csv += `${u.username},${(u.totalDownload / 1024 / 1024).toFixed(2)},${(u.totalUpload / 1024 / 1024).toFixed(2)},${(u.totalData / 1024 / 1024).toFixed(2)},${u.sessionCount},${(u.totalTime / 3600).toFixed(2)}\n`;
      });
    } else {
      csv = "NAS IP,Name,Download (MB),Upload (MB),Total (MB),Users,Sessions\n";
      usageData.nasUsage?.forEach((n: NasUsageData) => {
        csv += `${n.nasipaddress},${n.nasShortname || '-'},${(n.totalDownload / 1024 / 1024).toFixed(2)},${(n.totalUpload / 1024 / 1024).toFixed(2)},${(n.totalData / 1024 / 1024).toFixed(2)},${n.userCount},${n.sessionCount}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `bandwidth-${activeTab}-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(language === "ar" ? "تم تصدير البيانات" : "Data exported");
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // Calculate top user percentage for progress bar
  const maxUserData = useMemo(() => {
    if (!usageData?.userUsage || usageData.userUsage.length === 0) return 1;
    return Math.max(...usageData.userUsage.map((u: UsageData) => u.totalData));
  }, [usageData?.userUsage]);

  const maxNasData = useMemo(() => {
    if (!usageData?.nasUsage || usageData.nasUsage.length === 0) return 1;
    return Math.max(...usageData.nasUsage.map((n: NasUsageData) => n.totalData));
  }, [usageData?.nasUsage]);

  return (
    <DashboardLayout>
      <div className={`container mx-auto py-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              {language === "ar" ? "تقارير استهلاك الباندويث" : "Bandwidth Usage Reports"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "ar" 
                ? "تحليل استهلاك البيانات لكل مستخدم وجهاز NAS" 
                : "Analyze data usage per user and NAS device"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {language === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              {language === "ar" ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-blue-500" />
                {language === "ar" ? "إجمالي التحميل" : "Total Download"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {formatBytes(usageData?.stats?.totalDownload || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {language === "ar" ? "إجمالي الرفع" : "Total Upload"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatBytes(usageData?.stats?.totalUpload || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-purple-500" />
                {language === "ar" ? "إجمالي البيانات" : "Total Data"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {formatBytes(usageData?.stats?.totalData || 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-orange-500" />
                {language === "ar" ? "المستخدمين النشطين" : "Active Users"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {usageData?.stats?.activeUsers || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "الفترة الزمنية" : "Date Range"}</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">{language === "ar" ? "اليوم" : "Today"}</SelectItem>
                    <SelectItem value="yesterday">{language === "ar" ? "أمس" : "Yesterday"}</SelectItem>
                    <SelectItem value="week">{language === "ar" ? "هذا الأسبوع" : "This Week"}</SelectItem>
                    <SelectItem value="month">{language === "ar" ? "هذا الشهر" : "This Month"}</SelectItem>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All Time"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "ترتيب حسب" : "Sort By"}</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalData">{language === "ar" ? "إجمالي البيانات" : "Total Data"}</SelectItem>
                    <SelectItem value="totalDownload">{language === "ar" ? "التحميل" : "Download"}</SelectItem>
                    <SelectItem value="totalUpload">{language === "ar" ? "الرفع" : "Upload"}</SelectItem>
                    <SelectItem value="sessionCount">{language === "ar" ? "عدد الجلسات" : "Sessions"}</SelectItem>
                    <SelectItem value="totalTime">{language === "ar" ? "الوقت" : "Time"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "الترتيب" : "Order"}</Label>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "asc" | "desc")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">{language === "ar" ? "تنازلي (الأكبر أولاً)" : "Descending"}</SelectItem>
                    <SelectItem value="asc">{language === "ar" ? "تصاعدي (الأصغر أولاً)" : "Ascending"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              {language === "ar" ? "حسب المستخدم" : "By User"}
              {usageData?.userUsage && (
                <Badge variant="secondary" className="ml-2">{usageData.userUsage.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nas">
              <Server className="h-4 w-4 mr-2" />
              {language === "ar" ? "حسب NAS" : "By NAS"}
              {usageData?.nasUsage && (
                <Badge variant="secondary" className="ml-2">{usageData.nasUsage.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "استهلاك المستخدمين" : "User Bandwidth Usage"}</CardTitle>
                <CardDescription>
                  {language === "ar" 
                    ? "تفاصيل استهلاك البيانات لكل مستخدم" 
                    : "Data usage details per user"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : usageData?.userUsage && usageData.userUsage.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>{language === "ar" ? "المستخدم" : "User"}</TableHead>
                        <TableHead>{language === "ar" ? "تحميل" : "Download"}</TableHead>
                        <TableHead>{language === "ar" ? "رفع" : "Upload"}</TableHead>
                        <TableHead>{language === "ar" ? "إجمالي" : "Total"}</TableHead>
                        <TableHead>{language === "ar" ? "الجلسات" : "Sessions"}</TableHead>
                        <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                        <TableHead className="w-[200px]">{language === "ar" ? "النسبة" : "Usage"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData.userUsage.map((user: UsageData, index: number) => (
                        <TableRow key={user.username}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell className="font-mono">{user.username}</TableCell>
                          <TableCell className="text-blue-600">{formatBytes(user.totalDownload)}</TableCell>
                          <TableCell className="text-green-600">{formatBytes(user.totalUpload)}</TableCell>
                          <TableCell className="font-medium">{formatBytes(user.totalData)}</TableCell>
                          <TableCell>{user.sessionCount}</TableCell>
                          <TableCell>{formatDuration(user.totalTime)}</TableCell>
                          <TableCell>
                            <Progress 
                              value={(user.totalData / maxUserData) * 100} 
                              className="h-2"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data found"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* NAS Tab */}
          <TabsContent value="nas">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "استهلاك أجهزة NAS" : "NAS Bandwidth Usage"}</CardTitle>
                <CardDescription>
                  {language === "ar" 
                    ? "تفاصيل استهلاك البيانات لكل جهاز NAS" 
                    : "Data usage details per NAS device"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : usageData?.nasUsage && usageData.nasUsage.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>{language === "ar" ? "الجهاز" : "Device"}</TableHead>
                        <TableHead>{language === "ar" ? "العنوان" : "IP Address"}</TableHead>
                        <TableHead>{language === "ar" ? "تحميل" : "Download"}</TableHead>
                        <TableHead>{language === "ar" ? "رفع" : "Upload"}</TableHead>
                        <TableHead>{language === "ar" ? "إجمالي" : "Total"}</TableHead>
                        <TableHead>{language === "ar" ? "المستخدمين" : "Users"}</TableHead>
                        <TableHead>{language === "ar" ? "الجلسات" : "Sessions"}</TableHead>
                        <TableHead className="w-[200px]">{language === "ar" ? "النسبة" : "Usage"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usageData.nasUsage.map((nas: NasUsageData, index: number) => (
                        <TableRow key={nas.nasipaddress}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{nas.nasShortname || "-"}</TableCell>
                          <TableCell className="font-mono text-sm">{nas.nasipaddress}</TableCell>
                          <TableCell className="text-blue-600">{formatBytes(nas.totalDownload)}</TableCell>
                          <TableCell className="text-green-600">{formatBytes(nas.totalUpload)}</TableCell>
                          <TableCell className="font-medium">{formatBytes(nas.totalData)}</TableCell>
                          <TableCell>{nas.userCount}</TableCell>
                          <TableCell>{nas.sessionCount}</TableCell>
                          <TableCell>
                            <Progress 
                              value={(nas.totalData / maxNasData) * 100} 
                              className="h-2"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data found"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
