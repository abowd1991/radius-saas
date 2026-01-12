import { useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Network, Server, Settings, Trash2, RefreshCw, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function IpPoolManagement() {
  const { user } = useAuth();
  const language = user?.language || "ar";
  const isRtl = language === "ar";

  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  
  // Form states for creating/editing pool
  const [poolName, setPoolName] = useState("Default VPN Pool");
  const [startIp, setStartIp] = useState("192.168.30.10");
  const [endIp, setEndIp] = useState("192.168.30.250");
  const [gateway, setGateway] = useState("192.168.30.1");
  const [subnet, setSubnet] = useState("255.255.255.0");

  // Queries
  const { data: poolStats, refetch: refetchStats, isLoading: isLoadingStats } = trpc.nas.getVpnIpPoolStats.useQuery();
  const { data: allocatedData, refetch: refetchAllocated, isLoading: isLoadingAllocated } = trpc.nas.getAllAllocatedVpnIps.useQuery();
  const { data: availableData, refetch: refetchAvailable, isLoading: isLoadingAvailable } = trpc.nas.getAvailableVpnIps.useQuery();

  // Mutations
  const createPool = trpc.nas.createVpnIpPool.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إنشاء الـ Pool بنجاح" : "Pool created successfully");
      setShowCreateDialog(false);
      refetchStats();
      refetchAllocated();
      refetchAvailable();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePool = trpc.nas.updateVpnIpPool.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الإعدادات" : "Settings updated");
      setShowEditDialog(false);
      refetchStats();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const releaseIp = trpc.nas.releaseVpnIp.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحرير الـ IP" : "IP released");
      refetchStats();
      refetchAllocated();
      refetchAvailable();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleRefresh = () => {
    refetchStats();
    refetchAllocated();
    refetchAvailable();
    toast.success(language === "ar" ? "تم تحديث البيانات" : "Data refreshed");
  };

  const handleCreatePool = () => {
    createPool.mutate({
      name: poolName,
      startIp,
      endIp,
      gateway,
      subnet,
    });
  };

  const handleUpdatePool = () => {
    if (!poolStats?.pool?.id) return;
    updatePool.mutate({
      poolId: poolStats.pool.id,
      name: poolName,
      startIp,
      endIp,
      gateway,
      subnet,
    });
  };

  const openEditDialog = () => {
    if (poolStats?.pool) {
      setPoolName(poolStats.pool.name);
      setStartIp(poolStats.pool.startIp);
      setEndIp(poolStats.pool.endIp);
      setGateway(poolStats.pool.gateway);
      setSubnet(poolStats.pool.subnet);
    }
    setShowEditDialog(true);
  };

  // Calculate usage percentage
  const usagePercentage = poolStats?.hasPool && poolStats.allocatedCount !== undefined && poolStats.totalIps !== undefined
    ? Math.round((poolStats.allocatedCount / poolStats.totalIps) * 100) 
    : 0;
  
  const isPoolNearlyExhausted = usagePercentage >= 80;
  const isPoolCritical = usagePercentage >= 95;

  return (
    <DashboardLayout>
      <div className={`container mx-auto py-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6" />
              {language === "ar" ? "إدارة IP Pool" : "IP Pool Management"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {language === "ar" 
                ? "إدارة عناوين VPN IP المخصصة لأجهزة NAS" 
                : "Manage VPN IP addresses allocated to NAS devices"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === "ar" ? "تحديث" : "Refresh"}
            </Button>
            {!poolStats?.hasPool && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "ar" ? "إنشاء Pool" : "Create Pool"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === "ar" ? "إنشاء IP Pool جديد" : "Create New IP Pool"}</DialogTitle>
                    <DialogDescription>
                      {language === "ar" 
                        ? "حدد نطاق عناوين IP للـ VPN" 
                        : "Define the IP address range for VPN"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "اسم الـ Pool" : "Pool Name"}</Label>
                      <Input value={poolName} onChange={(e) => setPoolName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "بداية النطاق" : "Start IP"}</Label>
                        <Input value={startIp} onChange={(e) => setStartIp(e.target.value)} placeholder="192.168.30.10" />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "نهاية النطاق" : "End IP"}</Label>
                        <Input value={endIp} onChange={(e) => setEndIp(e.target.value)} placeholder="192.168.30.250" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "البوابة (Gateway)" : "Gateway"}</Label>
                        <Input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="192.168.30.1" />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "قناع الشبكة" : "Subnet Mask"}</Label>
                        <Input value={subnet} onChange={(e) => setSubnet(e.target.value)} placeholder="255.255.255.0" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button onClick={handleCreatePool} disabled={createPool.isPending}>
                      {createPool.isPending 
                        ? (language === "ar" ? "جارٍ الإنشاء..." : "Creating...") 
                        : (language === "ar" ? "إنشاء" : "Create")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Alert for nearly exhausted pool */}
        {poolStats?.hasPool && isPoolNearlyExhausted && (
          <div className={`mb-6 p-4 rounded-lg border ${isPoolCritical ? 'bg-red-50 border-red-200 dark:bg-red-950/20' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20'}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${isPoolCritical ? 'text-red-600' : 'text-yellow-600'}`} />
              <span className={`font-medium ${isPoolCritical ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                {isPoolCritical 
                  ? (language === "ar" ? "تحذير: الـ Pool شبه ممتلئ!" : "Warning: Pool is almost full!")
                  : (language === "ar" ? "تنبيه: الـ Pool يقترب من الامتلاء" : "Notice: Pool is getting full")}
              </span>
            </div>
            <p className={`mt-1 text-sm ${isPoolCritical ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {language === "ar" 
                ? `تم استخدام ${usagePercentage}% من عناوين IP المتاحة (${poolStats.allocatedCount} من ${poolStats.totalIps})`
                : `${usagePercentage}% of available IPs are used (${poolStats.allocatedCount} of ${poolStats.totalIps})`}
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "ar" ? "إجمالي العناوين" : "Total IPs"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoadingStats ? "..." : (poolStats?.hasPool ? poolStats.totalIps : 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "ar" ? "مخصصة" : "Allocated"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {isLoadingStats ? "..." : (poolStats?.hasPool ? poolStats.allocatedCount : 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "ar" ? "متاحة" : "Available"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {isLoadingStats ? "..." : (poolStats?.hasPool ? poolStats.availableCount : 0)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {language === "ar" ? "نسبة الاستخدام" : "Usage"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isPoolCritical ? 'text-red-600' : isPoolNearlyExhausted ? 'text-yellow-600' : 'text-blue-600'}`}>
                {isLoadingStats ? "..." : `${usagePercentage}%`}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${isPoolCritical ? 'bg-red-600' : isPoolNearlyExhausted ? 'bg-yellow-500' : 'bg-blue-600'}`}
                  style={{ width: `${usagePercentage}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pool Info Card */}
        {poolStats?.hasPool && poolStats.pool && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {poolStats.pool.name}
                  </CardTitle>
                  <CardDescription>
                    {language === "ar" ? "إعدادات الـ Pool الحالي" : "Current Pool Configuration"}
                  </CardDescription>
                </div>
                <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" onClick={openEditDialog}>
                      <Settings className="h-4 w-4 mr-2" />
                      {language === "ar" ? "تعديل" : "Edit"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{language === "ar" ? "تعديل إعدادات Pool" : "Edit Pool Settings"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "اسم الـ Pool" : "Pool Name"}</Label>
                        <Input value={poolName} onChange={(e) => setPoolName(e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "بداية النطاق" : "Start IP"}</Label>
                          <Input value={startIp} onChange={(e) => setStartIp(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "نهاية النطاق" : "End IP"}</Label>
                          <Input value={endIp} onChange={(e) => setEndIp(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "البوابة (Gateway)" : "Gateway"}</Label>
                          <Input value={gateway} onChange={(e) => setGateway(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "قناع الشبكة" : "Subnet Mask"}</Label>
                          <Input value={subnet} onChange={(e) => setSubnet(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                      <Button onClick={handleUpdatePool} disabled={updatePool.isPending}>
                        {updatePool.isPending 
                          ? (language === "ar" ? "جارٍ الحفظ..." : "Saving...") 
                          : (language === "ar" ? "حفظ" : "Save")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">{language === "ar" ? "نطاق IP" : "IP Range"}</span>
                  <p className="font-mono">{poolStats.pool.startIp} - {poolStats.pool.endIp}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">{language === "ar" ? "البوابة" : "Gateway"}</span>
                  <p className="font-mono">{poolStats.pool.gateway}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">{language === "ar" ? "قناع الشبكة" : "Subnet"}</span>
                  <p className="font-mono">{poolStats.pool.subnet}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</span>
                  <p>
                    <Badge variant={poolStats.pool.isActive ? "default" : "secondary"}>
                      {poolStats.pool.isActive 
                        ? (language === "ar" ? "نشط" : "Active") 
                        : (language === "ar" ? "غير نشط" : "Inactive")}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Allocated and Available IPs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">
              {language === "ar" ? "العناوين المخصصة" : "Allocated IPs"}
              {allocatedData?.allocations && (
                <Badge variant="secondary" className="ml-2">{allocatedData.allocations.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="available">
              {language === "ar" ? "العناوين المتاحة" : "Available IPs"}
              {availableData?.availableIps && (
                <Badge variant="secondary" className="ml-2">{availableData.availableIps.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "العناوين المخصصة لأجهزة NAS" : "IPs Allocated to NAS Devices"}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAllocated ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : allocatedData?.allocations && allocatedData.allocations.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "ar" ? "عنوان IP" : "IP Address"}</TableHead>
                        <TableHead>{language === "ar" ? "اسم الجهاز" : "Device Name"}</TableHead>
                        <TableHead>{language === "ar" ? "نوع الاتصال" : "Connection Type"}</TableHead>
                        <TableHead>{language === "ar" ? "مستخدم VPN" : "VPN Username"}</TableHead>
                        <TableHead>{language === "ar" ? "تاريخ التخصيص" : "Allocated At"}</TableHead>
                        <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocatedData.allocations.map((allocation) => (
                        <TableRow key={allocation.id}>
                          <TableCell className="font-mono">{allocation.ipAddress}</TableCell>
                          <TableCell>{allocation.nasShortname || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {allocation.connectionType === 'vpn_sstp' ? 'SSTP' 
                                : allocation.connectionType === 'vpn_l2tp' ? 'L2TP' 
                                : allocation.connectionType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{allocation.vpnUsername || "-"}</TableCell>
                          <TableCell>
                            {allocation.allocatedAt 
                              ? new Date(allocation.allocatedAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(language === "ar" 
                                  ? `هل تريد تحرير IP ${allocation.ipAddress}؟` 
                                  : `Release IP ${allocation.ipAddress}?`)) {
                                  releaseIp.mutate({ nasId: allocation.nasId });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد عناوين مخصصة" : "No allocated IPs"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="available">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "العناوين المتاحة للتخصيص" : "Available IPs for Allocation"}</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAvailable ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
                  </div>
                ) : availableData?.availableIps && availableData.availableIps.length > 0 ? (
                  <div className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {availableData.availableIps.map((ip) => (
                      <div 
                        key={ip} 
                        className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-center font-mono text-xs"
                      >
                        {ip.split('.').slice(-1)[0]}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                    <span>{language === "ar" ? "لا توجد عناوين متاحة - الـ Pool ممتلئ!" : "No available IPs - Pool is full!"}</span>
                  </div>
                )}
                {availableData?.availableIps && availableData.availableIps.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
                    {language === "ar" 
                      ? `يتم عرض آخر رقم من كل IP (النطاق: ${availableData.pool?.startIp} - ${availableData.pool?.endIp})`
                      : `Showing last octet of each IP (Range: ${availableData.pool?.startIp} - ${availableData.pool?.endIp})`}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
