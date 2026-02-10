import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

/**
 * Staff Management Page
 * 
 * Allows client_owner to create and manage sub-admins (staff members)
 * Sub-admins can be client_admin or client_staff with limited permissions
 */
export default function StaffManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);

  const [newStaff, setNewStaff] = useState({
    name: "",
    email: "",
    password: "",
    role: "client_admin" as "client_admin" | "client_staff",
  });

  const utils = trpc.useUtils();
  const { data: subAdmins, isLoading } = trpc.subAdmin.listMySubAdmins.useQuery();
  const createMutation = trpc.subAdmin.createSubAdmin.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الموظف بنجاح");
      utils.subAdmin.listMySubAdmins.invalidate();
      setIsCreateDialogOpen(false);
      setNewStaff({ name: "", email: "", password: "", role: "client_admin" });
    },
    onError: (error) => {
      toast.error(error.message || "فشل إنشاء الموظف");
    },
  });

  const updateMutation = trpc.subAdmin.updateSubAdmin.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الموظف بنجاح");
      utils.subAdmin.listMySubAdmins.invalidate();
      setIsEditDialogOpen(false);
      setSelectedStaff(null);
    },
    onError: (error) => {
      toast.error(error.message || "فشل تحديث الموظف");
    },
  });

  const deleteMutation = trpc.subAdmin.deleteSubAdmin.useMutation({
    onSuccess: () => {
      toast.success("تم حذف الموظف بنجاح");
      utils.subAdmin.listMySubAdmins.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "فشل حذف الموظف");
    },
  });

  const handleCreate = () => {
    if (!newStaff.name || !newStaff.email || !newStaff.password) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    createMutation.mutate(newStaff);
  };

  const handleUpdate = () => {
    if (!selectedStaff) return;
    updateMutation.mutate({
      id: selectedStaff.id,
      name: selectedStaff.name,
      email: selectedStaff.email,
      role: selectedStaff.role,
      status: selectedStaff.status,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("هل أنت متأكد من حذف هذا الموظف؟")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                إدارة الموظفين
              </CardTitle>
              <CardDescription>
                إنشاء وإدارة حسابات الموظفين (المديرين الفرعيين)
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  إضافة موظف
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة موظف جديد</DialogTitle>
                  <DialogDescription>
                    أنشئ حساب موظف جديد يمكنه الوصول إلى بياناتك
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">الاسم</Label>
                    <Input
                      id="name"
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                      placeholder="اسم الموظف"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">كلمة المرور</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                      placeholder="••••••••"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">الدور</Label>
                    <Select
                      value={newStaff.role}
                      onValueChange={(value) => setNewStaff({ ...newStaff, role: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client_admin">مدير</SelectItem>
                        <SelectItem value="client_staff">موظف</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} className="w-full">
                    {createMutation.isPending ? "جاري الإنشاء..." : "إنشاء"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>جاري التحميل...</p>
          ) : !subAdmins || subAdmins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا يوجد موظفين بعد</p>
              <p className="text-sm">أضف موظفين لمساعدتك في إدارة حسابك</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ الإنشاء</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subAdmins.map((staff: any) => (
                  <TableRow key={staff.id}>
                    <TableCell>{staff.name}</TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>
                      <Badge variant={staff.role === "client_admin" ? "default" : "secondary"}>
                        {staff.role === "client_admin" ? "مدير" : "موظف"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={staff.status === "active" ? "default" : "destructive"}>
                        {staff.status === "active" ? "نشط" : staff.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(staff.createdAt).toLocaleDateString("ar")}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(staff.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل الموظف</DialogTitle>
            <DialogDescription>تحديث معلومات الموظف</DialogDescription>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">الاسم</Label>
                <Input
                  id="edit-name"
                  value={selectedStaff.name}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">البريد الإلكتروني</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedStaff.email}
                  onChange={(e) => setSelectedStaff({ ...selectedStaff, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-role">الدور</Label>
                <Select
                  value={selectedStaff.role}
                  onValueChange={(value) => setSelectedStaff({ ...selectedStaff, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client_admin">مدير</SelectItem>
                    <SelectItem value="client_staff">موظف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">الحالة</Label>
                <Select
                  value={selectedStaff.status}
                  onValueChange={(value) => setSelectedStaff({ ...selectedStaff, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="suspended">موقوف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="w-full">
                {updateMutation.isPending ? "جاري التحديث..." : "تحديث"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
