import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Search,
  User,
  Mail,
  Phone,
  Wallet,
  Activity,
  Ban,
  CheckCircle,
  CreditCard,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import { useSorting } from "@/hooks/useSorting";
import { DataPagination } from "@/components/ui/data-pagination";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function Clients() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<any>(null);
  const [changePlanClient, setChangePlanClient] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  // Fetch clients
  const { data: clients, isLoading, refetch } = trpc.users.list.useQuery({
    role: "client",
    search: searchQuery || undefined,
  });

  // Sorting
  const { sortedData: sortedClients, sortColumn, sortDirection, handleSort } = useSorting(
    clients,
    "createdAt",
    "desc"
  );

  // Pagination
  const {
    paginatedData: paginatedClients,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(sortedClients, 15);

  // Mutations
  const createClient = trpc.users.createClientByAdmin.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إنشاء العميل بنجاح" : "Client created successfully");
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateClientMutation = {
    mutate: (data: any) => {
      toast.info(language === "ar" ? "سيتم إضافة هذه الميزة قريباً" : "This feature will be added soon");
      setEditingClient(null);
    },
    isPending: false,
  };
  const updateClient = updateClientMutation;

  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم حذف المستخدم بنجاح" : "User deleted successfully");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Fetch Permission Plans for plan change
  const { data: permissionPlans } = trpc.permissionPlans.list.useQuery();

  const changeClientPlan = trpc.users.changeClientPlan.useMutation({
    onSuccess: (data: any) => {
      toast.success(language === "ar" ? `تم تغيير الخطة إلى ${data.planName}` : `Plan changed to ${data.planName}`);
      setChangePlanClient(null);
      setSelectedPlanId("");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const toggleStatus = trpc.users.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الحالة" : "Status updated");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-500">{t("common.active")}</Badge>;
      case "inactive":
        return <Badge variant="secondary">{t("common.inactive")}</Badge>;
      case "suspended":
        return <Badge variant="destructive">{t("common.suspended")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string || undefined,
      address: formData.get("address") as string || undefined,
      role: "client" as const,
    };

    if (editingClient) {
      updateClient.mutate({ id: editingClient.id, ...data });
    } else {
      createClient.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.clients")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة العملاء والمشتركين" : "Manage clients and subscribers"}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
              {language === "ar" ? "إضافة عميل" : "Add Client"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة عميل جديد" : "Add New Client"}</DialogTitle>
              <DialogDescription>
                {language === "ar" ? "أدخل بيانات العميل الجديد" : "Enter the new client's information"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("common.name")}</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("common.email")}</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("common.phone")}</Label>
                  <Input id="phone" name="phone" type="tel" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{language === "ar" ? "العنوان" : "Address"}</Label>
                  <Input id="address" name="address" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createClient.isPending}>
                  {createClient.isPending ? (language === "ar" ? "جاري الإنشاء..." : "Creating...") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${direction === "rtl" ? "right-3" : "left-3"}`} />
            <Input
              placeholder={language === "ar" ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={direction === "rtl" ? "pr-9" : "pl-9"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Clients Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <SortableTableHead
                  column="name"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {t("common.name")}
                </SortableTableHead>
                <SortableTableHead
                  column="email"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {t("common.email")}
                </SortableTableHead>
                <TableHead className="font-semibold">{t("common.phone")}</TableHead>
                <SortableTableHead
                  column="walletBalance"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {t("wallet.balance")}
                </SortableTableHead>
                <SortableTableHead
                  column="status"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {t("common.status")}
                </SortableTableHead>
                <SortableTableHead
                  column="createdAt"
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                >
                  {t("common.created_at")}
                </SortableTableHead>
                <TableHead className="w-[70px] font-semibold">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
              ) : paginatedClients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا يوجد عملاء" : "No clients found"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients?.map((client: any) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {client.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {client.phone}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        {formatCurrency(client.walletBalance || "0")}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(client.status)}</TableCell>
                    <TableCell>{formatDate(client.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={direction === "rtl" ? "start" : "end"}>
                          <DropdownMenuItem onClick={() => setEditingClient(client)}>
                            <Edit className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(language === "ar" ? "قريباً" : "Coming soon")}>
                            <Activity className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "عرض الاشتراكات" : "View Subscriptions"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setChangePlanClient(client);
                            setSelectedPlanId(client.permissionPlanId?.toString() || "");
                          }}>
                            <CreditCard className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "تغيير الخطة" : "Change Plan"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {client.status === "active" ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => toggleStatus.mutate({ userId: client.id, status: "suspended" })}
                            >
                              <Ban className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "إيقاف" : "Suspend"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => toggleStatus.mutate({ userId: client.id, status: "active" })}
                            >
                              <CheckCircle className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "تفعيل" : "Activate"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (window.confirm(language === "ar" ? "هل أنت متأكد من حذف هذا المستخدم؟" : "Are you sure you want to delete this user?")) {
                                deleteUser.mutate({ userId: client.id });
                              }
                            }}
                          >
                            <Trash2 className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "حذف" : "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {/* Pagination */}
          {totalPages > 1 && (
            <DataPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanClient} onOpenChange={(open) => { if (!open) { setChangePlanClient(null); setSelectedPlanId(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تغيير خطة العميل" : "Change Client Plan"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? `تغيير خطة الاشتراك للعميل ${changePlanClient?.name || changePlanClient?.username}`
                : `Change subscription plan for ${changePlanClient?.name || changePlanClient?.username}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الخطة الحالية" : "Current Plan"}</Label>
              <p className="text-sm text-muted-foreground">
                {changePlanClient?.planName || (language === "ar" ? "بدون خطة" : "No plan")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الخطة الجديدة" : "New Plan"}</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder={language === "ar" ? "اختر خطة" : "Select a plan"} />
                </SelectTrigger>
                <SelectContent>
                  {permissionPlans?.map((plan: any) => (
                    <SelectItem key={plan.id} value={plan.id.toString()}>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{language === "ar" ? (plan.nameAr || plan.name) : plan.name}</span>
                        {plan.description && (
                          <span className="text-xs text-muted-foreground">{plan.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangePlanClient(null); setSelectedPlanId(""); }}>
              {t("common.cancel")}
            </Button>
            <Button 
              onClick={() => {
                if (selectedPlanId && changePlanClient) {
                  changeClientPlan.mutate({ userId: changePlanClient.id, planId: parseInt(selectedPlanId) });
                }
              }}
              disabled={!selectedPlanId || changeClientPlan.isPending}
            >
              {changeClientPlan.isPending 
                ? (language === "ar" ? "جاري التغيير..." : "Changing...") 
                : (language === "ar" ? "تغيير الخطة" : "Change Plan")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل العميل" : "Edit Client"}</DialogTitle>
          </DialogHeader>
          {editingClient && (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{t("common.name")}</Label>
                  <Input id="edit-name" name="name" defaultValue={editingClient.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">{t("common.email")}</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingClient.email} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">{t("common.phone")}</Label>
                  <Input id="edit-phone" name="phone" type="tel" defaultValue={editingClient.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">{language === "ar" ? "العنوان" : "Address"}</Label>
                  <Input id="edit-address" name="address" defaultValue={editingClient.address || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingClient(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateClient.isPending}>
                  {updateClient.isPending ? (language === "ar" ? "جاري التحديث..." : "Updating...") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
