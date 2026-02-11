import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  MoreHorizontal,
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Power,
  PowerOff,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Globe,
  Shield,
  Link2,
  Router,
  History,
  Loader2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ar, enUS } from "date-fns/locale";

// Connection type icons
const connectionTypeIcons: Record<string, any> = {
  public_ip: Globe,
  vpn_l2tp: Shield,
  vpn_sstp: Link2,
};

// Status colors and labels
const statusConfig: Record<string, { color: string; labelAr: string; labelEn: string; icon: any }> = {
  connected: { color: "bg-green-500", labelAr: "متصل", labelEn: "Connected", icon: CheckCircle2 },
  disconnected: { color: "bg-gray-500", labelAr: "غير متصل", labelEn: "Disconnected", icon: XCircle },
  connecting: { color: "bg-yellow-500", labelAr: "جاري الاتصال", labelEn: "Connecting", icon: Loader2 },
  error: { color: "bg-red-500", labelAr: "خطأ", labelEn: "Error", icon: AlertCircle },
};

// IP Pool Management Component (Admin Only)
function IpPoolManagement() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [isExpanding, setIsExpanding] = useState(false);
  const [startIp, setStartIp] = useState('');
  const [endIp, setEndIp] = useState('');
  
  const { data: ranges, isLoading, refetch } = trpc.nas.getIpPoolRanges.useQuery(undefined, {
    enabled: user?.role === 'owner' || user?.role === 'super_admin',
  });
  
  const expandMutation = trpc.nas.expandIpPool.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم توسيع مجموعة IP بنجاح" : "IP Pool expanded successfully");
      setIsExpanding(false);
      setStartIp('');
      setEndIp('');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Only show for owner/super_admin
  if (!user || (user.role !== 'owner' && user.role !== 'super_admin')) {
    return null;
  }

  const handleExpand = () => {
    if (!startIp || !endIp) {
      toast.error(language === "ar" ? "يرجى إدخال IP البداية والنهاية" : "Please enter Start and End IP");
      return;
    }
    expandMutation.mutate({ startIp, endIp });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {language === "ar" ? "إدارة مجموعة IP" : "IP Pool Management"}
            </CardTitle>
            <CardDescription>
              {language === "ar" 
                ? "إدارة نطاقات IP المتاحة للشبكات" 
                : "Manage available IP ranges for networks"
              }
            </CardDescription>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsExpanding(!isExpanding)}
          >
            {isExpanding 
              ? (language === "ar" ? "إلغاء" : "Cancel")
              : (language === "ar" ? "توسيع المجموعة" : "Expand Pool")
            }
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isExpanding && (
          <div className="mb-6 p-4 border rounded-lg bg-muted/50">
            <h4 className="font-medium mb-3">
              {language === "ar" ? "إضافة نطاق IP جديد" : "Add New IP Range"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {language === "ar" ? "IP البداية" : "Start IP"}
                </label>
                <Input
                  placeholder="192.168.30.201"
                  value={startIp}
                  onChange={(e) => setStartIp(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  {language === "ar" ? "IP النهاية" : "End IP"}
                </label>
                <Input
                  placeholder="192.168.30.254"
                  value={endIp}
                  onChange={(e) => setEndIp(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleExpand}
              disabled={expandMutation.isPending}
            >
              {expandMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                language === "ar" ? "إضافة النطاق" : "Add Range"
              )}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !ranges || ranges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "ar" ? "لا توجد نطاقات IP" : "No IP ranges found"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "النطاق" : "Range"}</TableHead>
                  <TableHead>{language === "ar" ? "الشبكة الفرعية" : "Subnet"}</TableHead>
                  <TableHead>{language === "ar" ? "إجمالي IPs" : "Total IPs"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "تاريخ الإنشاء" : "Created At"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranges.map((range: any) => (
                  <TableRow key={range.id}>
                    <TableCell className="font-mono text-sm">
                      {range.startIp} - {range.endIp}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{range.subnet}.0/24</TableCell>
                    <TableCell className="font-medium">{range.totalIps}</TableCell>
                    <TableCell>
                      <Badge variant={range.isActive ? 'default' : 'secondary'}>
                        {range.isActive 
                          ? (language === "ar" ? "نشط" : "Active")
                          : (language === "ar" ? "غير نشط" : "Inactive")
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(range.createdAt).toLocaleDateString(language === "ar" ? "ar" : "en")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// DHCP Leases Table Component (Admin Only)
function DhcpLeasesTable() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { data: leases, isLoading, refetch } = trpc.nas.listDhcpLeases.useQuery(undefined, {
    enabled: user?.role === 'owner' || user?.role === 'super_admin',
  });

  // Only show for owner/super_admin
  if (!user || (user.role !== 'owner' && user.role !== 'super_admin')) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Router className="h-5 w-5" />
              {language === "ar" ? "حجوزات DHCP الثابتة" : "Static DHCP Leases"}
            </CardTitle>
            <CardDescription>
              {language === "ar" 
                ? "جميع حجوزات DHCP الثابتة المُدارة بواسطة النظام" 
                : "All static DHCP leases managed by the system"
              }
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !leases || leases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {language === "ar" ? "لا توجد حجوزات DHCP" : "No DHCP leases found"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "عنوان MAC" : "MAC Address"}</TableHead>
                  <TableHead>{language === "ar" ? "عنوان IP" : "IP Address"}</TableHead>
                  <TableHead>{language === "ar" ? "اسم المضيف" : "Hostname"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leases.map((lease: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{lease.mac}</TableCell>
                    <TableCell className="font-mono text-sm">{lease.ip}</TableCell>
                    <TableCell className="font-medium">{lease.hostname || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={lease.status === 'active' ? 'default' : 'secondary'}>
                        {lease.status === 'active' 
                          ? (language === "ar" ? "نشط" : "Active")
                          : (language === "ar" ? "غير نشط" : "Inactive")
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// IP Pool Stats Component (Admin Only)
function IPPoolStats() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { data: poolStats, isLoading } = trpc.nas.getPoolStats.useQuery();

  // Only show for owner/super_admin
  if (!user || (user.role !== 'owner' && user.role !== 'super_admin')) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {language === "ar" ? "إحصائيات مجموعة IP" : "IP Pool Statistics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!poolStats) return null;

  return (
    <Card className="border-blue-500/30 bg-blue-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-blue-600" />
          {language === "ar" ? "إحصائيات مجموعة IP" : "IP Pool Statistics"}
        </CardTitle>
        <CardDescription>
          {language === "ar" 
            ? "مجموعة IP المتاحة للشبكات VPN (192.168.30.10-200)" 
            : "Available IP pool for VPN networks (192.168.30.10-200)"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 rounded-lg bg-background">
            <div className="text-2xl font-bold text-blue-600">{poolStats.total}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "إجمالي IP" : "Total IPs"}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-background">
            <div className="text-2xl font-bold text-green-600">{poolStats.allocated}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "مخصص" : "Allocated"}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-background">
            <div className="text-2xl font-bold text-orange-600">{poolStats.available}</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "متاح" : "Available"}
            </div>
          </div>
          <div className="text-center p-3 rounded-lg bg-background">
            <div className="text-2xl font-bold text-purple-600">{poolStats.utilizationPercent}%</div>
            <div className="text-xs text-muted-foreground">
              {language === "ar" ? "الاستخدام" : "Utilization"}
            </div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{language === "ar" ? "الاستخدام" : "Usage"}</span>
            <span className="font-medium">{poolStats.allocated} / {poolStats.total}</span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                poolStats.utilizationPercent >= 90 ? 'bg-red-500' :
                poolStats.utilizationPercent >= 70 ? 'bg-orange-500' :
                'bg-green-500'
              }`}
              style={{ width: `${poolStats.utilizationPercent}%` }}
            />
          </div>
          {poolStats.utilizationPercent >= 90 && (
            <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                {language === "ar" 
                  ? "تحذير: مجموعة IP شبه ممتلئة!" 
                  : "Warning: IP pool almost full!"
                }
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VpnConnections() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("connections");
  const [selectedNasId, setSelectedNasId] = useState<number | null>(null);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);

  // Fetch VPN connections
  const { data: vpnData, isLoading, refetch } = trpc.vpn.list.useQuery();
  
  // Fetch VPN logs for selected NAS
  const { data: logsData, isLoading: logsLoading } = trpc.vpn.logs.useQuery(
    { nasId: selectedNasId || undefined, limit: 50 },
    { enabled: !!selectedNasId }
  );

  // Mutations
  const restartMutation = trpc.vpn.restart.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ar" ? "تم إعادة تشغيل VPN" : "VPN restarted");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disconnectMutation = trpc.vpn.disconnect.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم قطع الاتصال" : "VPN disconnected");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const connectMutation = trpc.vpn.connect.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "جاري الاتصال..." : "Connecting...");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const syncMutation = trpc.vpn.syncAll.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الحالات" : "Status synced");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Filter connections based on search
  const filteredConnections = useMemo(() => {
    if (!vpnData?.connections) return [];
    return vpnData.connections.filter((conn: any) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        conn.nas?.shortname?.toLowerCase().includes(searchLower) ||
        conn.nas?.nasname?.toLowerCase().includes(searchLower) ||
        conn.vpn?.localVpnIp?.toLowerCase().includes(searchLower)
      );
    });
  }, [vpnData?.connections, searchQuery]);

  // Stats
  const stats = vpnData?.stats || { total: 0, connected: 0, disconnected: 0, connecting: 0, error: 0 };

  // Format date
  const formatDate = (date: Date | string | null) => {
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

  // Get status badge
  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.disconnected;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} text-white border-0`}>
        <Icon className={`w-3 h-3 ${direction === "rtl" ? "ml-1" : "mr-1"} ${status === "connecting" ? "animate-spin" : ""}`} />
        {language === "ar" ? config.labelAr : config.labelEn}
      </Badge>
    );
  };

  // Get connection type badge
  const getConnectionTypeBadge = (type: string) => {
    const Icon = connectionTypeIcons[type] || Globe;
    const labels: Record<string, { ar: string; en: string }> = {
      public_ip: { ar: "IP عام", en: "Public IP" },
      vpn_l2tp: { ar: "L2TP", en: "L2TP" },
      vpn_sstp: { ar: "SSTP", en: "SSTP" },
    };
    const label = labels[type] || labels.public_ip;
    return (
      <Badge variant="secondary">
        <Icon className={`w-3 h-3 ${direction === "rtl" ? "ml-1" : "mr-1"}`} />
        {language === "ar" ? label.ar : label.en}
      </Badge>
    );
  };

  // Open logs dialog
  const openLogsDialog = (nasId: number) => {
    setSelectedNasId(nasId);
    setIsLogsDialogOpen(true);
  };

  return (
    <div className="space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "اتصالات VPN" : "VPN Connections"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "مراقبة والتحكم في اتصالات VPN لأجهزة الشبكة"
              : "Monitor and control VPN connections for network devices"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"} ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {language === "ar" ? "تحديث الحالات" : "Sync Status"}
          </Button>
        </div>
      </div>

      {/* IP Pool Statistics (Admin Only) */}
      <IPPoolStats />

      {/* DHCP Static Leases (Admin Only) */}
      <DhcpLeasesTable />

      {/* IP Pool Management (Admin Only) */}
      <IpPoolManagement />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي الاتصالات" : "Total Connections"}
                </p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Router className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "متصل" : "Connected"}
                </p>
                <p className="text-2xl font-bold text-green-500">{stats.connected}</p>
              </div>
              <Wifi className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "غير متصل" : "Disconnected"}
                </p>
                <p className="text-2xl font-bold text-gray-500">{stats.disconnected}</p>
              </div>
              <WifiOff className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "خطأ" : "Error"}
                </p>
                <p className="text-2xl font-bold text-red-500">{stats.error}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className={`absolute ${direction === "rtl" ? "right-3" : "left-3"} top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4`} />
          <Input
            placeholder={language === "ar" ? "بحث..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={direction === "rtl" ? "pr-10" : "pl-10"}
          />
        </div>
      </div>

      {/* Connections Table */}
      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة الاتصالات" : "Connections List"}</CardTitle>
          <CardDescription>
            {language === "ar"
              ? "جميع أجهزة NAS المتصلة عبر VPN"
              : "All NAS devices connected via VPN"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConnections.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar"
                ? "لا توجد اتصالات VPN. أضف جهاز NAS بنوع اتصال VPN أولاً."
                : "No VPN connections. Add a NAS device with VPN connection type first."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الجهاز" : "Device"}</TableHead>
                  <TableHead>{language === "ar" ? "نوع الاتصال" : "Connection Type"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "IP المحلي" : "Local IP"}</TableHead>
                  <TableHead>{language === "ar" ? "آخر اتصال" : "Last Connected"}</TableHead>
                  <TableHead>{language === "ar" ? "عدد الانقطاعات" : "Disconnects"}</TableHead>
                  <TableHead className="text-center">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConnections.map((conn: any) => (
                  <TableRow key={conn.vpn?.id || conn.nas?.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Router className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{conn.nas?.shortname || "-"}</p>
                          <p className="text-xs text-muted-foreground">{conn.nas?.nasname}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getConnectionTypeBadge(conn.nas?.connectionType || conn.vpn?.connectionType)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(conn.vpn?.status || "disconnected")}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm">{conn.vpn?.localVpnIp || "-"}</code>
                    </TableCell>
                    <TableCell>
                      {formatDate(conn.vpn?.lastConnectedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{conn.vpn?.disconnectCount || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={direction === "rtl" ? "start" : "end"}>
                          {conn.vpn?.status === "connected" ? (
                            <DropdownMenuItem
                              onClick={() => disconnectMutation.mutate({ nasId: conn.nas?.id })}
                              disabled={disconnectMutation.isPending}
                            >
                              <PowerOff className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "قطع الاتصال" : "Disconnect"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => connectMutation.mutate({ nasId: conn.nas?.id })}
                              disabled={connectMutation.isPending}
                            >
                              <Power className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "اتصال" : "Connect"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => restartMutation.mutate({ nasId: conn.nas?.id })}
                            disabled={restartMutation.isPending}
                          >
                            <RefreshCw className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "إعادة تشغيل" : "Restart"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openLogsDialog(conn.nas?.id)}>
                            <History className={`w-4 h-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "السجلات" : "View Logs"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "سجلات VPN" : "VPN Logs"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "سجل أحداث الاتصال والانقطاع"
                : "Connection and disconnection event log"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : !logsData?.logs?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "لا توجد سجلات" : "No logs found"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                    <TableHead>{language === "ar" ? "الحدث" : "Event"}</TableHead>
                    <TableHead>{language === "ar" ? "الرسالة" : "Message"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsData.logs.map((log: any) => (
                    <TableRow key={log.log?.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(log.log?.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.log?.eventType === "connected"
                              ? "default"
                              : log.log?.eventType === "error"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {log.log?.eventType}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.log?.message || log.log?.errorMessage || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogsDialogOpen(false)}>
              {language === "ar" ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
