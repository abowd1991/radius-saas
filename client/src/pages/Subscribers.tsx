import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CreditCard
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Subscribers() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenewDialogOpen, setIsRenewDialogOpen] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<any>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    phone: "",
    email: "",
    address: "",
    nationalId: "",
    notes: "",
    planId: 0,
    nasId: undefined as number | undefined,
    ipAssignmentType: "dynamic" as "dynamic" | "static",
    staticIp: "",
    simultaneousUse: 1,
    subscriptionMonths: 1,
    amount: 0,
    paymentMethod: "cash" as "cash" | "wallet" | "card" | "bank_transfer" | "online",
  });
  
  // Renew form state
  const [renewData, setRenewData] = useState({
    months: 1,
    amount: 0,
    paymentMethod: "cash" as "cash" | "wallet" | "card" | "bank_transfer" | "online",
    notes: "",
  });
  
  // Queries
  const { data, isLoading, refetch } = trpc.subscribers.list.useQuery();
  const { data: plansData } = trpc.plans.list.useQuery();
  const { data: nasData } = trpc.nas.list.useQuery();
  
  // Mutations
  const createMutation = trpc.subscribers.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المشترك بنجاح");
      setIsCreateDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء إنشاء المشترك");
    },
  });
  
  const suspendMutation = trpc.subscribers.suspend.useMutation({
    onSuccess: () => {
      toast.success("تم إيقاف المشترك");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ");
    },
  });
  
  const activateMutation = trpc.subscribers.activate.useMutation({
    onSuccess: () => {
      toast.success("تم تفعيل المشترك");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ");
    },
  });
  
  const renewMutation = trpc.subscribers.renew.useMutation({
    onSuccess: () => {
      toast.success("تم تجديد الاشتراك بنجاح");
      setIsRenewDialogOpen(false);
      setSelectedSubscriber(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التجديد");
    },
  });
  
  const disconnectMutation = trpc.subscribers.disconnect.useMutation({
    onSuccess: () => {
      toast.success("تم فصل المشترك");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الفصل");
    },
  });
  
  const deleteMutation = trpc.subscribers.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المشترك");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });
  
  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      fullName: "",
      phone: "",
      email: "",
      address: "",
      nationalId: "",
      notes: "",
      planId: 0,
      nasId: undefined,
      ipAssignmentType: "dynamic",
      staticIp: "",
      simultaneousUse: 1,
      subscriptionMonths: 1,
      amount: 0,
      paymentMethod: "cash",
    });
  };
  
  const handleCreate = () => {
    if (!formData.username || !formData.password || !formData.fullName || !formData.planId) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    
    createMutation.mutate({
      ...formData,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      address: formData.address || undefined,
      nationalId: formData.nationalId || undefined,
      notes: formData.notes || undefined,
      staticIp: formData.staticIp || undefined,
    });
  };
  
  const handleRenew = () => {
    if (!selectedSubscriber || renewData.months < 1) {
      toast.error("يرجى تحديد عدد الأشهر");
      return;
    }
    
    renewMutation.mutate({
      id: selectedSubscriber.subscriber.id,
      months: renewData.months,
      amount: renewData.amount,
      paymentMethod: renewData.paymentMethod,
      notes: renewData.notes || undefined,
    });
  };
  
  const openRenewDialog = (sub: any) => {
    setSelectedSubscriber(sub);
    setRenewData({
      months: 1,
      amount: Number(sub.plan?.price || 0),
      paymentMethod: "cash",
      notes: "",
    });
    setIsRenewDialogOpen(true);
  };
  
  // Filter subscribers
  const filteredSubscribers = data?.subscribers?.filter((sub: any) => {
    const matchesSearch = 
      sub.subscriber.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.subscriber.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (sub.subscriber.phone && sub.subscriber.phone.includes(searchQuery));
    
    const matchesStatus = statusFilter === "all" || sub.subscriber.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];
  
  const stats = data?.stats || { total: 0, active: 0, suspended: 0, expired: 0, pending: 0 };
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">نشط</Badge>;
      case "suspended":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">موقوف</Badge>;
      case "expired":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">منتهي</Badge>;
      case "pending":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">معلق</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-SA");
  };
  
  const getDaysRemaining = (endDate: Date | string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">المشتركين الشهريين</h1>
          <p className="text-muted-foreground">إدارة اشتراكات PPPoE للعملاء</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              إضافة مشترك
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>إضافة مشترك جديد</DialogTitle>
              <DialogDescription>
                أدخل بيانات المشترك الجديد لإنشاء حساب PPPoE
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">البيانات الأساسية</TabsTrigger>
                <TabsTrigger value="service">الخدمة</TabsTrigger>
                <TabsTrigger value="payment">الدفع</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>اسم المستخدم (PPPoE) *</Label>
                    <Input
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="مثال: user001"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور *</Label>
                    <Input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="كلمة مرور قوية"
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>الاسم الكامل *</Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="اسم المشترك"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>البريد الإلكتروني</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="email@example.com"
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="عنوان المشترك"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>رقم الهوية</Label>
                  <Input
                    value={formData.nationalId}
                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                    placeholder="رقم الهوية الوطنية"
                    dir="ltr"
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="service" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>الباقة *</Label>
                  <Select
                    value={formData.planId ? String(formData.planId) : ""}
                    onValueChange={(v) => {
                      const plan = plansData?.find((p: any) => p.id === Number(v));
                      setFormData({ 
                        ...formData, 
                        planId: Number(v),
                        amount: plan ? Number(plan.price) : 0
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الباقة" />
                    </SelectTrigger>
                    <SelectContent>
                      {plansData?.map((plan: any) => (
                        <SelectItem key={plan.id} value={String(plan.id)}>
                          {plan.name} - {Math.round(plan.downloadSpeed / 1000)}Mbps / {Math.round(plan.uploadSpeed / 1000)}Mbps - ${plan.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>جهاز NAS (اختياري)</Label>
                  <Select
                    value={formData.nasId ? String(formData.nasId) : "none"}
                    onValueChange={(v) => setFormData({ ...formData, nasId: v === "none" ? undefined : Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="جميع الأجهزة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">جميع الأجهزة</SelectItem>
                      {nasData?.map((nas: any) => (
                        <SelectItem key={nas.id} value={String(nas.id)}>
                          {nas.shortname || nas.nasname}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>نوع IP</Label>
                    <Select
                      value={formData.ipAssignmentType}
                      onValueChange={(v: "dynamic" | "static") => setFormData({ ...formData, ipAssignmentType: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dynamic">ديناميكي (DHCP)</SelectItem>
                        <SelectItem value="static">ثابت (Static)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {formData.ipAssignmentType === "static" && (
                    <div className="space-y-2">
                      <Label>عنوان IP الثابت</Label>
                      <Input
                        value={formData.staticIp}
                        onChange={(e) => setFormData({ ...formData, staticIp: e.target.value })}
                        placeholder="192.168.1.100"
                        dir="ltr"
                      />
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>عدد الاتصالات المتزامنة</Label>
                  <Select
                    value={String(formData.simultaneousUse)}
                    onValueChange={(v) => setFormData({ ...formData, simultaneousUse: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? "اتصال" : "اتصالات"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="ملاحظات إضافية..."
                    rows={3}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="payment" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>مدة الاشتراك</Label>
                    <Select
                      value={String(formData.subscriptionMonths)}
                      onValueChange={(v) => {
                        const months = Number(v);
                        const plan = plansData?.find((p: any) => p.id === formData.planId);
                        setFormData({ 
                          ...formData, 
                          subscriptionMonths: months,
                          amount: plan ? Number(plan.price) * months : 0
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 6, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} {n === 1 ? "شهر" : "أشهر"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>المبلغ</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      dir="ltr"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>طريقة الدفع</Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(v: any) => setFormData({ ...formData, paymentMethod: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقدي</SelectItem>
                      <SelectItem value="wallet">محفظة</SelectItem>
                      <SelectItem value="card">بطاقة</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                      <SelectItem value="online">أونلاين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء المشترك"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المشتركين</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">نشط</CardTitle>
            <UserCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">موقوف</CardTitle>
            <UserX className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{stats.suspended}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">منتهي</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.expired}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
            <SelectItem value="expired">منتهي</SelectItem>
            <SelectItem value="pending">معلق</SelectItem>
          </SelectContent>
        </Select>
        
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Subscribers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المشترك</TableHead>
                <TableHead>الباقة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>انتهاء الاشتراك</TableHead>
                <TableHead>الأيام المتبقية</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    جاري التحميل...
                  </TableCell>
                </TableRow>
              ) : filteredSubscribers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    لا يوجد مشتركين
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubscribers.map((sub: any) => {
                  const daysRemaining = getDaysRemaining(sub.subscriber.subscriptionEndDate);
                  return (
                    <TableRow key={sub.subscriber.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{sub.subscriber.fullName}</span>
                          <span className="text-sm text-muted-foreground" dir="ltr">
                            {sub.subscriber.username}
                          </span>
                          {sub.subscriber.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {sub.subscriber.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.plan ? (
                          <div className="flex flex-col">
                            <span>{sub.plan.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(sub.plan.downloadSpeed / 1000)}/{Math.round(sub.plan.uploadSpeed / 1000)} Mbps
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.subscriber.status)}</TableCell>
                      <TableCell>{formatDate(sub.subscriber.subscriptionEndDate)}</TableCell>
                      <TableCell>
                        {daysRemaining !== null && (
                          <Badge 
                            variant="outline"
                            className={
                              daysRemaining <= 0 
                                ? "text-red-500 border-red-500/30" 
                                : daysRemaining <= 7 
                                  ? "text-yellow-500 border-yellow-500/30"
                                  : "text-green-500 border-green-500/30"
                            }
                          >
                            {daysRemaining <= 0 ? "منتهي" : `${daysRemaining} يوم`}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openRenewDialog(sub)}>
                              <RefreshCw className="h-4 w-4 ml-2" />
                              تجديد الاشتراك
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => disconnectMutation.mutate({ id: sub.subscriber.id })}
                            >
                              <WifiOff className="h-4 w-4 ml-2" />
                              فصل الاتصال
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {sub.subscriber.status === "active" ? (
                              <DropdownMenuItem 
                                onClick={() => suspendMutation.mutate({ id: sub.subscriber.id })}
                                className="text-yellow-500"
                              >
                                <PowerOff className="h-4 w-4 ml-2" />
                                إيقاف
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => activateMutation.mutate({ id: sub.subscriber.id })}
                                className="text-green-500"
                              >
                                <Power className="h-4 w-4 ml-2" />
                                تفعيل
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا المشترك؟")) {
                                  deleteMutation.mutate({ id: sub.subscriber.id });
                                }
                              }}
                              className="text-red-500"
                            >
                              <Trash2 className="h-4 w-4 ml-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Renew Dialog */}
      <Dialog open={isRenewDialogOpen} onOpenChange={setIsRenewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تجديد الاشتراك</DialogTitle>
            <DialogDescription>
              تجديد اشتراك: {selectedSubscriber?.subscriber?.fullName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>مدة التجديد</Label>
              <Select
                value={String(renewData.months)}
                onValueChange={(v) => {
                  const months = Number(v);
                  const price = Number(selectedSubscriber?.plan?.price || 0);
                  setRenewData({ ...renewData, months, amount: price * months });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? "شهر" : "أشهر"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={renewData.amount}
                onChange={(e) => setRenewData({ ...renewData, amount: Number(e.target.value) })}
                dir="ltr"
              />
            </div>
            
            <div className="space-y-2">
              <Label>طريقة الدفع</Label>
              <Select
                value={renewData.paymentMethod}
                onValueChange={(v: any) => setRenewData({ ...renewData, paymentMethod: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">نقدي</SelectItem>
                  <SelectItem value="wallet">محفظة</SelectItem>
                  <SelectItem value="card">بطاقة</SelectItem>
                  <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                  <SelectItem value="online">أونلاين</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={renewData.notes}
                onChange={(e) => setRenewData({ ...renewData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenewDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleRenew} disabled={renewMutation.isPending}>
              {renewMutation.isPending ? "جاري التجديد..." : "تجديد الاشتراك"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
