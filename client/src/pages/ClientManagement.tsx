import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { trpc } from "@/lib/trpc";
import { 
  Users, 
  Search, 
  MoreVertical, 
  Play, 
  Pause, 
  Clock, 
  Crown, 
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  CreditCard,
  Activity
} from "lucide-react";
import { toast } from "sonner";

export default function ClientManagement() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  
  // Dialogs
  const [activateDialog, setActivateDialog] = useState<{ open: boolean; userId: number | null; userName: string }>({ open: false, userId: null, userName: "" });
  const [extendDialog, setExtendDialog] = useState<{ open: boolean; userId: number | null; userName: string }>({ open: false, userId: null, userName: "" });
  const [changePlanDialog, setChangePlanDialog] = useState<{ open: boolean; userId: number | null; userName: string }>({ open: false, userId: null, userName: "" });
  const [detailsDialog, setDetailsDialog] = useState<{ open: boolean; userId: number | null }>({ open: false, userId: null });
  
  // Form states
  const [activateDays, setActivateDays] = useState(30);
  const [activatePlanId, setActivatePlanId] = useState<number | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [newPlanId, setNewPlanId] = useState<number | null>(null);

  // Queries
  const { data: clientsData, isLoading, refetch } = trpc.users.getClientsWithSubscription.useQuery({
    status: statusFilter as any,
    search: search || undefined,
    page,
    limit: 20,
  });

  const { data: plans } = trpc.saasPlans.getAll.useQuery();
  const { data: clientDetails } = trpc.users.getClientDetails.useQuery(
    { userId: detailsDialog.userId! },
    { enabled: !!detailsDialog.userId }
  );

  // Mutations
  const activateMutation = trpc.users.activateClient.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تفعيل العميل بنجاح" : "Client activated successfully");
      setActivateDialog({ open: false, userId: null, userName: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const suspendMutation = trpc.users.suspendClient.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تعليق العميل بنجاح" : "Client suspended successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const extendMutation = trpc.users.extendSubscription.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ar" 
        ? `تم تمديد الاشتراك حتى ${new Date(data.newEndDate).toLocaleDateString()}` 
        : `Subscription extended until ${new Date(data.newEndDate).toLocaleDateString()}`
      );
      setExtendDialog({ open: false, userId: null, userName: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const changePlanMutation = trpc.users.changeClientPlan.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ar" 
        ? `تم تغيير الخطة إلى ${data.planName}` 
        : `Plan changed to ${data.planName}`
      );
      setChangePlanDialog({ open: false, userId: null, userName: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Access control
  if (user?.role !== "super_admin") {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {language === "ar" ? "غير مصرح لك بالوصول لهذه الصفحة" : "You are not authorized to access this page"}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "trial":
        return <Badge className="bg-blue-500">{language === "ar" ? "تجريبي" : "Trial"}</Badge>;
      case "active":
        return <Badge className="bg-green-500">{language === "ar" ? "نشط" : "Active"}</Badge>;
      case "expired":
        return <Badge variant="destructive">{language === "ar" ? "منتهي" : "Expired"}</Badge>;
      case "suspended":
        return <Badge variant="outline" className="border-red-500 text-red-500">{language === "ar" ? "معلق" : "Suspended"}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6" />
              {language === "ar" ? "إدارة العملاء" : "Client Management"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "التحكم الكامل بحسابات العملاء والاشتراكات" : "Full control over client accounts and subscriptions"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي العملاء" : "Total Clients"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clientsData?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-500">{language === "ar" ? "تجريبي" : "Trial"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                {clientsData?.clients?.filter((c: any) => c.accountStatus === "trial").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-500">{language === "ar" ? "نشط" : "Active"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {clientsData?.clients?.filter((c: any) => c.accountStatus === "active").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-500">{language === "ar" ? "منتهي/معلق" : "Expired/Suspended"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {clientsData?.clients?.filter((c: any) => c.accountStatus === "expired" || c.accountStatus === "suspended").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="trial">{language === "ar" ? "تجريبي" : "Trial"}</SelectItem>
                  <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                  <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
                  <SelectItem value="suspended">{language === "ar" ? "معلق" : "Suspended"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Clients Table */}
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "قائمة العملاء" : "Clients List"}</CardTitle>
            <CardDescription>
              {language === "ar" 
                ? `عرض ${clientsData?.clients?.length || 0} من ${clientsData?.total || 0} عميل`
                : `Showing ${clientsData?.clients?.length || 0} of ${clientsData?.total || 0} clients`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "العميل" : "Client"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "الخطة" : "Plan"}</TableHead>
                    <TableHead>{language === "ar" ? "الأيام المتبقية" : "Days Left"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ التسجيل" : "Registered"}</TableHead>
                    <TableHead className="text-right">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientsData?.clients?.map((client: any) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.name || client.username}</div>
                          <div className="text-sm text-muted-foreground">{client.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(client.accountStatus || "active")}</TableCell>
                      <TableCell>
                        {client.planName ? (
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Crown className="h-3 w-3" />
                            {client.planName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.daysRemaining !== null ? (
                          <span className={client.daysRemaining <= 3 ? "text-red-500 font-medium" : ""}>
                            {client.daysRemaining} {language === "ar" ? "يوم" : "days"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{formatDate(client.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailsDialog({ open: true, userId: client.id })}>
                              <Eye className="h-4 w-4 mr-2" />
                              {language === "ar" ? "عرض التفاصيل" : "View Details"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {client.accountStatus !== "active" && (
                              <DropdownMenuItem onClick={() => setActivateDialog({ open: true, userId: client.id, userName: client.name || client.username })}>
                                <Play className="h-4 w-4 mr-2 text-green-500" />
                                {language === "ar" ? "تفعيل الحساب" : "Activate Account"}
                              </DropdownMenuItem>
                            )}
                            {client.accountStatus === "active" && (
                              <DropdownMenuItem onClick={() => suspendMutation.mutate({ userId: client.id })}>
                                <Pause className="h-4 w-4 mr-2 text-red-500" />
                                {language === "ar" ? "تعليق الحساب" : "Suspend Account"}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setExtendDialog({ open: true, userId: client.id, userName: client.name || client.username })}>
                              <Clock className="h-4 w-4 mr-2" />
                              {language === "ar" ? "تمديد الاشتراك" : "Extend Subscription"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setChangePlanDialog({ open: true, userId: client.id, userName: client.name || client.username })}>
                              <Crown className="h-4 w-4 mr-2" />
                              {language === "ar" ? "تغيير الخطة" : "Change Plan"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {clientsData && clientsData.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  {language === "ar" ? "السابق" : "Previous"}
                </Button>
                <span className="flex items-center px-4">
                  {page} / {clientsData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === clientsData.totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  {language === "ar" ? "التالي" : "Next"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activate Dialog */}
      <Dialog open={activateDialog.open} onOpenChange={(open) => setActivateDialog({ ...activateDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تفعيل الحساب" : "Activate Account"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `تفعيل حساب ${activateDialog.userName}`
                : `Activate account for ${activateDialog.userName}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "مدة الاشتراك (أيام)" : "Subscription Duration (days)"}</Label>
              <Input
                type="number"
                value={activateDays}
                onChange={(e) => setActivateDays(Number(e.target.value))}
                min={1}
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الخطة (اختياري)" : "Plan (optional)"}</Label>
              <Select value={activatePlanId?.toString() || ""} onValueChange={(v) => setActivatePlanId(v ? Number(v) : null)}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر خطة" : "Select a plan"} />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name} - ${plan.price}/{language === "ar" ? "شهر" : "month"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog({ open: false, userId: null, userName: "" })}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => activateDialog.userId && activateMutation.mutate({ 
                userId: activateDialog.userId, 
                durationDays: activateDays,
                planId: activatePlanId || undefined
              })}
              disabled={activateMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {language === "ar" ? "تفعيل" : "Activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={extendDialog.open} onOpenChange={(open) => setExtendDialog({ ...extendDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تمديد الاشتراك" : "Extend Subscription"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `تمديد اشتراك ${extendDialog.userName}`
                : `Extend subscription for ${extendDialog.userName}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "عدد الأيام" : "Number of Days"}</Label>
              <Input
                type="number"
                value={extendDays}
                onChange={(e) => setExtendDays(Number(e.target.value))}
                min={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendDialog({ open: false, userId: null, userName: "" })}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => extendDialog.userId && extendMutation.mutate({ 
                userId: extendDialog.userId, 
                days: extendDays 
              })}
              disabled={extendMutation.isPending}
            >
              <Clock className="h-4 w-4 mr-2" />
              {language === "ar" ? "تمديد" : "Extend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={changePlanDialog.open} onOpenChange={(open) => setChangePlanDialog({ ...changePlanDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تغيير الخطة" : "Change Plan"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `تغيير خطة ${changePlanDialog.userName}`
                : `Change plan for ${changePlanDialog.userName}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الخطة الجديدة" : "New Plan"}</Label>
              <Select value={newPlanId?.toString() || ""} onValueChange={(v) => setNewPlanId(Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر خطة" : "Select a plan"} />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      {plan.name} - ${plan.price}/{language === "ar" ? "شهر" : "month"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePlanDialog({ open: false, userId: null, userName: "" })}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => changePlanDialog.userId && newPlanId && changePlanMutation.mutate({ 
                userId: changePlanDialog.userId, 
                planId: newPlanId 
              })}
              disabled={changePlanMutation.isPending || !newPlanId}
            >
              <Crown className="h-4 w-4 mr-2" />
              {language === "ar" ? "تغيير" : "Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => setDetailsDialog({ ...detailsDialog, open })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تفاصيل العميل" : "Client Details"}</DialogTitle>
          </DialogHeader>
          {clientDetails && (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">{language === "ar" ? "الاسم" : "Name"}</Label>
                  <p className="font-medium">{clientDetails.user.name || clientDetails.user.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{language === "ar" ? "البريد" : "Email"}</Label>
                  <p className="font-medium">{clientDetails.user.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</Label>
                  <div className="mt-1">{getStatusBadge((clientDetails.user as any).accountStatus || "active")}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">{language === "ar" ? "الخطة" : "Plan"}</Label>
                  <p className="font-medium">{clientDetails.plan?.name || "-"}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{language === "ar" ? "أجهزة NAS" : "NAS Devices"}</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{clientDetails.stats.nasCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{language === "ar" ? "الكروت" : "Cards"}</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{clientDetails.stats.cardsCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{language === "ar" ? "جلسات نشطة" : "Active Sessions"}</span>
                    </div>
                    <p className="text-2xl font-bold mt-1">{clientDetails.stats.activeSessions}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Plan Limits */}
              {clientDetails.plan && (
                <div>
                  <Label className="text-muted-foreground">{language === "ar" ? "حدود الخطة" : "Plan Limits"}</Label>
                  <div className="grid grid-cols-3 gap-4 mt-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">{language === "ar" ? "الحد الأقصى NAS:" : "Max NAS:"}</span>
                      <span className="font-medium ml-2">{clientDetails.plan.maxNasDevices}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{language === "ar" ? "الحد الأقصى كروت:" : "Max Cards:"}</span>
                      <span className="font-medium ml-2">{clientDetails.plan.maxCards}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{language === "ar" ? "الحد الأقصى مشتركين:" : "Max Subscribers:"}</span>
                      <span className="font-medium ml-2">{clientDetails.plan.maxSubscribers}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
