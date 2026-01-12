import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  RefreshCw, 
  Server, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Activity,
  Clock,
  Wifi,
  WifiOff,
  Bell,
  BellOff,
  Settings,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { toast } from "sonner";

interface NasHealthStatus {
  id: number;
  shortname: string;
  nasname: string;
  description: string | null;
  connectionType: string | null;
  status: 'online' | 'offline' | 'warning' | 'unknown';
  lastSeen: Date | null;
  responseTime: number | null;
  activeSessions: number;
  uptime: string | null;
  cpuUsage: number | null;
  memoryUsage: number | null;
  lastChecked: Date;
}

export default function NasHealthMonitor() {
  const { user } = useAuth();
  const language = user?.language || "ar";
  const isRtl = language === "ar";

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Queries
  const { data: healthData, refetch: refetchHealth, isLoading } = trpc.nas.getHealthStatus.useQuery(undefined, {
    refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
  });

  const { data: nasDevices } = trpc.nas.list.useQuery();

  // Calculate stats
  const stats = {
    total: healthData?.devices?.length || 0,
    online: healthData?.devices?.filter((d: NasHealthStatus) => d.status === 'online').length || 0,
    offline: healthData?.devices?.filter((d: NasHealthStatus) => d.status === 'offline').length || 0,
    warning: healthData?.devices?.filter((d: NasHealthStatus) => d.status === 'warning').length || 0,
  };

  const handleRefresh = () => {
    refetchHealth();
    toast.success(language === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {language === "ar" ? "متصل" : "Online"}
          </Badge>
        );
      case 'offline':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            {language === "ar" ? "غير متصل" : "Offline"}
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {language === "ar" ? "تحذير" : "Warning"}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {language === "ar" ? "غير معروف" : "Unknown"}
          </Badge>
        );
    }
  };

  const formatLastSeen = (date: Date | null) => {
    if (!date) return language === "ar" ? "غير معروف" : "Unknown";
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return language === "ar" ? "الآن" : "Just now";
    if (minutes < 60) return language === "ar" ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    if (hours < 24) return language === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
    return language === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  };

  return (
    <DashboardLayout>
      <div className={`container mx-auto py-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="h-6 w-6" />
              {language === "ar" ? "مراقبة صحة NAS" : "NAS Health Monitor"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "ar" 
                ? "مراقبة حالة اتصال أجهزة NAS في الوقت الفعلي" 
                : "Real-time monitoring of NAS device connectivity"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 mr-4">
              <Switch 
                id="auto-refresh" 
                checked={autoRefresh} 
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh" className="text-sm">
                {language === "ar" ? "تحديث تلقائي" : "Auto Refresh"}
              </Label>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {language === "ar" ? "تحديث" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Alert for offline devices */}
        {stats.offline > 0 && (
          <div className="mb-6 p-4 rounded-lg border bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800 dark:text-red-200">
                {language === "ar" 
                  ? `تحذير: ${stats.offline} جهاز غير متصل!` 
                  : `Warning: ${stats.offline} device(s) offline!`}
              </span>
            </div>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {language === "ar" 
                ? "يرجى التحقق من اتصال الأجهزة غير المتصلة" 
                : "Please check the connectivity of offline devices"}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Server className="h-4 w-4" />
                {language === "ar" ? "إجمالي الأجهزة" : "Total Devices"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-500" />
                {language === "ar" ? "متصل" : "Online"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.online}</div>
              <Progress value={(stats.online / stats.total) * 100} className="mt-2 h-2" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-red-500" />
                {language === "ar" ? "غير متصل" : "Offline"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.offline}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                {language === "ar" ? "تحذير" : "Warning"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.warning}</div>
            </CardContent>
          </Card>
        </div>

        {/* Devices Table */}
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "حالة الأجهزة" : "Device Status"}</CardTitle>
            <CardDescription>
              {language === "ar" 
                ? `آخر تحديث: ${healthData?.lastChecked ? new Date(healthData.lastChecked).toLocaleTimeString() : '-'}` 
                : `Last updated: ${healthData?.lastChecked ? new Date(healthData.lastChecked).toLocaleTimeString() : '-'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
              </div>
            ) : healthData?.devices && healthData.devices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الجهاز" : "Device"}</TableHead>
                    <TableHead>{language === "ar" ? "العنوان" : "Address"}</TableHead>
                    <TableHead>{language === "ar" ? "نوع الاتصال" : "Connection"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "آخر ظهور" : "Last Seen"}</TableHead>
                    <TableHead>{language === "ar" ? "الجلسات النشطة" : "Active Sessions"}</TableHead>
                    <TableHead>{language === "ar" ? "وقت الاستجابة" : "Response Time"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthData.devices.map((device: NasHealthStatus) => (
                    <TableRow key={device.id} className={device.status === 'offline' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.shortname}</div>
                          {device.description && (
                            <div className="text-sm text-muted-foreground">{device.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{device.nasname}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {device.connectionType === 'vpn_sstp' ? 'SSTP VPN' 
                            : device.connectionType === 'vpn_l2tp' ? 'L2TP VPN' 
                            : device.connectionType === 'public_ip' ? 'Public IP'
                            : device.connectionType}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell>{formatLastSeen(device.lastSeen)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          {device.activeSessions}
                        </div>
                      </TableCell>
                      <TableCell>
                        {device.responseTime !== null ? (
                          <span className={device.responseTime > 500 ? 'text-yellow-600' : 'text-green-600'}>
                            {device.responseTime}ms
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد أجهزة" : "No devices found"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {language === "ar" ? "إعدادات المراقبة" : "Monitor Settings"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>{language === "ar" ? "فترة التحديث التلقائي" : "Auto Refresh Interval"}</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant={refreshInterval === 15 ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setRefreshInterval(15)}
                  >
                    15s
                  </Button>
                  <Button 
                    variant={refreshInterval === 30 ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setRefreshInterval(30)}
                  >
                    30s
                  </Button>
                  <Button 
                    variant={refreshInterval === 60 ? "default" : "outline"} 
                    size="sm"
                    onClick={() => setRefreshInterval(60)}
                  >
                    60s
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "إشعارات الانقطاع" : "Offline Notifications"}</Label>
                <div className="flex items-center gap-2">
                  <Switch 
                    id="notifications" 
                    checked={notificationsEnabled} 
                    onCheckedChange={setNotificationsEnabled}
                  />
                  <Label htmlFor="notifications" className="text-sm text-muted-foreground">
                    {notificationsEnabled 
                      ? (language === "ar" ? "مفعّل" : "Enabled")
                      : (language === "ar" ? "معطّل" : "Disabled")}
                  </Label>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>{language === "ar" ? "حد التحذير" : "Warning Threshold"}</Label>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" 
                    ? "تحذير عند وقت استجابة > 500ms" 
                    : "Warning when response time > 500ms"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
