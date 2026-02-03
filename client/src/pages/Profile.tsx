import { useState } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Loader2, User, Mail, Shield, Calendar, Key } from "lucide-react";

export default function Profile() {
  const { data: user, isLoading } = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Update profile mutation
  const updateProfileMutation = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      alert("تم تحديث معلومات الملف الشخصي بنجاح");
      setIsEditingProfile(false);
      utils.auth.me.invalidate();
    },
    onError: (error: any) => {
      alert(`خطأ: ${error.message}`);
    },
  });

  // Change password mutation
  const changePasswordMutation = trpc.users.changePassword.useMutation({
    onSuccess: () => {
      alert("تم تغيير كلمة المرور بنجاح");
      setIsChangingPassword(false);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: (error: any) => {
      alert(`خطأ: ${error.message}`);
    },
  });

  const handleUpdateProfile = () => {
    if (!profileForm.username || !profileForm.email) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    updateProfileMutation.mutate({
      username: profileForm.username,
      email: profileForm.email,
    });
  };

  const handleChangePassword = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert("يرجى ملء جميع الحقول");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      alert("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return { label: "مالك النظام", variant: "destructive" as const };
      case "super_admin":
        return { label: "مدير النظام", variant: "destructive" as const };
      case "reseller":
        return { label: "موزع", variant: "default" as const };
      case "client":
        return { label: "عميل", variant: "secondary" as const };
      case "support":
        return { label: "دعم فني", variant: "outline" as const };
      default:
        return { label: role, variant: "secondary" as const };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { label: "نشط", variant: "default" as const };
      case "trial":
        return { label: "تجريبي", variant: "secondary" as const };
      case "suspended":
        return { label: "معلق", variant: "destructive" as const };
      default:
        return { label: status, variant: "outline" as const };
    }
  };

  // Update form when user data loads
  if (user && !isEditingProfile && profileForm.username === "") {
    setProfileForm({
      username: user.username || "",
      email: user.email || "",
    });
  }

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const roleBadge = getRoleBadge(user.role);
  const statusBadge = getStatusBadge(user.accountStatus);

  return (
    <div className="container max-w-4xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">الملف الشخصي</h1>
          <p className="text-muted-foreground">إدارة معلوماتك الشخصية وإعدادات الحساب</p>
        </div>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              معلومات الحساب
            </CardTitle>
            <CardDescription>معلومات حسابك الأساسية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">اسم المستخدم</Label>
                <div className="flex items-center gap-2 mt-1">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{user.username}</span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">البريد الإلكتروني</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{user.email || "غير محدد"}</span>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">الدور</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <Badge variant={roleBadge.variant}>{roleBadge.label}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">الحالة</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">تاريخ الإنشاء</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{new Date(user.createdAt).toLocaleDateString("ar-EG")}</span>
                </div>
              </div>
              {user.lastSignedIn && (
                <div>
                  <Label className="text-muted-foreground">آخر تسجيل دخول</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{new Date(user.lastSignedIn).toLocaleString("ar-EG")}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Profile */}
        <Card>
          <CardHeader>
            <CardTitle>تحديث المعلومات</CardTitle>
            <CardDescription>تحديث اسم المستخدم والبريد الإلكتروني</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditingProfile ? (
              <Button onClick={() => setIsEditingProfile(true)}>تعديل المعلومات</Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">اسم المستخدم</Label>
                  <Input
                    id="username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email || ""}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpdateProfile}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    حفظ التغييرات
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileForm({
                        username: user.username || "",
                        email: user.email || "",
                      });
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              تغيير كلمة المرور
            </CardTitle>
            <CardDescription>تحديث كلمة مرور حسابك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isChangingPassword ? (
              <Button onClick={() => setIsChangingPassword(true)}>تغيير كلمة المرور</Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                     onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                    تغيير كلمة المرور
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsChangingPassword(false);
                      setPasswordForm({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                    }}
                  >
                    إلغاء
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
