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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Download,
  Upload,
  Server,
  User,
  Globe,
  Activity,
  MoreHorizontal,
  Zap,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Sessions() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [isSpeedDialogOpen, setIsSpeedDialogOpen] = useState(false);
  const [newDownloadSpeed, setNewDownloadSpeed] = useState("");
  const [newUploadSpeed, setNewUploadSpeed] = useState("");

  // Fetch active sessions
  const { data: sessions, isLoading, refetch } = trpc.sessions.list.useQuery(undefined, {
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch session stats
  const { data: stats } = trpc.sessions.getStats.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // CoA Disconnect mutation
  const coaDisconnect = trpc.sessions.coaDisconnect.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(language === "ar" ? "تم قطع الاتصال بنجاح (CoA)" : "Session disconnected via CoA");
      } else {
        toast.warning(result.message);
      }
      setIsDisconnectDialogOpen(false);
      setSelectedSession(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // CoA Update Speed mutation (with fallback to disconnect)
  const changeUserSpeed = trpc.sessions.changeUserSpeed.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        const method = result.data?.method;
        if (method === 'coa') {
          toast.success(language === "ar" ? "تم تغيير السرعة فوراً" : "Speed changed instantly via CoA");
        } else if (method === 'disconnect-reconnect') {
          toast.success(language === "ar" ? "تم تحديث السرعة - سيتم تطبيقها عند إعادة الاتصال" : "Speed updated - will apply on reconnect");
        } else {
          toast.success(result.message);
        }
      } else {
        toast.warning(result.message);
      }
      setIsSpeedDialogOpen(false);
      setSelectedSession(null);
      setNewDownloadSpeed("");
      setNewUploadSpeed("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // MikroTik API - Change Speed Instantly (without disconnect)
  const mikrotikChangeSpeed = trpc.sessions.mikrotikChangeSpeed.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(language === "ar" ? "تم تغيير السرعة فوراً عبر MikroTik API" : "Speed changed instantly via MikroTik API");
      } else {
        toast.error(result.error || (language === "ar" ? "فشل تغيير السرعة" : "Failed to change speed"));
      }
      setIsSpeedDialogOpen(false);
      setSelectedSession(null);
      setNewDownloadSpeed("");
      setNewUploadSpeed("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // MikroTik API - Disconnect User
  const mikrotikDisconnect = trpc.sessions.mikrotikDisconnect.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(language === "ar" ? "تم قطع الاتصال عبر MikroTik API" : "Disconnected via MikroTik API");
      } else {
        toast.error(result.error || (language === "ar" ? "فشل قطع الاتصال" : "Failed to disconnect"));
      }
      setIsDisconnectDialogOpen(false);
      setSelectedSession(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Legacy CoA Update (kept for compatibility)
  const coaUpdateSession = trpc.sessions.coaUpdateSession.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(language === "ar" ? "تم تحديث السرعة بنجاح" : "Speed updated successfully");
      } else {
        toast.warning(result.message);
      }
      setIsSpeedDialogOpen(false);
      setSelectedSession(null);
      setNewDownloadSpeed("");
      setNewUploadSpeed("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Legacy disconnect mutation (fallback)
  const disconnectSession = trpc.sessions.disconnect.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم قطع الاتصال بنجاح" : "Session disconnected successfully");
      setIsDisconnectDialogOpen(false);
      setSelectedSession(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const filteredSessions = sessions?.filter(s => {
    if (!searchQuery) return true;
    return s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
           s.nasIpAddress.includes(searchQuery) ||
           s.framedIpAddress?.includes(searchQuery);
  });

  const handleDisconnect = (session: any) => {
    setSelectedSession(session);
    setIsDisconnectDialogOpen(true);
  };

  const handleChangeSpeed = (session: any) => {
    setSelectedSession(session);
    setIsSpeedDialogOpen(true);
  };

  const confirmDisconnect = () => {
    if (selectedSession) {
      // Use CoA disconnect
      coaDisconnect.mutate({
        username: selectedSession.username,
        nasIp: selectedSession.nasIpAddress,
        sessionId: selectedSession.sessionId, // Use acctsessionid, not UUID
        framedIp: selectedSession.framedIpAddress,
      });
    }
  };

  const confirmSpeedChange = (useMikrotikApi: boolean = true) => {
    if (selectedSession && newDownloadSpeed && newUploadSpeed) {
      if (useMikrotikApi) {
        // Use MikroTik API for instant speed change (recommended)
        mikrotikChangeSpeed.mutate({
          nasIp: selectedSession.nasIpAddress,
          username: selectedSession.username,
          uploadSpeedKbps: parseInt(newUploadSpeed) * 1000,
          downloadSpeedKbps: parseInt(newDownloadSpeed) * 1000,
        });
      } else {
        // Fallback to CoA/RADIUS method
        changeUserSpeed.mutate({
          username: selectedSession.username,
          uploadSpeedMbps: parseInt(newUploadSpeed),
          downloadSpeedMbps: parseInt(newDownloadSpeed),
        });
      }
    }
  };

  const confirmDisconnectMikrotik = () => {
    if (selectedSession) {
      mikrotikDisconnect.mutate({
        nasIp: selectedSession.nasIpAddress,
        username: selectedSession.username,
      });
    }
  };

  return (
    <div className="space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "الجلسات النشطة" : "Active Sessions"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "مراقبة وإدارة جلسات RADIUS النشطة مع دعم CoA"
              : "Monitor and manage active RADIUS sessions with CoA support"}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="h-4 w-4 me-2" />
          {language === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                <Wifi className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "الجلسات النشطة" : "Active Sessions"}
                </p>
                <p className="text-2xl font-bold">{stats?.activeSessionsCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي وقت الجلسات" : "Total Session Time"}
                </p>
                <p className="text-2xl font-bold">{formatDuration(stats?.totalSessionTime || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Download className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي التنزيل" : "Total Download"}
                </p>
                <p className="text-2xl font-bold">{formatBytes(stats?.totalInputOctets || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Upload className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "إجمالي الرفع" : "Total Upload"}
                </p>
                <p className="text-2xl font-bold">{formatBytes(stats?.totalOutputOctets || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MikroTik API Info Banner */}
      <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border-green-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Zap className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold">
                {language === "ar" ? "تغيير السرعة الفوري عبر MikroTik API" : "Instant Speed Change via MikroTik API"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {language === "ar" 
                  ? "يمكنك تغيير سرعة المستخدم فوراً بدون فصل الاتصال - يتم التطبيق مباشرة على Queue"
                  : "Change user speed instantly without disconnecting - applied directly to Queue"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={language === "ar" ? "بحث باسم المستخدم أو عنوان IP..." : "Search by username or IP address..."}
              className="ps-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "المستخدم" : "Username"}</TableHead>
                <TableHead>{language === "ar" ? "عنوان IP" : "IP Address"}</TableHead>
                <TableHead>{language === "ar" ? "جهاز NAS" : "NAS Device"}</TableHead>
                <TableHead>{language === "ar" ? "مدة الجلسة" : "Session Time"}</TableHead>
                <TableHead>{language === "ar" ? "التنزيل" : "Download"}</TableHead>
                <TableHead>{language === "ar" ? "الرفع" : "Upload"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead className="w-[100px]">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredSessions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد جلسات نشطة" : "No active sessions"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredSessions?.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{session.username}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{session.framedIpAddress || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{session.nasName || session.nasIpAddress}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{formatDuration(session.sessionTime)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Download className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{formatBytes(session.inputOctets)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">{formatBytes(session.outputOctets)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{session.serviceType}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleChangeSpeed(session)}>
                            <Settings className="h-4 w-4 me-2" />
                            {language === "ar" ? "تغيير السرعة" : "Change Speed"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDisconnect(session)}
                            className="text-destructive"
                          >
                            <WifiOff className="h-4 w-4 me-2" />
                            {language === "ar" ? "قطع الاتصال" : "Disconnect"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={isDisconnectDialogOpen} onOpenChange={setIsDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "ar" ? "قطع الاتصال (CoA)" : "Disconnect Session (CoA)"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar" 
                ? `هل أنت متأكد من قطع اتصال المستخدم "${selectedSession?.username}"؟ سيتم إرسال طلب CoA Disconnect إلى جهاز NAS.`
                : `Are you sure you want to disconnect user "${selectedSession?.username}"? A CoA Disconnect request will be sent to the NAS device.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={coaDisconnect.isPending}
            >
              {coaDisconnect.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin me-2" />
              ) : (
                <WifiOff className="h-4 w-4 me-2" />
              )}
              {language === "ar" ? "قطع الاتصال" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Speed Dialog */}
      <Dialog open={isSpeedDialogOpen} onOpenChange={setIsSpeedDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تغيير السرعة الفوري" : "Instant Speed Change"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `تغيير سرعة المستخدم "${selectedSession?.username}" فوراً بدون فصل الاتصال`
                : `Change speed for user "${selectedSession?.username}" instantly without disconnecting`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">
                {language === "ar" 
                  ? "✨ سيتم تطبيق السرعة الجديدة فوراً عبر MikroTik API"
                  : "✨ New speed will be applied instantly via MikroTik API"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                {language === "ar" ? "سرعة التنزيل (Mbps)" : "Download Speed (Mbps)"}
              </Label>
              <Input
                type="number"
                placeholder="10"
                value={newDownloadSpeed}
                onChange={(e) => setNewDownloadSpeed(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {language === "ar" ? "سرعة الرفع (Mbps)" : "Upload Speed (Mbps)"}
              </Label>
              <Input
                type="number"
                placeholder="5"
                value={newUploadSpeed}
                onChange={(e) => setNewUploadSpeed(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsSpeedDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => confirmSpeedChange(true)}
              disabled={!newDownloadSpeed || !newUploadSpeed || mikrotikChangeSpeed.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {mikrotikChangeSpeed.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin me-2" />
              ) : (
                <Zap className="h-4 w-4 me-2" />
              )}
              {language === "ar" ? "تطبيق فوري" : "Apply Instantly"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
