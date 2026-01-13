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
  Loader2
} from "lucide-react";

export default function SmsManagement() {
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userMessage, setUserMessage] = useState("");
  const [bulkPhones, setBulkPhones] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");

  // Queries
  const balanceQuery = trpc.notifications.getSmsBalance.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const usersQuery = trpc.users.list.useQuery({ page: 1, limit: 100 });

  // Mutations
  const sendTestSms = trpc.notifications.sendTestSms.useMutation({
    onSuccess: (data) => {
      toast.success(`تم إرسال الرسالة بنجاح. معرف الرسالة: ${data.smsId}`);
      setTestPhone("");
      setTestMessage("");
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
    },
    onError: (error) => {
      toast.error(error.message || "فشل إرسال الرسائل");
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

  const usersWithPhone = (usersQuery.data || []).filter((u: any) => u.phone);

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

      {/* Balance Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            رصيد الرسائل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {balanceQuery.isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : balanceQuery.data?.success ? (
                <>
                  <div className="text-4xl font-bold text-primary">
                    {balanceQuery.data.balance?.toLocaleString()}
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    رسالة متاحة
                  </Badge>
                </>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{balanceQuery.data?.error || "فشل جلب الرصيد"}</span>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => balanceQuery.refetch()}
              disabled={balanceQuery.isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ml-2 ${balanceQuery.isRefetching ? "animate-spin" : ""}`} />
              تحديث
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SMS Tabs */}
      <Tabs defaultValue="test" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="test" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            رسالة تجريبية
          </TabsTrigger>
          <TabsTrigger value="user" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            إرسال لمستخدم
          </TabsTrigger>
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            إرسال جماعي
          </TabsTrigger>
        </TabsList>

        {/* Test SMS Tab */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>إرسال رسالة تجريبية</CardTitle>
              <CardDescription>
                أرسل رسالة SMS تجريبية لأي رقم هاتف للتأكد من عمل الخدمة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="testPhone">رقم الهاتف</Label>
                <Input
                  id="testPhone"
                  placeholder="مثال: 0599123456"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  يمكنك إدخال الرقم بأي صيغة: 0599123456 أو 972599123456 أو +972599123456
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testMessage">نص الرسالة</Label>
                <Textarea
                  id="testMessage"
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
              <Button 
                onClick={handleSendTestSms} 
                disabled={sendTestSms.isPending}
                className="w-full"
              >
                {sendTestSms.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الرسالة
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send to User Tab */}
        <TabsContent value="user">
          <Card>
            <CardHeader>
              <CardTitle>إرسال رسالة لمستخدم</CardTitle>
              <CardDescription>
                اختر مستخدماً من القائمة وأرسل له رسالة SMS
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>اختر المستخدم</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مستخدماً..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersWithPhone.length === 0 ? (
                      <SelectItem value="none" disabled>
                        لا يوجد مستخدمون لديهم رقم هاتف
                      </SelectItem>
                    ) : (
                      usersWithPhone.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name || user.username} - {user.phone}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userMessage">نص الرسالة</Label>
                <Textarea
                  id="userMessage"
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
              <Button 
                onClick={handleSendToUser} 
                disabled={sendSmsToUser.isPending || usersWithPhone.length === 0}
                className="w-full"
              >
                {sendSmsToUser.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الرسالة
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk SMS Tab */}
        <TabsContent value="bulk">
          <Card>
            <CardHeader>
              <CardTitle>إرسال رسائل جماعية</CardTitle>
              <CardDescription>
                أرسل نفس الرسالة لعدة أرقام هواتف دفعة واحدة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulkPhones">أرقام الهواتف</Label>
                <Textarea
                  id="bulkPhones"
                  placeholder="أدخل كل رقم في سطر جديد أو افصل بينها بفاصلة:
0599123456
0598765432
0597654321"
                  value={bulkPhones}
                  onChange={(e) => setBulkPhones(e.target.value)}
                  rows={5}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  عدد الأرقام: {bulkPhones.split(/[\n,]/).filter(p => p.trim().length > 0).length}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulkMessage">نص الرسالة</Label>
                <Textarea
                  id="bulkMessage"
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
              <Button 
                onClick={handleSendBulkSms} 
                disabled={sendBulkSms.isPending}
                className="w-full"
              >
                {sendBulkSms.isPending ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الرسائل
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium text-blue-500">معلومات مهمة</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• الخدمة تدعم أرقام الهواتف الفلسطينية فقط (972)</li>
                <li>• الحد الأقصى لطول الرسالة 160 حرف</li>
                <li>• الرسائل العربية قد تستهلك رصيداً أكثر بسبب الترميز</li>
                <li>• يتم خصم الرصيد تلقائياً عند الإرسال</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
