import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  User,
  Bell,
  Globe,
  Shield,
  CreditCard,
  Mail,
  Key,
  Palette,
  Save,
  Server,
  Network,
  Camera,
  Upload,
  Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";

export default function Settings() {
  const { user, refresh: refetchUser } = useAuth();
  const { t, language, direction, setLanguage } = useLanguage();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [invoiceNotifications, setInvoiceNotifications] = useState(true);
  const [supportNotifications, setSupportNotifications] = useState(true);
  
  // Profile form state
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Password reset state
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordResetStep, setPasswordResetStep] = useState<'request' | 'verify'>('request');
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  
  // RADIUS Settings
  const [radiusPublicIp, setRadiusPublicIp] = useState('');
  const [radiusVpnIp, setRadiusVpnIp] = useState('192.168.30.1');
  const [vpnServerAddress, setVpnServerAddress] = useState('');
  const [radiusSettingsLoading, setRadiusSettingsLoading] = useState(false);
  
  // Load RADIUS settings
  const { data: systemSettings, refetch: refetchSettings } = trpc.settings.getAll.useQuery();
  
  // Initialize profile form with user data
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfilePhone(user.phone || '');
      setProfileAddress(user.address || '');
    }
  }, [user]);
  
  // Update local state when settings are loaded
  useEffect(() => {
    if (systemSettings) {
      setRadiusPublicIp(systemSettings.radius_server_public_ip || '');
      setRadiusVpnIp(systemSettings.radius_server_vpn_ip || '192.168.30.1');
      setVpnServerAddress(systemSettings.vpn_server_address || '');
    }
  }, [systemSettings]);
  
  const updateSettingMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم حفظ الإعدادات' : 'Settings saved');
      refetchSettings();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });
  
  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الملف الشخصي' : 'Profile updated');
      refetchUser();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });
  
  const updateAvatarMutation = trpc.auth.updateAvatar.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تحديث الصورة الشخصية' : 'Avatar updated');
      refetchUser();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });
  
  const requestPasswordChangeMutation = trpc.auth.requestPasswordChange.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إرسال رمز التحقق لبريدك الإلكتروني' : 'Verification code sent to your email');
      setPasswordResetStep('verify');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });
  
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
      setShowPasswordResetDialog(false);
      setPasswordResetStep('request');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });
  
  const handleSaveRadiusSettings = async () => {
    setRadiusSettingsLoading(true);
    try {
      await updateSettingMutation.mutateAsync({ key: 'radius_server_public_ip', value: radiusPublicIp });
      await updateSettingMutation.mutateAsync({ key: 'radius_server_vpn_ip', value: radiusVpnIp });
      await updateSettingMutation.mutateAsync({ key: 'vpn_server_address', value: vpnServerAddress });
    } finally {
      setRadiusSettingsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await updateProfileMutation.mutateAsync({
        name: profileName,
        phone: profilePhone,
        address: profileAddress,
      });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(language === 'ar' ? 'يرجى اختيار صورة' : 'Please select an image');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(language === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 5MB)' : 'Image too large (max 5MB)');
      return;
    }
    
    setAvatarUploading(true);
    try {
      // Upload to S3 via API
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const { url } = await response.json();
      await updateAvatarMutation.mutateAsync({ avatarUrl: url });
    } catch (error) {
      toast.error(language === 'ar' ? 'فشل رفع الصورة' : 'Failed to upload image');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRequestPasswordChange = async () => {
    setPasswordResetLoading(true);
    try {
      await requestPasswordChangeMutation.mutateAsync();
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(language === 'ar' ? 'كلمات المرور غير متطابقة' : 'Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      toast.error(language === 'ar' ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters');
      return;
    }
    
    setPasswordResetLoading(true);
    try {
      await resetPasswordMutation.mutateAsync({
        email: user?.email || '',
        code: resetCode,
        newPassword: newPassword,
      });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("nav.settings")}</h1>
        <p className="text-muted-foreground">
          {language === "ar" ? "إدارة إعدادات حسابك والتطبيق" : "Manage your account and application settings"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className={`grid w-full ${(user?.role === 'super_admin' || user?.role === 'owner') ? 'grid-cols-5' : 'grid-cols-4'} lg:w-[${(user?.role === 'super_admin' || user?.role === 'owner') ? '500' : '400'}px]`}>
          <TabsTrigger value="profile">
            <User className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "الملف" : "Profile"}
          </TabsTrigger>
          {/* RADIUS tab - only visible to owner/super_admin */}
          {(user?.role === 'owner' || user?.role === 'super_admin') && (
            <TabsTrigger value="radius">
              <Server className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
              {language === "ar" ? "RADIUS" : "RADIUS"}
            </TabsTrigger>
          )}
          <TabsTrigger value="notifications">
            <Bell className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "الإشعارات" : "Notifications"}
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "الأمان" : "Security"}
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "المظهر" : "Appearance"}
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <div className="space-y-6">
            {/* Avatar Section */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "الصورة الشخصية" : "Profile Picture"}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "قم برفع صورة شخصية لحسابك" : "Upload a profile picture for your account"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{user?.name || user?.username}</p>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                    >
                      <Upload className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                      {language === "ar" ? "رفع صورة جديدة" : "Upload new picture"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Info Section */}
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "معلومات الملف الشخصي" : "Profile Information"}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "تحديث معلومات حسابك الشخصية" : "Update your personal account information"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">{t("common.name")}</Label>
                      <Input 
                        id="name" 
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("common.email")}</Label>
                      <Input id="email" type="email" value={user?.email || ""} disabled />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="phone">{t("common.phone")}</Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">{language === "ar" ? "اسم الشركة" : "Company Name"}</Label>
                      <Input id="company" disabled placeholder={language === "ar" ? "قريباً" : "Coming soon"} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">{language === "ar" ? "العنوان" : "Address"}</Label>
                    <Input 
                      id="address" 
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={profileLoading}>
                    {profileLoading ? (
                      <Loader2 className={`h-4 w-4 animate-spin ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    ) : (
                      <Save className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    )}
                    {t("common.save")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RADIUS Tab - only visible to owner/super_admin */}
        {(user?.role === 'owner' || user?.role === 'super_admin') && (
        <TabsContent value="radius">
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {language === "ar" ? "إعدادات خادم RADIUS" : "RADIUS Server Settings"}
                </div>
              </CardTitle>
              <CardDescription>
                {language === "ar" 
                  ? "إعداد عناوين IP الحقيقية لخادم RADIUS لربط أجهزة MikroTik" 
                  : "Configure real RADIUS server IP addresses for MikroTik device connections"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Public IP Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  <Label className="text-base font-semibold">
                    {language === "ar" ? "اتصال IP العام" : "Public IP Connection"}
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius-public-ip">
                    {language === "ar" ? "IP العام لخادم RADIUS" : "RADIUS Server Public IP"}
                  </Label>
                  <Input 
                    id="radius-public-ip" 
                    placeholder={language === "ar" ? "مثال: 203.0.113.50" : "e.g., 203.0.113.50"}
                    value={radiusPublicIp}
                    onChange={(e) => setRadiusPublicIp(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "هذا العنوان يُستخدم عندما يكون لدى الراوتر IP عام ويتصل مباشرة بخادم RADIUS" 
                      : "This address is used when the router has a public IP and connects directly to RADIUS server"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* VPN Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <Label className="text-base font-semibold">
                    {language === "ar" ? "اتصال VPN (PPTP/SSTP)" : "VPN Connection (PPTP/SSTP)"}
                  </Label>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="vpn-server-address">
                    {language === "ar" ? "عنوان خادم VPN" : "VPN Server Address"}
                  </Label>
                  <Input 
                    id="vpn-server-address" 
                    placeholder={language === "ar" ? "مثال: vpn.example.com أو 203.0.113.100" : "e.g., vpn.example.com or 203.0.113.100"}
                    value={vpnServerAddress}
                    onChange={(e) => setVpnServerAddress(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "عنوان خادم VPN الذي سيتصل به MikroTik لإنشاء نفق VPN" 
                      : "VPN server address that MikroTik will connect to for creating VPN tunnel"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="radius-vpn-ip">
                    {language === "ar" ? "IP خادم RADIUS داخل شبكة VPN" : "RADIUS Server IP inside VPN Network"}
                  </Label>
                  <Input 
                    id="radius-vpn-ip" 
                    placeholder={language === "ar" ? "مثال: 192.168.30.1" : "e.g., 192.168.30.1"}
                    value={radiusVpnIp}
                    onChange={(e) => setRadiusVpnIp(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "هذا العنوان يُستخدم بعد إنشاء نفق VPN للوصول إلى خادم RADIUS" 
                      : "This address is used after VPN tunnel is established to reach RADIUS server"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Info Box */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                  {language === "ar" ? "ملاحظة هامة" : "Important Note"}
                </h4>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  {language === "ar" 
                    ? "تأكد من أن عناوين IP المدخلة صحيحة ويمكن الوصول إليها. سيتم استخدام هذه العناوين في أوامر MikroTik المُولدة لربط الراوترات." 
                    : "Make sure the entered IP addresses are correct and reachable. These addresses will be used in generated MikroTik commands for router connections."}
                </p>
              </div>

              <Button 
                onClick={handleSaveRadiusSettings} 
                disabled={radiusSettingsLoading}
                className="w-full sm:w-auto"
              >
                {radiusSettingsLoading ? (
                  <>
                    <Loader2 className={`h-4 w-4 animate-spin ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    {language === "ar" ? "جاري الحفظ..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    {language === "ar" ? "حفظ إعدادات RADIUS" : "Save RADIUS Settings"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "إعدادات الإشعارات" : "Notification Settings"}</CardTitle>
              <CardDescription>
                {language === "ar" ? "تحكم في كيفية تلقي الإشعارات" : "Control how you receive notifications"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات البريد الإلكتروني" : "Email Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "استلام إشعارات عبر البريد الإلكتروني" : "Receive notifications via email"}
                  </p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الدفع" : "Push Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "إشعارات فورية في المتصفح" : "Instant browser notifications"}
                  </p>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الفواتير" : "Invoice Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "إشعارات عند إصدار فاتورة جديدة" : "Notifications for new invoices"}
                  </p>
                </div>
                <Switch checked={invoiceNotifications} onCheckedChange={setInvoiceNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الدعم" : "Support Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "إشعارات عند الرد على تذاكر الدعم" : "Notifications for support ticket replies"}
                  </p>
                </div>
                <Switch checked={supportNotifications} onCheckedChange={setSupportNotifications} />
              </div>
              <Button onClick={() => toast.success(language === "ar" ? "تم حفظ الإعدادات" : "Settings saved")}>
                <Save className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                {t("common.save")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "تغيير كلمة المرور" : "Change Password"}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "سيتم إرسال رمز التحقق إلى بريدك الإلكتروني" : "A verification code will be sent to your email"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <Mail className="h-10 w-10 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {language === "ar" 
                          ? "سيتم إرسال رمز التحقق إلى هذا البريد" 
                          : "Verification code will be sent to this email"}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowPasswordResetDialog(true)}
                    className="w-full sm:w-auto"
                  >
                    <Key className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "المصادقة الثنائية" : "Two-Factor Authentication"}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "إضافة طبقة أمان إضافية لحسابك" : "Add an extra layer of security to your account"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{language === "ar" ? "تفعيل المصادقة الثنائية" : "Enable 2FA"}</Label>
                    <p className="text-sm text-muted-foreground">
                      {language === "ar" ? "استخدام تطبيق المصادقة للتحقق" : "Use an authenticator app for verification"}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => toast.info(language === "ar" ? "قريباً" : "Coming soon")}>
                    {language === "ar" ? "إعداد" : "Setup"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "إعدادات المظهر" : "Appearance Settings"}</CardTitle>
              <CardDescription>
                {language === "ar" ? "تخصيص مظهر التطبيق" : "Customize the application appearance"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>{language === "ar" ? "اللغة" : "Language"}</Label>
                <Select value={language} onValueChange={(value: "ar" | "en") => setLanguage(value)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ar">العربية</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{language === "ar" ? "السمة" : "Theme"}</Label>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "يمكنك تغيير السمة من الزر في الشريط العلوي" : "You can change the theme from the button in the top bar"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Password Reset Dialog */}
      <Dialog open={showPasswordResetDialog} onOpenChange={setShowPasswordResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
            </DialogTitle>
            <DialogDescription>
              {passwordResetStep === 'request' 
                ? (language === "ar" 
                    ? "سيتم إرسال رمز التحقق إلى بريدك الإلكتروني" 
                    : "A verification code will be sent to your email")
                : (language === "ar" 
                    ? "أدخل رمز التحقق وكلمة المرور الجديدة" 
                    : "Enter the verification code and new password")
              }
            </DialogDescription>
          </DialogHeader>
          
          {passwordResetStep === 'request' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <Mail className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPasswordResetDialog(false)}>
                  {language === "ar" ? "إلغاء" : "Cancel"}
                </Button>
                <Button onClick={handleRequestPasswordChange} disabled={passwordResetLoading}>
                  {passwordResetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {language === "ar" ? "إرسال الرمز" : "Send Code"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "رمز التحقق" : "Verification Code"}</Label>
                <Input 
                  placeholder="123456"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value)}
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
                <Input 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                <Input 
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setPasswordResetStep('request');
                  setResetCode('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}>
                  {language === "ar" ? "رجوع" : "Back"}
                </Button>
                <Button onClick={handleResetPassword} disabled={passwordResetLoading}>
                  {passwordResetLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
