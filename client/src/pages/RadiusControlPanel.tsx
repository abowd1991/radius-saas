import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Activity, 
  RefreshCw, 
  Play, 
  Pause, 
  Server, 
  Clock, 
  Users, 
  Wifi, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Zap,
  Database,
  FileText,
  Settings
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

export default function RadiusControlPanel() {
  const [searchUsername, setSearchUsername] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");
  
  // Queries
  const { data: accountingStatus, refetch: refetchAccounting } = trpc.radius.getAccountingStatus.useQuery();
  const { data: sessionMonitorStatus, refetch: refetchSessionMonitor } = trpc.radius.getSessionMonitorStatus.useQuery();
  const { data: activeSessions, refetch: refetchSessions } = trpc.sessions.list.useQuery();
  const { data: auditLogs, refetch: refetchAudit } = trpc.radius.getRecentAuditLogs.useQuery({ limit: 20 });
  const { data: userTimeDetails, refetch: refetchUserTime } = trpc.radius.getUserTimeDetails.useQuery(
    { username: searchUsername },
    { enabled: searchUsername.length > 0 }
  );
  
  // Mutations
  const triggerAccountingMutation = trpc.radius.triggerAccountingRun.useMutation({
    onSuccess: (data: { processed: number; disconnected: number }) => {
      toast.success(`تم تشغيل المحاسبة: ${data.processed} معالج، ${data.disconnected} قطع`);
      refetchAccounting();
      refetchSessions();
    },
    onError: (error: { message: string }) => {
      toast.error(`فشل: ${error.message}`);
    },
  });
  
  const syncUserMutation = trpc.radius.syncUserUsage.useMutation({
    onSuccess: () => {
      toast.success("تم مزامنة استخدام المستخدم");
      refetchUserTime();
    },
    onError: (error: { message: string }) => {
      toast.error(`فشل: ${error.message}`);
    },
  });

  const formatSeconds = (seconds: number) => {
    if (seconds < 0) return "غير محدود";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}س ${minutes}د`;
    } else if (minutes > 0) {
      return `${minutes}د ${secs}ث`;
    }
    return `${secs}ث`;
  };

  const handleRefreshAll = () => {
    refetchAccounting();
    refetchSessionMonitor();
    refetchSessions();
    refetchAudit();
    toast.success("تم تحديث جميع البيانات");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">لوحة تحكم RADIUS</h1>
          <p className="text-muted-foreground">مراقبة وإدارة الجلسات والمحاسبة</p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline">
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث الكل
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Central Accounting Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">خدمة المحاسبة</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {accountingStatus?.isRunning ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  تعمل
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 ml-1" />
                  متوقفة
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {accountingStatus?.totalRuns || 0} تشغيل، {accountingStatus?.totalDisconnects || 0} قطع
            </p>
            {accountingStatus?.lastRunTime && (
              <p className="text-xs text-muted-foreground">
                آخر تشغيل: {format(new Date(accountingStatus.lastRunTime), "HH:mm:ss", { locale: ar })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Session Monitor Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مراقب الجلسات</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {sessionMonitorStatus?.isRunning ? (
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  يعمل
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="h-3 w-3 ml-1" />
                  متوقف
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {sessionMonitorStatus?.totalChecks || 0} فحص، {sessionMonitorStatus?.totalDisconnects || 0} قطع
            </p>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الجلسات النشطة</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              متصلون الآن (acctstoptime IS NULL)
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجراءات سريعة</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => triggerAccountingMutation.mutate()}
              disabled={triggerAccountingMutation.isPending}
            >
              {triggerAccountingMutation.isPending ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 ml-2" />
              )}
              تشغيل المحاسبة الآن
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="sessions">الجلسات</TabsTrigger>
          <TabsTrigger value="user-lookup">بحث المستخدم</TabsTrigger>
          <TabsTrigger value="audit">سجل التدقيق</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Architecture Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  البنية المعمارية
                </CardTitle>
                <CardDescription>المبادئ الأساسية للنظام</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium">radacct = مصدر الحقيقة</p>
                    <p className="text-sm text-muted-foreground">جميع حسابات الوقت من radacct</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium">Session-Timeout = ناتج محسوب</p>
                    <p className="text-sm text-muted-foreground">لا يُستخدم كمخزن للوقت</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium">Online = acctstoptime IS NULL</p>
                    <p className="text-sm text-muted-foreground">أي جلسة بـ stop time = offline</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-1" />
                  <div>
                    <p className="font-medium">القرارات من لوحة التحكم فقط</p>
                    <p className="text-sm text-muted-foreground">لا تقديرات من MikroTik</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  صحة الخدمات
                </CardTitle>
                <CardDescription>حالة الخدمات الخلفية</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span>Central Accounting</span>
                  {accountingStatus?.isRunning ? (
                    <Badge className="bg-green-500">يعمل كل 60 ثانية</Badge>
                  ) : (
                    <Badge variant="destructive">متوقف</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Session Monitor</span>
                  {sessionMonitorStatus?.isRunning ? (
                    <Badge className="bg-green-500">يعمل كل 30 ثانية</Badge>
                  ) : (
                    <Badge variant="destructive">متوقف</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span>Stale Session Cleanup</span>
                  <Badge className="bg-blue-500">تلقائي مع المحاسبة</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Audit Logging</span>
                  <Badge className="bg-green-500">مفعّل</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                الجلسات النشطة
              </CardTitle>
              <CardDescription>
                الجلسات التي acctstoptime IS NULL (متصلون الآن)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>NAS IP</TableHead>
                    <TableHead>وقت الجلسة</TableHead>
                    <TableHead>بداية الجلسة</TableHead>
                    <TableHead>IP المعين</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSessions && activeSessions.length > 0 ? (
                    activeSessions.map((session: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{session.username}</TableCell>
                        <TableCell>{session.nasipaddress}</TableCell>
                        <TableCell>{formatSeconds(session.acctsessiontime || 0)}</TableCell>
                        <TableCell>
                          {session.acctstarttime 
                            ? format(new Date(session.acctstarttime), "HH:mm:ss dd/MM", { locale: ar })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{session.framedipaddress || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        لا توجد جلسات نشطة
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Lookup Tab */}
        <TabsContent value="user-lookup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                بحث تفاصيل المستخدم
              </CardTitle>
              <CardDescription>
                عرض تفاصيل الوقت والصلاحية لمستخدم محدد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    placeholder="أدخل اسم المستخدم..."
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={() => refetchUserTime()}>
                    <Search className="h-4 w-4 ml-2" />
                    بحث
                  </Button>
                  {searchUsername && (
                    <Button 
                      variant="outline"
                      onClick={() => syncUserMutation.mutate({ username: searchUsername })}
                      disabled={syncUserMutation.isPending}
                    >
                      <RefreshCw className={`h-4 w-4 ml-2 ${syncUserMutation.isPending ? 'animate-spin' : ''}`} />
                      مزامنة
                    </Button>
                  )}
                </div>
              </div>

              {userTimeDetails && (
                <div className="grid gap-4 md:grid-cols-2 mt-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">وقت الإنترنت</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المخصص:</span>
                          <span className="font-medium">{formatSeconds(userTimeDetails.allocatedTimeSeconds)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المستخدم (radacct):</span>
                          <span className="font-medium">{formatSeconds(userTimeDetails.usedTimeFromRadacct)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الجلسة الحالية:</span>
                          <span className="font-medium">{formatSeconds(userTimeDetails.currentSessionTime)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-muted-foreground">المتبقي:</span>
                          <span className={`font-bold ${userTimeDetails.remainingTimeSeconds <= 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {formatSeconds(userTimeDetails.remainingTimeSeconds)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">الصلاحية والحالة</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تاريخ الانتهاء:</span>
                          <span className="font-medium">
                            {userTimeDetails.expiresAt 
                              ? format(new Date(userTimeDetails.expiresAt), "dd/MM/yyyy HH:mm", { locale: ar })
                              : "غير محدد"
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">منتهي الصلاحية:</span>
                          {userTimeDetails.isValidityExpired ? (
                            <Badge variant="destructive">نعم</Badge>
                          ) : (
                            <Badge className="bg-green-500">لا</Badge>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">يجب القطع:</span>
                          {userTimeDetails.shouldDisconnect ? (
                            <Badge variant="destructive">{userTimeDetails.disconnectReason}</Badge>
                          ) : (
                            <Badge className="bg-green-500">لا</Badge>
                          )}
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">حالة الكرت:</span>
                          <Badge variant="outline">{userTimeDetails.status}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                سجل التدقيق
              </CardTitle>
              <CardDescription>
                آخر العمليات المسجلة (من - متى - ماذا - لماذا)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الوقت</TableHead>
                    <TableHead>الإجراء</TableHead>
                    <TableHead>الهدف</TableHead>
                    <TableHead>النتيجة</TableHead>
                    <TableHead>التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs && auditLogs.length > 0 ? (
                    auditLogs.map((log: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {log.createdAt 
                            ? format(new Date(log.createdAt), "HH:mm:ss dd/MM", { locale: ar })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>{log.targetName || log.targetId || "-"}</TableCell>
                        <TableCell>
                          {log.result === 'success' ? (
                            <Badge className="bg-green-500">نجاح</Badge>
                          ) : log.result === 'failure' ? (
                            <Badge variant="destructive">فشل</Badge>
                          ) : (
                            <Badge variant="secondary">{log.result}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {typeof log.details === 'string' 
                            ? log.details 
                            : JSON.stringify(log.details)?.substring(0, 50)
                          }
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        لا توجد سجلات
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
