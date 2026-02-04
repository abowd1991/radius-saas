import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, Trash2, Database, AlertCircle, CheckCircle2, Clock } from "lucide-react";
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

export default function BackupManagement() {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; content: string } | null>(null);

  // Queries
  const backupsQuery = trpc.backup.list.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Mutations
  const createMutation = trpc.backup.create.useMutation({
    onSuccess: () => {
      alert("✅ تم إنشاء النسخة الاحتياطية\n\nتم حفظ النسخة الاحتياطية بنجاح");
      backupsQuery.refetch();
    },
    onError: (error: any) => {
      alert("❌ فشل إنشاء النسخة الاحتياطية\n\n" + error.message);
    },
  });

  const restoreMutation = trpc.backup.restore.useMutation({
    onSuccess: () => {
      alert("✅ تم استعادة النسخة الاحتياطية\n\nتم استعادة قاعدة البيانات بنجاح");
      setRestoreTarget(null);
      setUploadedFile(null);
      backupsQuery.refetch();
    },
    onError: (error: any) => {
      alert("❌ فشلت الاستعادة\n\n" + error.message);
    },
  });

  const deleteMutation = trpc.backup.delete.useMutation({
    onSuccess: () => {
      alert("✅ تم حذف النسخة الاحتياطية\n\nتم حذف الملف بنجاح");
      setDeleteTarget(null);
      backupsQuery.refetch();
    },
    onError: (error: any) => {
      alert("❌ فشل الحذف\n\n" + error.message);
    },
  });

  const utils = trpc.useUtils();

  // Handle download
  const handleDownload = async (filename: string) => {
    try {
      const data = await utils.client.backup.download.query({ filename });
      // Create blob and download
      const blob = new Blob([data.content], { type: "application/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      alert("✅ تم تحميل النسخة الاحتياطية: " + data.filename);
    } catch (error: any) {
      alert("❌ فشل التحميل: " + error.message);
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".sql")) {
      alert("❌ نوع ملف غير صحيح\n\nيجب أن يكون الملف بصيغة .sql");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setUploadedFile({ name: file.name, content });
      setRestoreTarget(file.name);
    };
    reader.readAsText(file);
  };

  // Confirm restore
  const confirmRestore = () => {
    if (!uploadedFile) return;
    restoreMutation.mutate({
      filename: uploadedFile.name,
      content: uploadedFile.content,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">النسخ الاحتياطي</h1>
        <p className="text-muted-foreground mt-2">
          إدارة النسخ الاحتياطية لقاعدة البيانات - إنشاء، تحميل، واستعادة
        </p>
      </div>

      {/* Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            إجراءات النسخ الاحتياطي
          </CardTitle>
          <CardDescription>
            إنشاء نسخة احتياطية جديدة أو استعادة نسخة سابقة
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {/* Create Backup */}
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            size="lg"
          >
            <Database className="h-4 w-4 mr-2" />
            {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء نسخة احتياطية"}
          </Button>

          {/* Upload & Restore */}
          <div>
            <input
              type="file"
              accept=".sql"
              onChange={handleFileUpload}
              className="hidden"
              id="backup-upload"
            />
            <Button
              onClick={() => document.getElementById("backup-upload")?.click()}
              variant="outline"
              size="lg"
            >
              <Upload className="h-4 w-4 mr-2" />
              رفع واستعادة نسخة احتياطية
            </Button>
          </div>

          {uploadedFile && (
            <div className="w-full mt-2 p-4 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium">{uploadedFile.name}</span>
                <Badge variant="outline">جاهز للاستعادة</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={confirmRestore}
                  disabled={restoreMutation.isPending}
                  variant="default"
                >
                  {restoreMutation.isPending ? "جاري الاستعادة..." : "تأكيد الاستعادة"}
                </Button>
                <Button
                  onClick={() => {
                    setUploadedFile(null);
                    setRestoreTarget(null);
                  }}
                  variant="ghost"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retention Policy Info */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">سياسة الاحتفاظ التلقائية</h3>
              <p className="text-sm text-blue-700 mt-1">
                يتم حذف النسخ الاحتياطية الأقدم من 30 يوماً تلقائياً للحفاظ على مساحة التخزين
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle>النسخ الاحتياطية المتاحة</CardTitle>
          <CardDescription>
            {backupsQuery.data?.length || 0} نسخة احتياطية متاحة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupsQuery.isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : backupsQuery.data?.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">لا توجد نسخ احتياطية متاحة</p>
              <p className="text-sm text-muted-foreground mt-1">
                ابدأ بإنشاء نسخة احتياطية جديدة
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {backupsQuery.data?.map((backup: { filename: string; size: number; createdAt: Date }) => (
                <div
                  key={backup.filename}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Database className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{backup.filename}</p>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{formatDate(backup.createdAt.toISOString())}</span>
                        <span>•</span>
                        <span>{formatSize(backup.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleDownload(backup.filename)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      تحميل
                    </Button>
                    <Button
                      onClick={() => setDeleteTarget(backup.filename)}
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف النسخة الاحتياطية <strong>{deleteTarget}</strong>؟
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ filename: deleteTarget });
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
