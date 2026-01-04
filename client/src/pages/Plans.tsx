import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Package,
  Zap,
  HardDrive,
  Clock,
  DollarSign,
} from "lucide-react";
import { useState } from "react";

export default function Plans() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);

  // Fetch plans
  const { data: plans, isLoading, refetch } = trpc.plans.list.useQuery();

  // Mutations
  const createPlan = trpc.plans.create.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إنشاء الخطة بنجاح" : "Plan created successfully");
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updatePlan = trpc.plans.update.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الخطة بنجاح" : "Plan updated successfully");
      setEditingPlan(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deletePlan = trpc.plans.delete.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم حذف الخطة بنجاح" : "Plan deleted successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1000) {
      return `${kbps / 1000} Mbps`;
    }
    return `${kbps} Kbps`;
  };

  const formatData = (mb: number | null) => {
    if (!mb) return language === "ar" ? "غير محدود" : "Unlimited";
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      nameAr: formData.get("nameAr") as string,
      description: formData.get("description") as string,
      descriptionAr: formData.get("descriptionAr") as string,
      downloadSpeed: parseInt(formData.get("downloadSpeed") as string) * 1000, // Convert Mbps to Kbps
      uploadSpeed: parseInt(formData.get("uploadSpeed") as string) * 1000,
      dataLimit: formData.get("dataLimit") ? parseInt(formData.get("dataLimit") as string) * 1024 : undefined, // Convert GB to MB
      durationDays: parseInt(formData.get("durationDays") as string),
      price: formData.get("price") as string,
      resellerPrice: formData.get("resellerPrice") as string,
      simultaneousUsers: parseInt(formData.get("simultaneousUsers") as string) || 1,
      poolName: formData.get("poolName") as string || undefined,
    };

    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan.id, ...data });
    } else {
      createPlan.mutate(data);
    }
  };

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("plans.title")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة خطط الإنترنت والأسعار" : "Manage internet plans and pricing"}
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                {t("plans.add_plan")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("plans.add_plan")}</DialogTitle>
                <DialogDescription>
                  {language === "ar" ? "أضف خطة إنترنت جديدة" : "Add a new internet plan"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nameAr">{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                      <Input id="nameAr" name="nameAr" dir="rtl" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="description">{language === "ar" ? "الوصف (إنجليزي)" : "Description (English)"}</Label>
                      <Textarea id="description" name="description" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="descriptionAr">{language === "ar" ? "الوصف (عربي)" : "Description (Arabic)"}</Label>
                      <Textarea id="descriptionAr" name="descriptionAr" dir="rtl" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="downloadSpeed">{t("plans.download_speed")} (Mbps)</Label>
                      <Input id="downloadSpeed" name="downloadSpeed" type="number" min="1" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uploadSpeed">{t("plans.upload_speed")} (Mbps)</Label>
                      <Input id="uploadSpeed" name="uploadSpeed" type="number" min="1" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dataLimit">{t("plans.data_limit")} (GB)</Label>
                      <Input id="dataLimit" name="dataLimit" type="number" placeholder={language === "ar" ? "اتركه فارغاً لغير محدود" : "Leave empty for unlimited"} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="durationDays">{t("plans.duration")} ({t("plans.days")})</Label>
                      <Input id="durationDays" name="durationDays" type="number" min="1" defaultValue="30" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">{t("common.price")} ($)</Label>
                      <Input id="price" name="price" type="number" step="0.01" min="0" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="resellerPrice">{t("plans.reseller_price")} ($)</Label>
                      <Input id="resellerPrice" name="resellerPrice" type="number" step="0.01" min="0" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="simultaneousUsers">{language === "ar" ? "المستخدمين المتزامنين" : "Simultaneous Users"}</Label>
                      <Input id="simultaneousUsers" name="simultaneousUsers" type="number" min="1" defaultValue="1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="poolName">{language === "ar" ? "اسم Pool" : "Pool Name"}</Label>
                      <Input id="poolName" name="poolName" placeholder="e.g., pool-10m" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={createPlan.isPending}>
                    {createPlan.isPending ? (language === "ar" ? "جاري الإنشاء..." : "Creating...") : t("common.save")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Plans Grid for Clients/Resellers */}
      {!isSuperAdmin && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((plan) => (
            <Card key={plan.id} className="relative overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {language === "ar" && plan.nameAr ? plan.nameAr : plan.name}
                  </CardTitle>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status === "active" ? t("common.active") : t("common.inactive")}
                  </Badge>
                </div>
                <CardDescription>
                  {language === "ar" && plan.descriptionAr ? plan.descriptionAr : plan.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">
                  {user?.role === "reseller" 
                    ? formatCurrency(plan.resellerPrice as string)
                    : formatCurrency(plan.price as string)
                  }
                  <span className="text-sm font-normal text-muted-foreground">
                    /{plan.validityValue} {plan.validityType === 'days' ? t("plans.days") : plan.validityType === 'hours' ? t("plans.hours") : t("plans.minutes")}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span>{t("plans.download_speed")}: {formatSpeed(plan.downloadSpeed)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary rotate-180" />
                    <span>{t("plans.upload_speed")}: {formatSpeed(plan.uploadSpeed)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-primary" />
                    <span>{t("plans.data_limit")}: {formatData(plan.dataLimit)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{t("plans.duration")}: {plan.validityValue} {plan.validityType === 'days' ? t("plans.days") : plan.validityType === 'hours' ? t("plans.hours") : t("plans.minutes")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Plans Table for Super Admin */}
      {isSuperAdmin && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead>{t("plans.download_speed")}</TableHead>
                  <TableHead>{t("plans.upload_speed")}</TableHead>
                  <TableHead>{t("plans.data_limit")}</TableHead>
                  <TableHead>{t("plans.duration")}</TableHead>
                  <TableHead>{t("common.price")}</TableHead>
                  <TableHead>{t("plans.reseller_price")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="w-[70px]">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      {t("common.loading")}
                    </TableCell>
                  </TableRow>
                ) : plans?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {language === "ar" ? "لا توجد خطط" : "No plans found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  plans?.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{plan.name}</div>
                          {plan.nameAr && (
                            <div className="text-sm text-muted-foreground" dir="rtl">{plan.nameAr}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatSpeed(plan.downloadSpeed)}</TableCell>
                      <TableCell>{formatSpeed(plan.uploadSpeed)}</TableCell>
                      <TableCell>{formatData(plan.dataLimit)}</TableCell>
                      <TableCell>{plan.validityValue} {plan.validityType === 'days' ? t("plans.days") : plan.validityType === 'hours' ? t("plans.hours") : t("plans.minutes")}</TableCell>
                      <TableCell>{formatCurrency(plan.price as string)}</TableCell>
                      <TableCell>{formatCurrency(plan.resellerPrice as string)}</TableCell>
                      <TableCell>
                        <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                          {plan.status === "active" ? t("common.active") : t("common.inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align={direction === "rtl" ? "start" : "end"}>
                            <DropdownMenuItem onClick={() => setEditingPlan(plan)}>
                              <Edit className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {t("common.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الخطة؟" : "Are you sure you want to delete this plan?")) {
                                  deletePlan.mutate({ id: plan.id });
                                }
                              }}
                            >
                              <Trash2 className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {t("common.delete")}
                            </DropdownMenuItem>
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
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={(open) => !open && setEditingPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("plans.edit_plan")}</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                    <Input id="edit-name" name="name" defaultValue={editingPlan.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-nameAr">{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                    <Input id="edit-nameAr" name="nameAr" defaultValue={editingPlan.nameAr || ""} dir="rtl" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-downloadSpeed">{t("plans.download_speed")} (Mbps)</Label>
                    <Input id="edit-downloadSpeed" name="downloadSpeed" type="number" min="1" defaultValue={editingPlan.downloadSpeed / 1000} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-uploadSpeed">{t("plans.upload_speed")} (Mbps)</Label>
                    <Input id="edit-uploadSpeed" name="uploadSpeed" type="number" min="1" defaultValue={editingPlan.uploadSpeed / 1000} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-dataLimit">{t("plans.data_limit")} (GB)</Label>
                    <Input id="edit-dataLimit" name="dataLimit" type="number" defaultValue={editingPlan.dataLimit ? editingPlan.dataLimit / 1024 : ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-durationDays">{t("plans.duration")} ({t("plans.days")})</Label>
                    <Input id="edit-durationDays" name="durationDays" type="number" min="1" defaultValue={editingPlan.durationDays} required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-price">{t("common.price")} ($)</Label>
                    <Input id="edit-price" name="price" type="number" step="0.01" min="0" defaultValue={editingPlan.price} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-resellerPrice">{t("plans.reseller_price")} ($)</Label>
                    <Input id="edit-resellerPrice" name="resellerPrice" type="number" step="0.01" min="0" defaultValue={editingPlan.resellerPrice} required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingPlan(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updatePlan.isPending}>
                  {updatePlan.isPending ? (language === "ar" ? "جاري التحديث..." : "Updating...") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
