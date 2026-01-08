import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  MoreVertical,
  Calendar,
  HardDrive,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

export default function Backups() {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const { data: backups, isLoading: backupsLoading, refetch: refetchBackups } = trpc.backups.list.useQuery();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.backups.stats.useQuery();
  
  const createBackup = trpc.backups.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء النسخة الاحتياطية بنجاح");
      refetchBackups();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`فشل في إنشاء النسخة الاحتياطية: ${error.message}`);
    },
  });

  const downloadBackup = trpc.backups.download.useMutation({
    onSuccess: (data) => {
      // Decode base64 and download
      const binaryString = atob(data.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("تم تحميل النسخة الاحتياطية");
    },
    onError: (error) => {
      toast.error(`فشل في تحميل النسخة الاحتياطية: ${error.message}`);
    },
  });

  const deleteBackup = trpc.backups.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف النسخة الاحتياطية");
      refetchBackups();
      refetchStats();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(`فشل في حذف النسخة الاحتياطية: ${error.message}`);
    },
  });

  const cleanupBackups = trpc.backups.cleanup.useMutation({
    onSuccess: (data) => {
      toast.success(`تم حذف ${data.deleted} نسخة احتياطية قديمة`);
      refetchBackups();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`فشل في تنظيف النسخ الاحتياطية: ${error.message}`);
    },
  });

  const runScheduled = trpc.backups.runScheduled.useMutation({
    onSuccess: () => {
      toast.success("تم تشغيل النسخ الاحتياطي المجدول");
      refetchBackups();
      refetchStats();
    },
    onError: (error) => {
      toast.error(`فشل في تشغيل النسخ الاحتياطي: ${error.message}`);
    },
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "daily":
        return <Badge variant="default">يومي</Badge>;
      case "weekly":
        return <Badge variant="secondary">أسبوعي</Badge>;
      case "manual":
        return <Badge variant="outline">يدوي</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  const refetchAll = () => {
    refetchBackups();
    refetchStats();
  };

  if (backupsLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">النسخ الاحتياطي</h1>
          <p className="text-muted-foreground">إدارة النسخ الاحتياطية لقاعدة البيانات</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={refetchAll}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => createBackup.mutate()}
            disabled={createBackup.isPending}
          >
            {createBackup.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 ml-2" />
            )}
            نسخة احتياطية جديدة
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي النسخ</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalBackups || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.dailyCount || 0} يومي • {stats?.weeklyCount || 0} أسبوعي • {stats?.manualCount || 0} يدوي
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">الحجم الإجمالي</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSizeFormatted || "0 B"}</div>
            <p className="text-xs text-muted-foreground">مساحة التخزين المستخدمة</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">آخر نسخة يومية</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastDailyBackup ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-base">
                    {formatDistanceToNow(new Date(stats.lastDailyBackup), { addSuffix: true, locale: ar })}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-base">لا يوجد</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastDailyBackup && format(new Date(stats.lastDailyBackup), "dd/MM/yyyy HH:mm", { locale: ar })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">آخر نسخة أسبوعية</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.lastWeeklyBackup ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-base">
                    {formatDistanceToNow(new Date(stats.lastWeeklyBackup), { addSuffix: true, locale: ar })}
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertCircle className="h-5 w-5" />
                  <span className="text-base">لا يوجد</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastWeeklyBackup && format(new Date(stats.lastWeeklyBackup), "dd/MM/yyyy HH:mm", { locale: ar })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>إجراءات سريعة</CardTitle>
          <CardDescription>تشغيل النسخ الاحتياطي المجدول يدوياً</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => runScheduled.mutate({ type: "daily" })}
            disabled={runScheduled.isPending}
          >
            {runScheduled.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 ml-2" />
            )}
            تشغيل النسخ اليومي
          </Button>
          <Button
            variant="outline"
            onClick={() => runScheduled.mutate({ type: "weekly" })}
            disabled={runScheduled.isPending}
          >
            {runScheduled.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Clock className="h-4 w-4 ml-2" />
            )}
            تشغيل النسخ الأسبوعي
          </Button>
          <Button
            variant="outline"
            onClick={() => cleanupBackups.mutate()}
            disabled={cleanupBackups.isPending}
          >
            {cleanupBackups.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 ml-2" />
            )}
            تنظيف النسخ القديمة
          </Button>
        </CardContent>
      </Card>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة النسخ الاحتياطية</CardTitle>
          <CardDescription>
            جميع النسخ الاحتياطية المحفوظة (يتم الاحتفاظ بآخر 7 نسخ يومية و 4 نسخ أسبوعية)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups && backups.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الملف</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحجم</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead className="w-[100px]">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-mono text-sm">{backup.filename}</TableCell>
                    <TableCell>{getTypeBadge(backup.type)}</TableCell>
                    <TableCell>{backup.sizeFormatted}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{format(new Date(backup.createdAt), "dd/MM/yyyy HH:mm", { locale: ar })}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(backup.createdAt), { addSuffix: true, locale: ar })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => downloadBackup.mutate({ id: backup.id })}
                            disabled={downloadBackup.isPending}
                          >
                            <Download className="h-4 w-4 ml-2" />
                            تحميل
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteId(backup.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 ml-2" />
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">لا توجد نسخ احتياطية</h3>
              <p className="text-muted-foreground mb-4">
                قم بإنشاء نسخة احتياطية جديدة للبدء
              </p>
              <Button onClick={() => createBackup.mutate()} disabled={createBackup.isPending}>
                {createBackup.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 ml-2" />
                )}
                إنشاء نسخة احتياطية
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف النسخة الاحتياطية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه النسخة الاحتياطية؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteBackup.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBackup.isPending ? (
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              ) : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
