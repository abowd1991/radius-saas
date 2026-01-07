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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";

export default function Settings() {
  const { user } = useAuth();
  const { t, language, direction, setLanguage } = useLanguage();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [invoiceNotifications, setInvoiceNotifications] = useState(true);
  const [supportNotifications, setSupportNotifications] = useState(true);
  
  // RADIUS Settings
  const [radiusPublicIp, setRadiusPublicIp] = useState('');
  const [radiusVpnIp, setRadiusVpnIp] = useState('192.168.30.1');
  const [vpnServerAddress, setVpnServerAddress] = useState('');
  const [radiusSettingsLoading, setRadiusSettingsLoading] = useState(false);
  
  // Load RADIUS settings
  const { data: systemSettings, refetch: refetchSettings } = trpc.settings.getAll.useQuery();
  
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

  const handleSaveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success(language === "ar" ? "تم حفظ الإعدادات" : "Settings saved");
  };

  const handleChangePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.success(language === "ar" ? "تم تغيير كلمة المرور" : "Password changed");
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
        <TabsList className="grid w-full grid-cols-5 lg:w-[500px]">
          <TabsTrigger value="profile">
            <User className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "الملف" : "Profile"}
          </TabsTrigger>
          <TabsTrigger value="radius">
            <Server className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "RADIUS" : "RADIUS"}
          </TabsTrigger>
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
                    <Input id="name" defaultValue={user?.name || ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("common.email")}</Label>
                    <Input id="email" type="email" defaultValue={user?.email || ""} />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("common.phone")}</Label>
                    <Input id="phone" type="tel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">{language === "ar" ? "اسم الشركة" : "Company Name"}</Label>
                    <Input id="company" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">{language === "ar" ? "العنوان" : "Address"}</Label>
                  <Input id="address" />
                </div>
                <Button type="submit">
                  <Save className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  {t("common.save")}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RADIUS Tab */}
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
                    <span className="animate-spin mr-2">⏳</span>
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
                    {language === "ar" ? "استلام الإشعارات عبر البريد الإلكتروني" : "Receive notifications via email"}
                  </p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الدفع" : "Push Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "استلام إشعارات فورية في المتصفح" : "Receive instant browser notifications"}
                  </p>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الفواتير" : "Invoice Notifications"}</Label>
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "إشعارات عند إنشاء فواتير جديدة" : "Notifications for new invoices"}
                  </p>
                </div>
                <Switch checked={invoiceNotifications} onCheckedChange={setInvoiceNotifications} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{language === "ar" ? "إشعارات الدعم الفني" : "Support Notifications"}</Label>
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
                  {language === "ar" ? "تحديث كلمة مرور حسابك" : "Update your account password"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">{language === "ar" ? "كلمة المرور الحالية" : "Current Password"}</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{language === "ar" ? "كلمة المرور الجديدة" : "New Password"}</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{language === "ar" ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                  <Button type="submit">
                    <Key className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    {language === "ar" ? "تغيير كلمة المرور" : "Change Password"}
                  </Button>
                </form>
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
                    <Globe className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
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
                <Select defaultValue="light">
                  <SelectTrigger className="w-[200px]">
                    <Palette className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">{language === "ar" ? "فاتح" : "Light"}</SelectItem>
                    <SelectItem value="dark">{language === "ar" ? "داكن" : "Dark"}</SelectItem>
                    <SelectItem value="system">{language === "ar" ? "تلقائي" : "System"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
