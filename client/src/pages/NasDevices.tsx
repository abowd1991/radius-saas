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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Router,
  Wifi,
  Signal,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

export default function NasDevices() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDevice, setEditingDevice] = useState<any>(null);

  // Fetch NAS devices
  const { data: devices, isLoading, refetch } = trpc.nas.list.useQuery();

  // Mutations
  const createDevice = trpc.nas.create.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إضافة الجهاز بنجاح" : "Device added successfully");
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateDevice = trpc.nas.update.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الجهاز بنجاح" : "Device updated successfully");
      setEditingDevice(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteDevice = trpc.nas.delete.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم حذف الجهاز" : "Device deleted");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

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
      case "maintenance":
        return <Badge variant="default" className="bg-yellow-500">{language === "ar" ? "صيانة" : "Maintenance"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      ipAddress: formData.get("ipAddress") as string,
      secret: formData.get("secret") as string,
      type: formData.get("type") as "mikrotik" | "cisco" | "other",
      description: formData.get("description") as string || undefined,
    };

    if (editingDevice) {
      updateDevice.mutate({ id: editingDevice.id, ...data });
    } else {
      createDevice.mutate(data);
    }
  };

  const filteredDevices = devices?.filter(device =>
    (device.shortname || device.nasname).toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.nasname.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.nas")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة أجهزة MikroTik و RADIUS NAS" : "Manage MikroTik and RADIUS NAS devices"}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
              {language === "ar" ? "إضافة جهاز" : "Add Device"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إضافة جهاز NAS جديد" : "Add New NAS Device"}</DialogTitle>
              <DialogDescription>
                {language === "ar" ? "أدخل بيانات جهاز MikroTik الجديد" : "Enter the new MikroTik device information"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">{language === "ar" ? "اسم الجهاز" : "Device Name"}</Label>
                    <Input id="name" name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shortName">{language === "ar" ? "الاسم المختصر" : "Short Name"}</Label>
                    <Input id="shortName" name="shortName" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">{language === "ar" ? "عنوان IP" : "IP Address"}</Label>
                  <Input id="ipAddress" name="ipAddress" placeholder="192.168.1.1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">{language === "ar" ? "كلمة السر (Secret)" : "RADIUS Secret"}</Label>
                  <Input id="secret" name="secret" type="password" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">{language === "ar" ? "نوع الجهاز" : "Device Type"}</Label>
                  <Select name="type" defaultValue="mikrotik">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mikrotik">MikroTik</SelectItem>
                      <SelectItem value="cisco">Cisco</SelectItem>
                      <SelectItem value="ubiquiti">Ubiquiti</SelectItem>
                      <SelectItem value="other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">{t("common.description")}</Label>
                  <Input id="description" name="description" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createDevice.isPending}>
                  {createDevice.isPending ? (language === "ar" ? "جاري الإضافة..." : "Adding...") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الأجهزة" : "Total Devices"}
            </CardTitle>
            <Router className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{devices?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("common.active")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {devices?.filter(d => d.status === "active").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t("common.inactive")}
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {devices?.filter(d => d.status === "inactive").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              MikroTik
            </CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {devices?.filter(d => d.type === "mikrotik").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${direction === "rtl" ? "right-3" : "left-3"}`} />
            <Input
              placeholder={language === "ar" ? "بحث بالاسم أو IP..." : "Search by name or IP..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={direction === "rtl" ? "pr-9" : "pl-9"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "اسم الجهاز" : "Device Name"}</TableHead>
                <TableHead>{language === "ar" ? "عنوان IP" : "IP Address"}</TableHead>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
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
              ) : filteredDevices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد أجهزة" : "No devices found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices?.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Router className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{device.shortname || device.nasname}</span>
                          <p className="text-xs text-muted-foreground">{device.nasname}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{device.nasname}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{device.type}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {device.description || "-"}
                    </TableCell>
                    <TableCell>{formatDate(device.createdAt)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={direction === "rtl" ? "start" : "end"}>
                          <DropdownMenuItem onClick={() => setEditingDevice(device)}>
                            <Edit className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(language === "ar" ? "قريباً" : "Coming soon")}>
                            <Settings className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "الإعدادات" : "Settings"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(language === "ar" ? "قريباً" : "Coming soon")}>
                            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "اختبار الاتصال" : "Test Connection"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذا الجهاز؟" : "Are you sure you want to delete this device?")) {
                                deleteDevice.mutate({ id: device.id });
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

      {/* Edit Dialog */}
      <Dialog open={!!editingDevice} onOpenChange={(open) => !open && setEditingDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الجهاز" : "Edit Device"}</DialogTitle>
          </DialogHeader>
          {editingDevice && (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">{language === "ar" ? "اسم الجهاز" : "Device Name"}</Label>
                    <Input id="edit-name" name="name" defaultValue={editingDevice.name} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-shortName">{language === "ar" ? "الاسم المختصر" : "Short Name"}</Label>
                    <Input id="edit-shortName" name="shortName" defaultValue={editingDevice.shortName} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ipAddress">{language === "ar" ? "عنوان IP" : "IP Address"}</Label>
                  <Input id="edit-ipAddress" name="ipAddress" defaultValue={editingDevice.ipAddress} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-secret">{language === "ar" ? "كلمة السر (Secret)" : "RADIUS Secret"}</Label>
                  <Input id="edit-secret" name="secret" type="password" placeholder="Leave empty to keep current" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">{language === "ar" ? "نوع الجهاز" : "Device Type"}</Label>
                  <Select name="type" defaultValue={editingDevice.type}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mikrotik">MikroTik</SelectItem>
                      <SelectItem value="cisco">Cisco</SelectItem>
                      <SelectItem value="ubiquiti">Ubiquiti</SelectItem>
                      <SelectItem value="other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t("common.description")}</Label>
                  <Input id="edit-description" name="description" defaultValue={editingDevice.description || ""} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingDevice(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateDevice.isPending}>
                  {updateDevice.isPending ? (language === "ar" ? "جاري التحديث..." : "Updating...") : t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
