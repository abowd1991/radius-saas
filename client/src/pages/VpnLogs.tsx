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
  LogIn,
  Play,
  Wifi,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { useLocation } from "wouter";

// Event type configurations for SoftEther logs
const eventTypeConfig: Record<string, { color: string; labelAr: string; labelEn: string; icon: any }> = {
  connecting: { color: "bg-yellow-500", labelAr: "جاري الاتصال", labelEn: "Connecting", icon: Loader2 },
  connected: { color: "bg-green-500", labelAr: "تم المصادقة", labelEn: "Authenticated", icon: CheckCircle2 },
  session_start: { color: "bg-blue-500", labelAr: "بدء الجلسة", labelEn: "Session Started", icon: Play },
  disconnected: { color: "bg-gray-500", labelAr: "انقطع", labelEn: "Disconnected", icon: XCircle },
  dhcp: { color: "bg-purple-500", labelAr: "DHCP", labelEn: "DHCP", icon: Wifi },
  info: { color: "bg-gray-400", labelAr: "معلومات", labelEn: "Info", icon: AlertCircle },
};

export default function VpnLogs() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "super_admin" && user.role !== "owner") {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  if (!user || (user.role !== "super_admin" && user.role !== "owner")) {
    return null;
  }

  // Fetch VPN logs from SoftEther
  const { data: logsData, isLoading, refetch, isRefetching } = trpc.vpn.logs.useQuery({
    eventType: selectedEventType !== "all" ? selectedEventType : undefined,
    limit: 100,
  });

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!logsData?.logs) return [];
    if (!searchQuery) return logsData.logs;
    
    const searchLower = searchQuery.toLowerCase();
    return logsData.logs.filter((log: any) => {
      return (
        log.username?.toLowerCase().includes(searchLower) ||
        log.message?.toLowerCase().includes(searchLower) ||
        log.ipAddress?.toLowerCase().includes(searchLower) ||
        log.sessionName?.toLowerCase().includes(searchLower)
      );
    });
  }, [logsData?.logs, searchQuery]);

  // Reset filters
  const resetFilters = () => {
    setSearchQuery("");
    setSelectedEventType("all");
  };

  // Get event type badge
  const getEventTypeBadge = (eventType: string) => {
    const config = eventTypeConfig[eventType] || eventTypeConfig.info;
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
    if (!filteredLogs?.length) {
      toast.error(language === "ar" ? "لا توجد سجلات للتصدير" : "No logs to export");
      return;
    }

    const headers = ["Date", "Time", "Event", "Username", "IP Address", "Session", "Message"];
    const rows = filteredLogs.map((log: any) => [
      log.date || "-",
      log.time || "-",
      log.eventType || "-",
      log.username || "-",
      log.ipAddress || "-",
      log.sessionName || "-",
      (log.message || "-").replace(/"/g, '""'),
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
              ? "سجل أحداث الاتصال والانقطاع من خادم SoftEther VPN"
              : "Connection events from SoftEther VPN Server"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"} ${isRefetching ? "animate-spin" : ""}`} />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "بحث" : "Search"}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={language === "ar" ? "بحث في السجلات..." : "Search logs..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Event Type */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "نوع الحدث" : "Event Type"}</Label>
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {language === "ar" ? "جميع الأحداث" : "All Events"}
                  </SelectItem>
                  <SelectItem value="connecting">
                    {language === "ar" ? "جاري الاتصال" : "Connecting"}
                  </SelectItem>
                  <SelectItem value="connected">
                    {language === "ar" ? "تم المصادقة" : "Authenticated"}
                  </SelectItem>
                  <SelectItem value="session_start">
                    {language === "ar" ? "بدء الجلسة" : "Session Started"}
                  </SelectItem>
                  <SelectItem value="disconnected">
                    {language === "ar" ? "انقطع" : "Disconnected"}
                  </SelectItem>
                  <SelectItem value="dhcp">DHCP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset */}
            <div className="flex items-end">
              <Button variant="outline" onClick={resetFilters} className="w-full">
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
            <Badge variant="secondary">{filteredLogs.length}</Badge>
          </CardTitle>
          <CardDescription>
            {language === "ar" 
              ? "أحدث 100 حدث اتصال من خادم VPN"
              : "Latest 100 connection events from VPN server"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{language === "ar" ? "لا توجد سجلات" : "No logs found"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                    <TableHead>{language === "ar" ? "الحدث" : "Event"}</TableHead>
                    <TableHead>{language === "ar" ? "المستخدم" : "Username"}</TableHead>
                    <TableHead>{language === "ar" ? "عنوان IP" : "IP Address"}</TableHead>
                    <TableHead>{language === "ar" ? "الجلسة" : "Session"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">
                        {log.date || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.time || "-"}
                      </TableCell>
                      <TableCell>
                        {getEventTypeBadge(log.eventType)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.username || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.sessionName || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
