import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  Users, 
  Phone, 
  Wallet,
  AlertCircle,
  CheckCircle2,
  Loader2,
  History,
  FileText,
  Plus,
  Edit,
  Trash2,
  Clock,
  XCircle,
  BarChart3
} from "lucide-react";

export default function SmsManagement() {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userMessage, setUserMessage] = useState("");
  const [bulkPhones, setBulkPhones] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  
  // Template dialog state
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    nameAr: "",
    content: "",
    contentAr: "",
    type: "custom" as const,
    isActive: true,
  });

  // Logs filter state
  const [logsPage, setLogsPage] = useState(1);
  const [logsFilter, setLogsFilter] = useState<{
    status?: string;
    type?: string;
  }>({});

  // Queries
  const balanceQuery = trpc.notifications.getSmsBalance.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const usersQuery = trpc.users.list.useQuery({ page: 1, limit: 100 });
  
  const logsQuery = trpc.notifications.getSmsLogs.useQuery({
    page: logsPage,
    limit: 15,
    status: logsFilter.status as any,
    type: logsFilter.type as any,
  });

  const statsQuery = trpc.notifications.getSmsStats.useQuery();
  
  const templatesQuery = trpc.notifications.getSmsTemplates.useQuery();

  // Mutations
  const sendTestSms = trpc.notifications.sendTestSms.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال الرسالة بنجاح. معرف الرسالة: ${data.smsId}`);
      setTestPhone("");
      setTestMessage("");
      logsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الرسالة");
    },
  });

  const sendSmsToUser = trpc.notifications.sendSmsToUser.useMutation({
    onSuccess: () => {
      toast.success("تم إرسال الرسالة للمستخدم بنجاح");
      setSelectedUserId("");
      setUserMessage("");
      logsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الرسالة");
    },
  });

  const sendBulkSms = trpc.notifications.sendBulkSms.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال ${data.sent} من ${data.total} رسالة بنجاح`);
      setBulkPhones("");
      setBulkMessage("");
      logsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الرسائل");
    },
  });

  const createTemplate = trpc.notifications.createSmsTemplate.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء القالب بنجاح");
      setTemplateDialogOpen(false);
      resetTemplateForm();
      templatesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء القالب");
    },
  });

  const updateTemplate = trpc.notifications.updateSmsTemplate.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث القالب بنجاح");
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
      resetTemplateForm();
      templatesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث القالب");
    },
  });

  const deleteTemplate = trpc.notifications.deleteSmsTemplate.useMutation({
    onSuccess: () => {
      toast.success("تم حذف القالب بنجاح");
      templatesQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف القالب");
    },
  });

  const handleSendTestSms = () => {
    if (!testPhone || !testMessage) {
      toast.error("يرجى إدخال رقم الهاتف والرسالة");
      return;
    }
    sendTestSms.mutate({ phone: testPhone, message: testMessage });
  };

  const handleSendToUser = () => {
    if (!selectedUserId || !userMessage) {
      toast.error("يرجى اختيار المستخدم وكتابة الرسالة");
      return;
    }
    sendSmsToUser.mutate({ userId: parseInt(selectedUserId), message: userMessage });
  };

  const handleSendBulkSms = () => {
    const phones = bulkPhones.split(/[\n,]/).map(p => p.trim()).filter(p => p.length > 0);
    if (phones.length === 0 || !bulkMessage) {
      toast.error("يرجى إدخال أرقام الهواتف والرسالة");
      return;
    }
    sendBulkSms.mutate({ phones, message: bulkMessage });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      nameAr: "",
      content: "",
      contentAr: "",
      type: "custom",
      isActive: true,
    });
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      nameAr: template.nameAr || "",
      content: template.content,
      contentAr: template.contentAr || "",
      type: template.type,
      isActive: template.isActive,
    });
    setTemplateDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.content) {
      toast.error("يرجى إدخال اسم القالب والمحتوى");
      return;
    }

    if (editingTemplate) {
      updateTemplate.mutate({
        id: editingTemplate.id,
        ...templateForm,
      });
    } else {
      createTemplate.mutate(templateForm);
    }
  };

  const usersWithPhone = (usersQuery.data || []).filter((u: any) => u.phone);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 ml-1" />تم الإرسال</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 ml-1" />قيد الانتظار</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 ml-1" />فشل</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "manual":
        return <Badge variant="outline">يدوي</Badge>;
      case "bulk":
        return <Badge variant="secondary">جماعي</Badge>;
      case "automatic":
        return <Badge variant="default">تلقائي</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getTemplateTypeBadge = (type: string) => {
    switch (type) {
      case "subscription_expiry":
        return <Badge variant="destructive">انتهاء الاشتراك</Badge>;
      case "welcome":
        return <Badge variant="default" className="bg-green-500">ترحيب</Badge>;
      case "payment_reminder":
        return <Badge variant="secondary">تذكير بالدفع</Badge>;
      case "custom":
        return <Badge variant="outline">مخصص</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            إدارة الرسائل القصيرة SMS
          </h1>
          <p className="text-muted-foreground mt-1">
            إرسال رسائل SMS للعملاء عبر TweetSMS
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Balance Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              رصيد الرسائل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {balanceQuery.isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : balanceQuery.data?.success ? (
                <div className="text-2xl font-bold text-primary">
                  {balanceQuery.data.balance?.toLocaleString()}
                </div>
              ) : (
                <div className="text-destructive text-sm">خطأ</div>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => balanceQuery.refetch()}
                disabled={balanceQuery.isRefetching}
              >
                <RefreshCw className={`h-4 w-4 ${balanceQuery.isRefetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Total Sent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              إجمالي المرسل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsQuery.data?.sent || 0}
            </div>
            <p className="text-xs text-muted-foreground">من {statsQuery.data?.total || 0} رسالة</p>
          </CardContent>
        </Card>

        {/* Failed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              فشل الإرسال
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {statsQuery.data?.failed || 0}
            </div>
          </CardContent>
        </Card>

        {/* Today */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsQuery.data?.todayCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">رسالة</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            إرسال رسائل
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            سجل الرسائل
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            القوالب
          </TabsTrigger>
        </TabsList>

        {/* Send SMS Tab */}
        <TabsContent value="send">
          <Tabs defaultValue="test" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="test">رسالة تجريبية</TabsTrigger>
              <TabsTrigger value="user">إرسال لمستخدم</TabsTrigger>
              <TabsTrigger value="bulk">إرسال جماعي</TabsTrigger>
            </TabsList>

            {/* Test SMS */}
            <TabsContent value="test">
              <Card>
                <CardHeader>
                  <CardTitle>إرسال رسالة تجريبية</CardTitle>
                  <CardDescription>أرسل رسالة SMS تجريبية لأي رقم هاتف</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      placeholder="مثال: 0599123456"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نص الرسالة</Label>
                    <Textarea
                      placeholder="اكتب رسالتك هنا..."
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      maxLength={160}
                      rows={3}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>الحد الأقصى: 160 حرف</span>
                      <span>{testMessage.length}/160</span>
                    </div>
                  </div>
                  <Button onClick={handleSendTestSms} disabled={sendTestSms.isPending} className="w-full">
                    {sendTestSms.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                    إرسال
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Send to User */}
            <TabsContent value="user">
              <Card>
                <CardHeader>
                  <CardTitle>إرسال رسالة لمستخدم</CardTitle>
                  <CardDescription>اختر مستخدماً من القائمة وأرسل له رسالة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>اختر المستخدم</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر مستخدماً..." />
                      </SelectTrigger>
                      <SelectContent>
                        {usersWithPhone.map((user: any) => (
                          <SelectItem key={user.id} value={user.id.toString()}>
                            {user.name || user.username} - {user.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>نص الرسالة</Label>
                    <Textarea
                      placeholder="اكتب رسالتك هنا..."
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      maxLength={160}
                      rows={3}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>الحد الأقصى: 160 حرف</span>
                      <span>{userMessage.length}/160</span>
                    </div>
                  </div>
                  <Button onClick={handleSendToUser} disabled={sendSmsToUser.isPending} className="w-full">
                    {sendSmsToUser.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                    إرسال
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bulk SMS */}
            <TabsContent value="bulk">
              <Card>
                <CardHeader>
                  <CardTitle>إرسال رسائل جماعية</CardTitle>
                  <CardDescription>أرسل نفس الرسالة لعدة أرقام دفعة واحدة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>أرقام الهواتف</Label>
                    <Textarea
                      placeholder="أدخل كل رقم في سطر جديد أو افصل بينها بفاصلة"
                      value={bulkPhones}
                      onChange={(e) => setBulkPhones(e.target.value)}
                      rows={4}
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>نص الرسالة</Label>
                    <Textarea
                      placeholder="اكتب رسالتك هنا..."
                      value={bulkMessage}
                      onChange={(e) => setBulkMessage(e.target.value)}
                      maxLength={160}
                      rows={3}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>الحد الأقصى: 160 حرف</span>
                      <span>{bulkMessage.length}/160</span>
                    </div>
                  </div>
                  <Button onClick={handleSendBulkSms} disabled={sendBulkSms.isPending} className="w-full">
                    {sendBulkSms.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
                    إرسال للجميع
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>سجل الرسائل المرسلة</CardTitle>
                  <CardDescription>جميع الرسائل المرسلة وحالتها</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={logsFilter.status || "all"} onValueChange={(v) => setLogsFilter(f => ({ ...f, status: v === "all" ? undefined : v }))}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="sent">تم الإرسال</SelectItem>
                      <SelectItem value="pending">قيد الانتظار</SelectItem>
                      <SelectItem value="failed">فشل</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={logsFilter.type || "all"} onValueChange={(v) => setLogsFilter(f => ({ ...f, type: v === "all" ? undefined : v }))}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="manual">يدوي</SelectItem>
                      <SelectItem value="bulk">جماعي</SelectItem>
                      <SelectItem value="automatic">تلقائي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => logsQuery.refetch()}>
                    <RefreshCw className={`h-4 w-4 ${logsQuery.isRefetching ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {logsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم الهاتف</TableHead>
                        <TableHead>الرسالة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>التاريخ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsQuery.data?.logs?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            لا توجد رسائل مسجلة
                          </TableCell>
                        </TableRow>
                      ) : (
                        logsQuery.data?.logs?.map((log: any) => (
                          <TableRow key={log.id}>
                            <TableCell dir="ltr" className="font-mono">{log.phone}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{log.message}</TableCell>
                            <TableCell>{getStatusBadge(log.status)}</TableCell>
                            <TableCell>{getTypeBadge(log.type)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {new Date(log.createdAt).toLocaleString("ar-EG")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  
                  {/* Pagination */}
                  {logsQuery.data && logsQuery.data.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage(p => Math.max(1, p - 1))}
                        disabled={logsPage === 1}
                      >
                        السابق
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        صفحة {logsPage} من {logsQuery.data.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogsPage(p => Math.min(logsQuery.data!.totalPages, p + 1))}
                        disabled={logsPage === logsQuery.data.totalPages}
                      >
                        التالي
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>قوالب الرسائل</CardTitle>
                  <CardDescription>قوالب جاهزة للرسائل المتكررة مع دعم المتغيرات</CardDescription>
                </div>
                <Dialog open={templateDialogOpen} onOpenChange={(open) => {
                  setTemplateDialogOpen(open);
                  if (!open) {
                    setEditingTemplate(null);
                    resetTemplateForm();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 ml-2" />
                      قالب جديد
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingTemplate ? "تعديل القالب" : "إنشاء قالب جديد"}</DialogTitle>
                      <DialogDescription>
                        يمكنك استخدام المتغيرات: {"{name}"}, {"{days}"}, {"{amount}"}, {"{plan}"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>اسم القالب (إنجليزي)</Label>
                          <Input
                            value={templateForm.name}
                            onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Template Name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>اسم القالب (عربي)</Label>
                          <Input
                            value={templateForm.nameAr}
                            onChange={(e) => setTemplateForm(f => ({ ...f, nameAr: e.target.value }))}
                            placeholder="اسم القالب"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>نوع القالب</Label>
                        <Select value={templateForm.type} onValueChange={(v: any) => setTemplateForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="subscription_expiry">تنبيه انتهاء الاشتراك</SelectItem>
                            <SelectItem value="welcome">رسالة ترحيب</SelectItem>
                            <SelectItem value="payment_reminder">تذكير بالدفع</SelectItem>
                            <SelectItem value="custom">مخصص</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>المحتوى (إنجليزي)</Label>
                        <Textarea
                          value={templateForm.content}
                          onChange={(e) => setTemplateForm(f => ({ ...f, content: e.target.value }))}
                          placeholder="Dear {name}, your subscription will expire in {days} days..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>المحتوى (عربي)</Label>
                        <Textarea
                          value={templateForm.contentAr}
                          onChange={(e) => setTemplateForm(f => ({ ...f, contentAr: e.target.value }))}
                          placeholder="عزيزي {name}، اشتراكك سينتهي خلال {days} يوم..."
                          rows={3}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={templateForm.isActive}
                          onCheckedChange={(checked) => setTemplateForm(f => ({ ...f, isActive: checked }))}
                        />
                        <Label>مفعّل</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>إلغاء</Button>
                      <Button onClick={handleSaveTemplate} disabled={createTemplate.isPending || updateTemplate.isPending}>
                        {(createTemplate.isPending || updateTemplate.isPending) && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                        {editingTemplate ? "حفظ التغييرات" : "إنشاء القالب"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {templatesQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>المحتوى</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templatesQuery.data?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          لا توجد قوالب
                        </TableCell>
                      </TableRow>
                    ) : (
                      templatesQuery.data?.map((template: any) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{template.nameAr || template.name}</div>
                              {template.nameAr && <div className="text-xs text-muted-foreground">{template.name}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{getTemplateTypeBadge(template.type)}</TableCell>
                          <TableCell className="max-w-[250px] truncate text-muted-foreground">
                            {template.contentAr || template.content}
                          </TableCell>
                          <TableCell>
                            {template.isActive ? (
                              <Badge variant="default" className="bg-green-500">مفعّل</Badge>
                            ) : (
                              <Badge variant="secondary">معطّل</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {!template.isSystem && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm("هل أنت متأكد من حذف هذا القالب؟")) {
                                      deleteTemplate.mutate({ id: template.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
