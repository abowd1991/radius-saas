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
} from "lucide-react";
import { useState } from "react";

export default function Clients() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingClient, setEditingClient] = useState<any>(null);

  // Fetch clients
  const { data: clients, isLoading, refetch } = trpc.users.list.useQuery({
    role: "client",
    search: searchQuery || undefined,
  });

  // Mutations
  // Note: Client creation would be handled through registration or admin panel
  const createClientMutation = {
    mutate: (data: any) => {
      toast.info(language === "ar" ? "سيتم إضافة هذه الميزة قريباً" : "This feature will be added soon");
      setIsAddDialogOpen(false);
    },
    isPending: false,
  };
  const createClient = createClientMutation;

  const updateClientMutation = {
    mutate: (data: any) => {
      toast.info(language === "ar" ? "سيتم إضافة هذه الميزة قريباً" : "This feature will be added soon");
      setEditingClient(null);
    },
    isPending: false,
  };
  const updateClient = updateClientMutation;

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
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("common.email")}</TableHead>
                <TableHead>{t("common.phone")}</TableHead>
                <TableHead>{t("wallet.balance")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.created_at")}</TableHead>
                <TableHead className="w-[70px]">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : clients?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا يوجد عملاء" : "No clients found"}
                  </TableCell>
                </TableRow>
              ) : (
                clients?.map((client: any) => (
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
