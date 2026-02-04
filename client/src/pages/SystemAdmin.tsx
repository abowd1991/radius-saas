import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  RefreshCw, 
  Upload, 
  Server, 
  Database, 
  Shield, 
  Activity,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText
} from "lucide-react";
import { toast } from "sonner";

export default function SystemAdmin() {
  const [selectedService, setSelectedService] = useState<'app' | 'freeradius' | 'vpn' | 'dhcp'>('app');
  
  // Queries
  const statusQuery = trpc.vpsManagement.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  

  const backupsQuery = trpc.vpsManagement.getBackups.useQuery();
  const logsQuery = trpc.vpsManagement.getServiceLogs.useQuery(
    { serviceName: selectedService, lines: 100 },
    { enabled: !!selectedService }
  );
  
  // Mutations
  
  const backupMutation = trpc.vpsManagement.createBackup.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إنشاء النسخة الاحتياطية: ${data?.backup_id}`);
      backupsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`فشل إنشاء النسخة الاحتياطية: ${error.message}`);
    },
  });
  
  const restoreMutation = trpc.vpsManagement.restoreBackup.useMutation({
    onSuccess: () => {
      toast.success("تم استعادة النسخة الاحتياطية بنجاح");
      statusQuery.refetch();
    },
    onError: (error) => {
      toast.error(`فشل الاستعادة: ${error.message}`);
    },
  });
  
  const serviceActionMutation = trpc.vpsManagement.manageService.useMutation({
    onSuccess: (data) => {
      toast.success(`تم ${data?.action} الخدمة ${data?.service} - الحالة: ${data?.new_status}`);
      statusQuery.refetch();
    },
    onError: (error) => {
      toast.error(`فشل تنفيذ الإجراء: ${error.message}`);
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === 'active' || status === 'running') {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 ml-1" /> يعمل</Badge>;
    } else if (status === 'inactive' || status === 'stopped') {
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="w-3 h-3 ml-1" /> متوقف</Badge>;
    }
    return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30"><AlertTriangle className="w-3 h-3 ml-1" /> {status}</Badge>;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ar-SA');
  };

  const isLoading = backupMutation.isPending || restoreMutation.isPending || 
                    serviceActionMutation.isPending;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة النظام</h1>
          <p className="text-muted-foreground">تحديث، رجوع، نسخ احتياطي واستعادة</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => statusQuery.refetch()}
          disabled={statusQuery.isFetching}
        >
          <RefreshCw className={`w-4 h-4 ml-2 ${statusQuery.isFetching ? 'animate-spin' : ''}`} />
          تحديث الحالة
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="w-4 h-4" />
              الإصدار الحالي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {statusQuery.data?.version || '---'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4" />
              حالة الخدمات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {statusQuery.data?.services && Object.entries(statusQuery.data.services).map(([name, status]) => (
                <Badge 
                  key={name} 
                  variant="outline" 
                  className={`text-xs ${
                    status === 'active' ? 'border-green-500/50 text-green-400' : 
                    status === 'not_available' ? 'border-gray-500/50 text-gray-400' : 
                    'border-red-500/50 text-red-400'
                  }`}
                >
                  {name}: {status === 'active' ? '✓' : status === 'not_available' ? '—' : '✗'}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="w-4 h-4" />
              استخدام القرص
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {statusQuery.data?.disk_usage || '---'}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="w-4 h-4" />
              النسخ الاحتياطية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-400">
              {statusQuery.data?.backups_count || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health Status */}
      {statusQuery.data?.health && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              فحص الصحة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                {statusQuery.data.health.app_running ? 
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                  <XCircle className="w-5 h-5 text-red-500" />}
                <span>التطبيق</span>
              </div>
              <div className="flex items-center gap-2">
                {statusQuery.data.health.api_responding ? 
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                  <XCircle className="w-5 h-5 text-red-500" />}
                <span>API</span>
              </div>
              <div className="flex items-center gap-2">
                {statusQuery.data.health.db_connected ? 
                  <CheckCircle2 className="w-5 h-5 text-green-500" /> : 
                  <XCircle className="w-5 h-5 text-red-500" />}
                <span>قاعدة البيانات</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="backup" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="backup">النسخ الاحتياطي</TabsTrigger>
          <TabsTrigger value="services">الخدمات</TabsTrigger>
          <TabsTrigger value="logs">السجلات</TabsTrigger>
        </TabsList>



        {/* Backup Tab */}
        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  إنشاء نسخة احتياطية
                </CardTitle>
                <CardDescription>
                  إنشاء نسخة احتياطية كاملة من قاعدة البيانات والإعدادات
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => backupMutation.mutate({ prefix: 'manual' })}
                  disabled={isLoading}
                  className="w-full"
                >
                  {backupMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 ml-2 animate-spin" /> جاري الإنشاء...</>
                  ) : (
                    <><Upload className="w-4 h-4 ml-2" /> إنشاء نسخة احتياطية</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Backups List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                النسخ الاحتياطية المتاحة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {backupsQuery.data?.map((backup) => (
                    <div 
                      key={backup.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div className="flex items-center gap-3">
                        <Database className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{backup.id}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatBytes(Number(backup.size))} • {formatDate(backup.created)}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟')) {
                            restoreMutation.mutate({ backupId: backup.id });
                          }
                        }}
                        disabled={isLoading}
                      >
                        <Upload className="w-4 h-4 ml-1" />
                        استعادة
                      </Button>
                    </div>
                  ))}
                  {(!backupsQuery.data || backupsQuery.data.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      لا توجد نسخ احتياطية
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {statusQuery.data?.services && Object.entries(statusQuery.data.services).map(([name, status]) => (
              <Card key={name}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      {name}
                    </span>
                    {getStatusBadge(status)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(name === 'app' || name === 'dhcp') && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => serviceActionMutation.mutate({ 
                          serviceName: name as 'app' | 'dhcp', 
                          action: 'restart' 
                        })}
                        disabled={isLoading}
                      >
                        إعادة تشغيل
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => serviceActionMutation.mutate({ 
                          serviceName: name as 'app' | 'dhcp', 
                          action: status === 'active' ? 'stop' : 'start' 
                        })}
                        disabled={isLoading}
                      >
                        {status === 'active' ? 'إيقاف' : 'تشغيل'}
                      </Button>
                    </div>
                  )}
                  {(name === 'freeradius' || name === 'vpn') && (
                    <p className="text-sm text-muted-foreground">
                      لا يمكن التحكم بهذه الخدمة من هنا لأسباب أمنية
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                سجلات الخدمات
              </CardTitle>
              <div className="flex gap-2 mt-2">
                {(['app', 'freeradius', 'vpn', 'dhcp'] as const).map((service) => (
                  <Button
                    key={service}
                    size="sm"
                    variant={selectedService === service ? 'default' : 'outline'}
                    onClick={() => setSelectedService(service)}
                  >
                    {service}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full rounded-md border bg-black/50 p-4">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {logsQuery.data?.logs || 'جاري التحميل...'}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
