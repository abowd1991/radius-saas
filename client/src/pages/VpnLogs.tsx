import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  History,
  Router,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

// Event type configurations
const eventTypeConfig: Record<string, { color: string; labelAr: string; labelEn: string; icon: any }> = {
  connected: { color: "bg-green-500", labelAr: "متصل", labelEn: "Connected", icon: CheckCircle2 },
  disconnected: { color: "bg-gray-500", labelAr: "انقطع", labelEn: "Disconnected", icon: XCircle },
  connection_failed: { color: "bg-red-500", labelAr: "فشل الاتصال", labelEn: "Connection Failed", icon: AlertCircle },
  reconnecting: { color: "bg-yellow-500", labelAr: "إعادة الاتصال", labelEn: "Reconnecting", icon: RefreshCw },
  auth_failed: { color: "bg-red-600", labelAr: "فشل المصادقة", labelEn: "Auth Failed", icon: AlertCircle },
  timeout: { color: "bg-orange-500", labelAr: "انتهاء المهلة", labelEn: "Timeout", icon: AlertCircle },
  manual_disconnect: { color: "bg-blue-500", labelAr: "فصل يدوي", labelEn: "Manual Disconnect", icon: XCircle },
  manual_restart: { color: "bg-blue-600", labelAr: "إعادة تشغيل يدوي", labelEn: "Manual Restart", icon: RefreshCw },
  error: { color: "bg-red-500", labelAr: "خطأ", labelEn: "Error", icon: AlertCircle },
  radius_error: { color: "bg-purple-500", labelAr: "خطأ RADIUS", labelEn: "RADIUS Error", icon: AlertCircle },
};

export default function VpnLogs() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNasId, setSelectedNasId] = useState<string>("all");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch NAS devices for filter
  const { data: nasData } = trpc.nas.list.useQuery();

  // Fetch VPN logs
  const { data: logsData, isLoading, refetch } = trpc.vpn.logs.useQuery({
    nasId: selectedNasId !== "all" ? parseInt(selectedNasId) : undefined,
    eventType: selectedEventType !== "all" ? selectedEventType : undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!logsData?.logs) return [];
    if (!searchQuery) return logsData.logs;
    
    const searchLower = searchQuery.toLowerCase();
    return logsData.logs.filter((log: any) => {
      return (
        log.nas?.shortname?.toLowerCase().includes(searchLower) ||
        log.log?.message?.toLowerCase().includes(searchLower) ||
        log.log?.errorMessage?.toLowerCase().includes(searchLower) ||
        log.log?.localIp?.toLowerCase().includes(searchLower)
      );
    });
  }, [logsData?.logs, searchQuery]);

  // Total pages
  const totalPages = Math.ceil((logsData?.total || 0) / pageSize);

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      return format(d, "yyyy-MM-dd HH:mm:ss");
    } catch {
      return "-";
    }
  };

  // Format relative date
  const formatRelativeDate = (date: Date | string | null) => {
    if (!date) return "-";
    try {
      return formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: language === "ar" ? ar : enUS,
      });
    } catch {
      return "-";
    }
  };

  // Get event type badge
  const getEventTypeBadge = (eventType: string) => {
    const config = eventTypeConfig[eventType] || eventTypeConfig.error;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} text-white border-0`}>
        <Icon className={`w-3 h-3 ${direction === "rtl" ? "ml-1" : "mr-1"}`} />
        {language === "ar" ? config.labelAr : config.labelEn}
      </Badge>
    );
  };

  // Export logs to CSV
  const exportToCSV = () => {
    if (!logsData?.logs?.length) {
      toast.error(language === "ar" ? "لا توجد سجلات للتصدير" : "No logs to export");
      return;
    }

    const headers = ["Time", "Device", "Event", "Message", "IP", "Error"];
    const rows = logsData.logs.map((log: any) => [
      formatDate(log.log?.createdAt),
      log.nas?.shortname || "-",
      log.log?.eventType || "-",
      log.log?.message || "-",
      log.log?.localIp || "-",
      log.log?.errorMessage || "-",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row: string[]) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `vpn-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast.success(language === "ar" ? "تم تصدير السجلات" : "Logs exported");
  };

  return (
    <div className="space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "سجلات VPN" : "VPN Logs"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "سجل أحداث الاتصال والانقطاع لجميع أجهزة VPN"
              : "Connection and disconnection event log for all VPN devices"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تصدير CSV" : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            {language === "ar" ? "تصفية" : "Filters"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "بحث" : "Search"}</Label>
              <div className="relative">
                <Search className={`absolute ${direction === "rtl" ? "right-3" : "left-3"} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
                <Input
                  placeholder={language === "ar" ? "بحث في السجلات..." : "Search logs..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={direction === "rtl" ? "pr-10" : "pl-10"}
                />
              </div>
            </div>

            {/* NAS Filter */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "الجهاز" : "Device"}</Label>
              <Select value={selectedNasId} onValueChange={setSelectedNasId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "جميع الأجهزة" : "All Devices"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الأجهزة" : "All Devices"}
                  </SelectItem>
                  {nasData?.filter((nas: any) => nas.connectionType !== "public_ip").map((nas: any) => (
                    <SelectItem key={nas.id} value={nas.id.toString()}>
                      {nas.shortname || nas.nasname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Event Type Filter */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع الحدث" : "Event Type"}</Label>
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "جميع الأحداث" : "All Events"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الأحداث" : "All Events"}
                  </SelectItem>
                  {Object.entries(eventTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {language === "ar" ? config.labelAr : config.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters */}
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedNasId("all");
                  setSelectedEventType("all");
                  setPage(1);
                }}
              >
                {language === "ar" ? "إعادة تعيين" : "Reset"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            {language === "ar" ? "السجلات" : "Logs"}
            <Badge variant="secondary">{logsData?.total || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا توجد سجلات" : "No logs found"}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                    <TableHead>{language === "ar" ? "الجهاز" : "Device"}</TableHead>
                    <TableHead>{language === "ar" ? "الحدث" : "Event"}</TableHead>
                    <TableHead>{language === "ar" ? "الرسالة" : "Message"}</TableHead>
                    <TableHead>{language === "ar" ? "IP" : "IP"}</TableHead>
                    <TableHead>{language === "ar" ? "الخطأ" : "Error"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: any) => (
                    <TableRow key={log.log?.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm">{formatDate(log.log?.createdAt)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeDate(log.log?.createdAt)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Router className="w-4 h-4 text-muted-foreground" />
                          <span>{log.nas?.shortname || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getEventTypeBadge(log.log?.eventType || "error")}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.log?.message || "-"}
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{log.log?.localIp || "-"}</code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-red-500">
                        {log.log?.errorMessage || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    {language === "ar"
                      ? `صفحة ${page} من ${totalPages}`
                      : `Page ${page} of ${totalPages}`}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
