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
} from "lucide-react";
import { useState, useEffect } from "react";

export default function Sessions() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);

  // Fetch active sessions
  const { data: sessions, isLoading, refetch } = trpc.sessions.list.useQuery(undefined, {
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch session stats
  const { data: stats } = trpc.sessions.getStats.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Disconnect mutation
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

  const confirmDisconnect = () => {
    if (selectedSession) {
      disconnectSession.mutate({
        sessionId: selectedSession.id,
        nasIp: selectedSession.nasIpAddress,
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
              ? "مراقبة وإدارة جلسات RADIUS النشطة"
              : "Monitor and manage active RADIUS sessions"}
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
                <TableHead className="w-[100px]"></TableHead>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisconnect(session)}
                      >
                        <WifiOff className="h-4 w-4" />
                      </Button>
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
              {language === "ar" ? "قطع الاتصال" : "Disconnect Session"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "ar" 
                ? `هل أنت متأكد من قطع اتصال المستخدم "${selectedSession?.username}"؟`
                : `Are you sure you want to disconnect user "${selectedSession?.username}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "ar" ? "قطع الاتصال" : "Disconnect"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
