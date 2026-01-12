import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  Download, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Activity,
  FileText,
  Filter,
  Calendar
} from "lucide-react";
import { toast } from "sonner";

export default function RadiusLogs() {
  const { user } = useAuth();
  const language = user?.language || "ar";
  const isRtl = language === "ar";

  const [activeTab, setActiveTab] = useState("auth");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [nasFilter, setNasFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today");
  const [page, setPage] = useState(1);
  const limit = 50;

  // Queries
  const { data: authLogs, refetch: refetchAuth, isLoading: isLoadingAuth } = trpc.logs.getAuthLogs.useQuery({
    page,
    limit,
    search: searchQuery || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    nasIp: nasFilter !== "all" ? nasFilter : undefined,
    dateRange: dateFilter,
  });

  const { data: acctLogs, refetch: refetchAcct, isLoading: isLoadingAcct } = trpc.logs.getAccountingLogs.useQuery({
    page,
    limit,
    search: searchQuery || undefined,
    nasIp: nasFilter !== "all" ? nasFilter : undefined,
    dateRange: dateFilter,
  });

  const { data: nasDevices } = trpc.nas.list.useQuery();

  const handleRefresh = () => {
    if (activeTab === "auth") {
      refetchAuth();
    } else {
      refetchAcct();
    }
    toast.success(language === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  const handleExport = () => {
    // Export to CSV
    const data = activeTab === "auth" ? authLogs?.logs : acctLogs?.logs;
    if (!data || data.length === 0) {
      toast.error(language === "ar" ? "لا توجد بيانات للتصدير" : "No data to export");
      return;
    }

    let csv = "";
    if (activeTab === "auth") {
      csv = "Username,Reply,NAS IP,Date\n";
      data.forEach((log: any) => {
        csv += `${log.username},${log.reply},${log.nasipaddress || "-"},${new Date(log.authdate).toLocaleString()}\n`;
      });
    } else {
      csv = "Username,NAS IP,Start Time,Stop Time,Session Time,Input (MB),Output (MB),Terminate Cause\n";
      data.forEach((log: any) => {
        const inputMB = log.acctinputoctets ? (log.acctinputoctets / 1024 / 1024).toFixed(2) : "0";
        const outputMB = log.acctoutputoctets ? (log.acctoutputoctets / 1024 / 1024).toFixed(2) : "0";
        csv += `${log.username},${log.nasipaddress},${log.acctstarttime || "-"},${log.acctstoptime || "-"},${log.acctsessiontime || 0},${inputMB},${outputMB},${log.acctterminatecause || "-"}\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `radius-${activeTab}-logs-${new Date().toISOString().split("T")[0]}.csv`;
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
    if (!seconds) return "0s";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const getReplyBadge = (reply: string) => {
    if (reply === "Access-Accept") {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />{language === "ar" ? "مقبول" : "Accept"}</Badge>;
    } else if (reply === "Access-Reject") {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><XCircle className="h-3 w-3 mr-1" />{language === "ar" ? "مرفوض" : "Reject"}</Badge>;
    }
    return <Badge variant="secondary">{reply}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className={`container mx-auto py-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              {language === "ar" ? "سجلات RADIUS" : "RADIUS Logs"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "ar" 
                ? "عرض سجلات المصادقة والمحاسبة من FreeRADIUS" 
                : "View authentication and accounting logs from FreeRADIUS"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
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
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                {language === "ar" ? "مصادقات ناجحة" : "Successful Auth"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {authLogs?.stats?.accepted || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                {language === "ar" ? "مصادقات مرفوضة" : "Rejected Auth"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {authLogs?.stats?.rejected || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                {language === "ar" ? "جلسات نشطة" : "Active Sessions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {acctLogs?.stats?.activeSessions || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                {language === "ar" ? "إجمالي الوقت" : "Total Time"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatDuration(acctLogs?.stats?.totalSessionTime || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {language === "ar" ? "تصفية النتائج" : "Filter Results"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "بحث" : "Search"}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder={language === "ar" ? "اسم المستخدم..." : "Username..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {activeTab === "auth" && (
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="Access-Accept">{language === "ar" ? "مقبول" : "Accepted"}</SelectItem>
                      <SelectItem value="Access-Reject">{language === "ar" ? "مرفوض" : "Rejected"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "جهاز NAS" : "NAS Device"}</Label>
                <Select value={nasFilter} onValueChange={setNasFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    {nasDevices?.map((nas: any) => (
                      <SelectItem key={nas.id} value={nas.nasname}>
                        {nas.shortname} ({nas.nasname})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "الفترة" : "Date Range"}</Label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
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
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="auth">
              {language === "ar" ? "سجلات المصادقة" : "Authentication Logs"}
              {authLogs?.total !== undefined && (
                <Badge variant="secondary" className="ml-2">{authLogs.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="accounting">
              {language === "ar" ? "سجلات المحاسبة" : "Accounting Logs"}
              {acctLogs?.total !== undefined && (
                <Badge variant="secondary" className="ml-2">{acctLogs.total}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Authentication Logs Tab */}
          <TabsContent value="auth">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "سجلات المصادقة (radpostauth)" : "Authentication Logs (radpostauth)"}</CardTitle>
                <CardDescription>
                  {language === "ar" 
                    ? "سجل جميع محاولات تسجيل الدخول (Access-Accept / Access-Reject)" 
                    : "Log of all login attempts (Access-Accept / Access-Reject)"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAuth ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : authLogs?.logs && authLogs.logs.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{language === "ar" ? "اسم المستخدم" : "Username"}</TableHead>
                          <TableHead>{language === "ar" ? "النتيجة" : "Result"}</TableHead>
                          <TableHead>{language === "ar" ? "عنوان NAS" : "NAS IP"}</TableHead>
                          <TableHead>{language === "ar" ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authLogs.logs.map((log: any, index: number) => (
                          <TableRow key={log.id || index}>
                            <TableCell className="font-mono">{log.username}</TableCell>
                            <TableCell>{getReplyBadge(log.reply)}</TableCell>
                            <TableCell className="font-mono text-sm">{log.nasipaddress || "-"}</TableCell>
                            <TableCell>
                              {new Date(log.authdate).toLocaleString(language === "ar" ? "ar-SA" : "en-US")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">
                        {language === "ar" 
                          ? `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, authLogs.total)} من ${authLogs.total}`
                          : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, authLogs.total)} of ${authLogs.total}`}
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          {language === "ar" ? "السابق" : "Previous"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPage(p => p + 1)}
                          disabled={page * limit >= authLogs.total}
                        >
                          {language === "ar" ? "التالي" : "Next"}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد سجلات" : "No logs found"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounting Logs Tab */}
          <TabsContent value="accounting">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "سجلات المحاسبة (radacct)" : "Accounting Logs (radacct)"}</CardTitle>
                <CardDescription>
                  {language === "ar" 
                    ? "سجل الجلسات مع تفاصيل الاستهلاك والوقت" 
                    : "Session logs with usage and time details"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAcct ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : acctLogs?.logs && acctLogs.logs.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{language === "ar" ? "اسم المستخدم" : "Username"}</TableHead>
                            <TableHead>{language === "ar" ? "NAS IP" : "NAS IP"}</TableHead>
                            <TableHead>{language === "ar" ? "بداية الجلسة" : "Start Time"}</TableHead>
                            <TableHead>{language === "ar" ? "نهاية الجلسة" : "Stop Time"}</TableHead>
                            <TableHead>{language === "ar" ? "المدة" : "Duration"}</TableHead>
                            <TableHead>{language === "ar" ? "تحميل" : "Download"}</TableHead>
                            <TableHead>{language === "ar" ? "رفع" : "Upload"}</TableHead>
                            <TableHead>{language === "ar" ? "سبب الإنهاء" : "Terminate Cause"}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {acctLogs.logs.map((log: any) => (
                            <TableRow key={log.radacctid}>
                              <TableCell className="font-mono">{log.username}</TableCell>
                              <TableCell className="font-mono text-sm">{log.nasipaddress}</TableCell>
                              <TableCell>
                                {log.acctstarttime 
                                  ? new Date(log.acctstarttime).toLocaleString(language === "ar" ? "ar-SA" : "en-US")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {log.acctstoptime 
                                  ? new Date(log.acctstoptime).toLocaleString(language === "ar" ? "ar-SA" : "en-US")
                                  : <Badge variant="outline" className="text-green-600">{language === "ar" ? "نشط" : "Active"}</Badge>}
                              </TableCell>
                              <TableCell>{formatDuration(log.acctsessiontime)}</TableCell>
                              <TableCell>{formatBytes(log.acctinputoctets)}</TableCell>
                              <TableCell>{formatBytes(log.acctoutputoctets)}</TableCell>
                              <TableCell>
                                {log.acctterminatecause ? (
                                  <Badge variant="secondary">{log.acctterminatecause}</Badge>
                                ) : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">
                        {language === "ar" 
                          ? `عرض ${(page - 1) * limit + 1} - ${Math.min(page * limit, acctLogs.total)} من ${acctLogs.total}`
                          : `Showing ${(page - 1) * limit + 1} - ${Math.min(page * limit, acctLogs.total)} of ${acctLogs.total}`}
                      </span>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          {language === "ar" ? "السابق" : "Previous"}
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setPage(p => p + 1)}
                          disabled={page * limit >= acctLogs.total}
                        >
                          {language === "ar" ? "التالي" : "Next"}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد سجلات" : "No logs found"}
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
