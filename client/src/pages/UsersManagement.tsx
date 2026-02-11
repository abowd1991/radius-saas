import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  Trash2,
  Calendar,
  RefreshCw,
  Shield,
  Store,
  User,
  Mail,
  Phone,
  Building,
  CreditCard,
  Server,
  Activity,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type UserStatus = "all" | "trial" | "active" | "expired" | "suspended";
type UserRole = "all" | "owner" | "super_admin" | "client_admin" | "reseller" | "client" | "support";

// Helper function to generate random password
function generateRandomPassword(): string {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export default function UsersManagement() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<UserStatus>("all");
  const [roleFilter, setRoleFilter] = useState<UserRole>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: "", email: "", password: "", role: "client" as "client" | "reseller" });
  const [newPassword, setNewPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<any>(null);

  // Fetch all users
  const { data: allUsers, isLoading, refetch } = trpc.users.list.useQuery({});

  // Fetch SaaS plans for plan names
  const { data: saasPlans } = trpc.saasPlans.getAllAdmin.useQuery();

  // Mutations
  const suspendMutation = trpc.users.suspendClient.useMutation({
    onSuccess: () => {
      toast.success("تم تعليق الحساب بنجاح");
      refetch();
      setSelectedUser(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const activateMutation = trpc.users.activateClient.useMutation({
    onSuccess: () => {
      toast.success("تم تفعيل الحساب بنجاح");
      refetch();
      setSelectedUser(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const extendMutation = trpc.users.extendSubscription.useMutation({
    onSuccess: () => {
      toast.success(`تم تمديد الاشتراك ${extendDays} يوم`);
      refetch();
      setShowExtendDialog(false);
      setSelectedUser(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("تم حذف المستخدم بنجاح");
      refetch();
      setShowDeleteDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const changeRoleMutation = trpc.users.changeRole.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير الدور بنجاح");
      refetch();
      setShowRoleDialog(false);
      setSelectedUser(null);
    },
    onError: (error: any) => toast.error(error.message),
  });

  const createClientMutation = trpc.users.createClientByAdmin.useMutation({
    onSuccess: (data) => {
      setCreatedCredentials(data);
      toast.success("تم إنشاء العميل بنجاح");
      refetch();
      setNewClientData({ name: "", email: "", password: "", role: "client" });
    },
    onError: (error: any) => toast.error(error.message),
  });

  const changePasswordMutation = trpc.users.changeClientPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setShowPasswordDialog(false);
      setSelectedUser(null);
      setNewPassword("");
    },
    onError: (error: any) => toast.error(error.message),
  });

  // Filter users
  const filteredUsers = allUsers?.filter((u: any) => {
    // Role filter
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  // Stats
  const stats = {
    total: allUsers?.length || 0,
    trial: allUsers?.filter((u: any) => u.accountStatus === "trial").length || 0,
    active: allUsers?.filter((u: any) => u.accountStatus === "active").length || 0,
    expired: allUsers?.filter((u: any) => u.accountStatus === "expired").length || 0,
    suspended: allUsers?.filter((u: any) => u.accountStatus === "suspended").length || 0,
    incomplete: allUsers?.filter((u: any) => !u.name || !u.email).length || 0,
    clients: allUsers?.filter((u: any) => u.role === "client").length || 0,
    resellers: allUsers?.filter((u: any) => u.role === "reseller").length || 0,
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">تجريبي</Badge>;
      case "active":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">نشط</Badge>;
      case "expired":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">منتهي</Badge>;
      case "suspended":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">موقوف</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">غير معروف</Badge>;
    }
  };

  // Get role badge
  const getRoleBadge = (role: string) => {
    switch (role) {
      case "client":
        return <Badge variant="outline" className="border-purple-500/30 text-purple-400">عميل</Badge>;
      case "reseller":
        return <Badge variant="outline" className="border-orange-500/30 text-orange-400">موزع</Badge>;
      case "super_admin":
        return <Badge variant="outline" className="border-red-500/30 text-red-400">مدير</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  // Calculate days remaining
  const getDaysRemaining = (user: any) => {
    if (!user.subscriptionEndDate && !user.trialEndDate) return null;
    const endDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : new Date(user.trialEndDate);
    const now = new Date();
    const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Format date
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("ar-SA");
  };

  // Get plan name
  const getPlanName = (planId: number | null) => {
    if (!planId || !saasPlans) return "-";
    const plan = saasPlans.find((p: any) => p.id === planId);
    return plan?.name || "-";
  };

  if (user?.role !== "super_admin" && user?.role !== "owner") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-slate-400">غير مصرح لك بالوصول لهذه الصفحة</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">إدارة المستخدمين</h1>
            <p className="text-slate-400 mt-1">عرض وإدارة جميع المستخدمين في النظام</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <User className="h-4 w-4 ml-2" />
              إنشاء عميل جديد
            </Button>
            <Button onClick={() => refetch()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <Users className="h-5 w-5 text-slate-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-slate-400">إجمالي</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.trial}</p>
                  <p className="text-xs text-slate-400">تجريبي</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <UserCheck className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                  <p className="text-xs text-slate-400">نشط</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <UserX className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.expired}</p>
                  <p className="text-xs text-slate-400">منتهي</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/20 rounded-lg">
                  <Ban className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats.suspended}</p>
                  <p className="text-xs text-slate-400">موقوف</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {stats.incomplete > 0 && (
            <Card className="bg-red-900/20 border-red-500/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-400">{stats.incomplete}</p>
                    <p className="text-xs text-red-400">ناقص بيانات</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="بحث بالاسم أو البريد أو اسم المستخدم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10 bg-slate-700/50 border-slate-600 text-white"
                />
              </div>
              
              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as UserRole)}>
                <SelectTrigger className="w-[150px] bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="owner">مالك النظام</SelectItem>
                  <SelectItem value="super_admin">مدير النظام</SelectItem>
                  <SelectItem value="client_admin">مدير عميل</SelectItem>
                  <SelectItem value="reseller">موزع</SelectItem>
                  <SelectItem value="client">عميل</SelectItem>
                  <SelectItem value="support">دعم فني</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UserStatus)}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-slate-700">
              الكل ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="trial" className="data-[state=active]:bg-blue-600">
              تجريبي ({stats.trial})
            </TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-green-600">
              نشط ({stats.active})
            </TabsTrigger>
            <TabsTrigger value="expired" className="data-[state=active]:bg-red-600">
              منتهي ({stats.expired})
            </TabsTrigger>
            <TabsTrigger value="suspended" className="data-[state=active]:bg-yellow-600">
              موقوف ({stats.suspended})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-12 text-center">
                    <Users className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                    <p className="text-slate-400">لا يوجد مستخدمين</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400">الاسم</TableHead>
                        <TableHead className="text-slate-400">البريد</TableHead>
                        <TableHead className="text-slate-400">الدور</TableHead>
                        <TableHead className="text-slate-400">الحالة</TableHead>
                        <TableHead className="text-slate-400">الخطة</TableHead>
                        <TableHead className="text-slate-400">الأيام المتبقية</TableHead>
                        <TableHead className="text-slate-400">آخر دخول</TableHead>
                        <TableHead className="text-slate-400 text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u: any) => {
                        const daysRemaining = getDaysRemaining(u);
                        const isIncomplete = !u.name || !u.email;
                        
                        return (
                          <TableRow 
                            key={u.id} 
                            className={`border-slate-700 hover:bg-slate-700/30 ${isIncomplete ? 'bg-red-900/10' : ''}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {isIncomplete && (
                                  <AlertTriangle className="h-4 w-4 text-red-400" />
                                )}
                                <span className="text-white font-medium">
                                  {u.name || <span className="text-red-400 italic">بدون اسم</span>}
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">@{u.username}</span>
                            </TableCell>
                            <TableCell>
                              {u.email ? (
                                <span className="text-slate-300">{u.email}</span>
                              ) : (
                                <span className="text-red-400 italic">بدون بريد</span>
                              )}
                            </TableCell>
                            <TableCell>{getRoleBadge(u.role)}</TableCell>
                            <TableCell>{getStatusBadge(u.accountStatus)}</TableCell>
                            <TableCell>
                              <span className="text-slate-300">{getPlanName(u.subscriptionPlanId)}</span>
                            </TableCell>
                            <TableCell>
                              {daysRemaining !== null ? (
                                <span className={`font-medium ${
                                  daysRemaining <= 0 ? 'text-red-400' :
                                  daysRemaining <= 3 ? 'text-yellow-400' :
                                  'text-green-400'
                                }`}>
                                  {daysRemaining <= 0 ? 'منتهي' : `${daysRemaining} يوم`}
                                </span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-slate-400 text-sm">
                                {formatDate(u.lastLoginAt)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setShowDetailsDialog(true);
                                    }}
                                    className="text-slate-200 focus:bg-slate-700"
                                  >
                                    <Eye className="h-4 w-4 ml-2" />
                                    عرض التفاصيل
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setShowExtendDialog(true);
                                    }}
                                    className="text-slate-200 focus:bg-slate-700"
                                  >
                                    <Calendar className="h-4 w-4 ml-2" />
                                    تمديد الاشتراك
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  {u.accountStatus === "suspended" ? (
                                    <DropdownMenuItem
                                      onClick={() => activateMutation.mutate({ userId: u.id })}
                                      className="text-green-400 focus:bg-slate-700"
                                    >
                                      <UserCheck className="h-4 w-4 ml-2" />
                                      تفعيل الحساب
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => suspendMutation.mutate({ userId: u.id })}
                                      className="text-yellow-400 focus:bg-slate-700"
                                    >
                                      <Ban className="h-4 w-4 ml-2" />
                                      تعليق الحساب
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setNewRole(u.role || "");
                                      setShowRoleDialog(true);
                                    }}
                                    className="text-blue-400 focus:bg-slate-700"
                                  >
                                    <Shield className="h-4 w-4 ml-2" />
                                    تغيير الدور
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setNewPassword("");
                                      setShowPasswordDialog(true);
                                    }}
                                    className="text-purple-400 focus:bg-slate-700"
                                  >
                                    <CreditCard className="h-4 w-4 ml-2" />
                                    تغيير كلمة المرور
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-700" />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setShowDeleteDialog(true);
                                    }}
                                    className="text-red-400 focus:bg-slate-700"
                                  >
                                    <Trash2 className="h-4 w-4 ml-2" />
                                    حذف المستخدم
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">تفاصيل المستخدم</DialogTitle>
              <DialogDescription className="text-slate-400">
                معلومات تفصيلية عن {selectedUser?.name || selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">الاسم الكامل</Label>
                    <p className="text-white">{selectedUser.name || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">اسم المستخدم</Label>
                    <p className="text-white">@{selectedUser.username}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">البريد الإلكتروني</Label>
                    <p className="text-white">{selectedUser.email || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">رقم الهاتف</Label>
                    <p className="text-white">{selectedUser.phone || "-"}</p>
                  </div>
                </div>

                {/* Status Info */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-900/50 rounded-lg">
                  <div className="text-center">
                    <p className="text-slate-400 text-xs mb-1">الدور</p>
                    {getRoleBadge(selectedUser.role)}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs mb-1">الحالة</p>
                    {getStatusBadge(selectedUser.accountStatus)}
                  </div>
                  <div className="text-center">
                    <p className="text-slate-400 text-xs mb-1">الخطة</p>
                    <span className="text-white">{getPlanName(selectedUser.subscriptionPlanId)}</span>
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">تاريخ التسجيل</Label>
                    <p className="text-white">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">آخر دخول</Label>
                    <p className="text-white">{formatDate(selectedUser.lastLoginAt)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">بداية التجربة</Label>
                    <p className="text-white">{formatDate(selectedUser.trialStartDate)}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-slate-400 text-xs">نهاية الاشتراك</Label>
                    <p className="text-white">{formatDate(selectedUser.subscriptionEndDate || selectedUser.trialEndDate)}</p>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700">
                    <CardContent className="p-3 text-center">
                      <Server className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{selectedUser.nasCount || 0}</p>
                      <p className="text-xs text-slate-400">أجهزة NAS</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-700">
                    <CardContent className="p-3 text-center">
                      <CreditCard className="h-5 w-5 text-green-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{selectedUser.cardsCount || 0}</p>
                      <p className="text-xs text-slate-400">الكروت</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-700">
                    <CardContent className="p-3 text-center">
                      <Activity className="h-5 w-5 text-purple-400 mx-auto mb-1" />
                      <p className="text-lg font-bold text-white">{selectedUser.activeSessionsCount || 0}</p>
                      <p className="text-xs text-slate-400">جلسات نشطة</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Extend Dialog */}
        <Dialog open={showExtendDialog} onOpenChange={setShowExtendDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">تمديد الاشتراك</DialogTitle>
              <DialogDescription className="text-slate-400">
                تمديد اشتراك {selectedUser?.name || selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">عدد الأيام</Label>
                <Select value={extendDays.toString()} onValueChange={(v) => setExtendDays(parseInt(v))}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 أيام</SelectItem>
                    <SelectItem value="14">14 يوم</SelectItem>
                    <SelectItem value="30">30 يوم (شهر)</SelectItem>
                    <SelectItem value="90">90 يوم (3 أشهر)</SelectItem>
                    <SelectItem value="180">180 يوم (6 أشهر)</SelectItem>
                    <SelectItem value="365">365 يوم (سنة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExtendDialog(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => selectedUser && extendMutation.mutate({ userId: selectedUser.id, days: extendDays })}
                disabled={extendMutation.isPending}
              >
                {extendMutation.isPending ? "جارٍ التمديد..." : "تمديد"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Role Dialog */}
        <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">تغيير الدور</DialogTitle>
              <DialogDescription className="text-slate-400">
                تغيير دور المستخدم {selectedUser?.name || selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">الدور الجديد</Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="اختر الدور" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">مالك النظام (Owner)</SelectItem>
                    <SelectItem value="super_admin">مدير النظام (Super Admin)</SelectItem>
                    <SelectItem value="client_admin">مدير عميل (Client Admin)</SelectItem>
                    <SelectItem value="reseller">موزع (Reseller)</SelectItem>
                    <SelectItem value="client">عميل (Client)</SelectItem>
                    <SelectItem value="support">دعم فني (Support)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-slate-400 space-y-1">
                <p><strong>عميل:</strong> صلاحيات محدودة لإدارة شبكته فقط</p>
                <p><strong>موزع:</strong> يمكنه إنشاء كروت وإدارة عملائه</p>
                <p><strong>مدير:</strong> صلاحيات كاملة على النظام</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => selectedUser && newRole && changeRoleMutation.mutate({ userId: selectedUser.id, role: newRole as any })}
                disabled={changeRoleMutation.isPending || !newRole}
              >
                {changeRoleMutation.isPending ? "جارٍ التغيير..." : "تغيير الدور"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Client Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setCreatedCredentials(null);
            setNewClientData({ name: "", email: "", password: "", role: "client" });
          }
        }}>
          <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">إنشاء عميل جديد</DialogTitle>
              <DialogDescription className="text-slate-400">
                إنشاء حساب عميل جديد من قبل المدير
              </DialogDescription>
            </DialogHeader>
            {createdCredentials ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                  <h3 className="text-green-400 font-semibold mb-3">✅ تم إنشاء العميل بنجاح!</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">الاسم:</span>
                      <span className="text-white">{newClientData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">البريد الإلكتروني:</span>
                      <span className="text-white">{createdCredentials.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">اسم المستخدم:</span>
                      <span className="text-white">{createdCredentials.username}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">كلمة المرور:</span>
                      <div className="flex gap-2 items-center">
                        <span className="text-white font-mono bg-slate-900 px-2 py-1 rounded">{createdCredentials.password}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(createdCredentials.password);
                            toast.success("تم نسخ كلمة المرور");
                          }}
                        >
                          نسخ
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-yellow-400 text-xs mt-3">⚠️ احفظ كلمة المرور الآن! لن تتمكن من رؤيتها مرة أخرى.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-200">الاسم</Label>
                  <Input
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="اسم العميل"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="email@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">كلمة المرور (اختياري)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={newClientData.password}
                      onChange={(e) => setNewClientData({ ...newClientData, password: e.target.value })}
                      className="bg-slate-700/50 border-slate-600 text-white"
                      placeholder="اتركه فارغاً للتوليد التلقائي"
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        const randomPass = generateRandomPassword();
                        setNewClientData({ ...newClientData, password: randomPass });
                        toast.success("تم توليد كلمة مرور عشوائية");
                      }}
                    >
                      توليد
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400">سيتم توليد كلمة مرور عشوائية قوية إذا تركت الحقل فارغاً</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">الدور</Label>
                  <Select value={newClientData.role} onValueChange={(val: "client" | "reseller") => setNewClientData({ ...newClientData, role: val })}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">عميل (Client)</SelectItem>
                      <SelectItem value="reseller">موزع (Reseller)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              {createdCredentials ? (
                <Button onClick={() => {
                  setShowCreateDialog(false);
                  setCreatedCredentials(null);
                  setNewClientData({ name: "", email: "", password: "", role: "client" });
                }}>
                  إغلاق
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    إلغاء
                  </Button>
                  <Button
                    onClick={() => createClientMutation.mutate(newClientData)}
                    disabled={createClientMutation.isPending || !newClientData.name || !newClientData.email}
                  >
                    {createClientMutation.isPending ? "جارٍ الإنشاء..." : "إنشاء"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
          <DialogContent className="bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">تغيير كلمة المرور</DialogTitle>
              <DialogDescription className="text-slate-400">
                تغيير كلمة مرور المستخدم {selectedUser?.name || selectedUser?.username}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-200">كلمة المرور الجديدة</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-700/50 border-slate-600 text-white"
                    placeholder="أدخل كلمة المرور الجديدة"
                  />
                  <Button
                    variant="outline"
                    onClick={() => {
                      const randomPass = generateRandomPassword();
                      setNewPassword(randomPass);
                      toast.success("تم توليد كلمة مرور عشوائية");
                    }}
                  >
                    توليد
                  </Button>
                </div>
                <p className="text-xs text-slate-400">يجب أن تكون كلمة المرور 8 أحرف على الأقل</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                إلغاء
              </Button>
              <Button
                onClick={() => selectedUser && newPassword && changePasswordMutation.mutate({ userId: selectedUser.id, newPassword })}
                disabled={changePasswordMutation.isPending || !newPassword || newPassword.length < 8}
              >
                {changePasswordMutation.isPending ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-slate-800 border-slate-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                هل أنت متأكد من حذف المستخدم "{selectedUser?.name || selectedUser?.username}"؟
                <br />
                <span className="text-red-400 font-medium">
                  سيتم حذف جميع بياناته بما في ذلك أجهزة NAS والكروت والجلسات.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-700 text-white hover:bg-slate-600">
                إلغاء
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedUser && deleteMutation.mutate({ userId: selectedUser.id })}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "جارٍ الحذف..." : "حذف"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
