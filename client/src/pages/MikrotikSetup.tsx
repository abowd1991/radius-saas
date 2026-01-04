import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Check, Copy, Globe, Link2, Router, Server, Settings, Shield, Wifi } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MikrotikSetup() {
  const { user } = useAuth();
  const { language, t, direction } = useLanguage();
  const [selectedNasId, setSelectedNasId] = useState<string>("");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Fetch NAS devices
  const { data: nasDevices, isLoading: nasLoading } = trpc.nas.list.useQuery();

  const selectedNas = nasDevices?.find(nas => nas.id.toString() === selectedNasId);

  // Generate dynamic values based on selected NAS
  const serverAddress = "your-radius-server.com"; // This should come from system settings
  const radiusPort = "1812";
  const radiusSecret = selectedNas?.secret || "your_secret";
  const nasIp = selectedNas?.nasname || "192.168.1.1";
  const nasName = selectedNas?.shortname || "mikrotik-nas";
  const connectionType = selectedNas?.connectionType || "public_ip";
  
  // Generate unique credentials for PPTP connection
  const pptpUser = selectedNas ? `nas-${selectedNas.id}-${Date.now()}` : "nas-user";
  const pptpPassword = selectedNas?.secret || "generated_password";

  const copyToClipboard = async (text: string, commandId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCommand(commandId);
      toast.success(language === 'ar' ? 'تم النسخ بنجاح' : 'Copied successfully');
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      toast.error(language === 'ar' ? 'فشل النسخ' : 'Failed to copy');
    }
  };

  const commands = [
    {
      id: 'ppp-profile',
      title: language === 'ar' ? 'إنشاء PPP Profile' : 'Create PPP Profile',
      description: language === 'ar' 
        ? 'إنشاء بروفايل PPP جديد لاستخدامه مع اتصال RADIUS'
        : 'Create a new PPP profile to use with RADIUS connection',
      icon: <Settings className="h-5 w-5" />,
      command: `/ppp profile add name=radius-profile use-encryption=yes use-compression=yes`,
      label: 'ppp profile'
    },
    {
      id: 'pptp-client',
      title: language === 'ar' ? 'إنشاء PPTP Client' : 'Create PPTP Client',
      description: language === 'ar'
        ? 'إنشاء اتصال PPTP للربط مع خادم RADIUS (فقط إذا كان نوع الاتصال VPN PPTP)'
        : 'Create PPTP connection to link with RADIUS server (only if connection type is VPN PPTP)',
      icon: <Link2 className="h-5 w-5" />,
      command: `/interface pptp-client add name=pptp-radius connect-to=${serverAddress} user=${pptpUser} password=${pptpPassword} profile=radius-profile disabled=no`,
      label: 'pptp-client',
      showIf: connectionType === 'vpn_pptp'
    },
    {
      id: 'sstp-client',
      title: language === 'ar' ? 'إنشاء SSTP Client' : 'Create SSTP Client',
      description: language === 'ar'
        ? 'إنشاء اتصال SSTP للربط مع خادم RADIUS (فقط إذا كان نوع الاتصال VPN SSTP)'
        : 'Create SSTP connection to link with RADIUS server (only if connection type is VPN SSTP)',
      icon: <Shield className="h-5 w-5" />,
      command: `/interface sstp-client add name=sstp-radius connect-to=${serverAddress}:443 user=${pptpUser} password=${pptpPassword} profile=radius-profile disabled=no`,
      label: 'sstp-client',
      showIf: connectionType === 'vpn_sstp'
    },
    {
      id: 'radius-server',
      title: language === 'ar' ? 'إضافة خادم RADIUS' : 'Add RADIUS Server',
      description: language === 'ar'
        ? 'إضافة خادم RADIUS الرئيسي للمصادقة والمحاسبة'
        : 'Add main RADIUS server for authentication and accounting',
      icon: <Server className="h-5 w-5" />,
      command: `/radius add address=${connectionType === 'public_ip' ? serverAddress : '10.0.0.1'} secret=${radiusSecret} timeout=3s service=ppp,hotspot,login certificate=none`,
      label: 'Radius'
    },
    {
      id: 'hotspot-profile',
      title: language === 'ar' ? 'ربط RADIUS مع Hotspot' : 'Link RADIUS with Hotspot',
      description: language === 'ar'
        ? 'تفعيل RADIUS لجميع بروفايلات Hotspot الموجودة'
        : 'Enable RADIUS for all existing Hotspot profiles',
      icon: <Wifi className="h-5 w-5" />,
      command: `:foreach profile in=[/ip hotspot profile find] do={
  /ip hotspot profile set $profile login-by=cookie,http-pap,mac-cookie use-radius=yes radius-accounting=yes radius-interim-update=30s
}`,
      label: 'Hotspot'
    },
    {
      id: 'pppoe-server',
      title: language === 'ar' ? 'إعداد PPPoE Server' : 'Setup PPPoE Server',
      description: language === 'ar'
        ? 'تفعيل RADIUS لخادم PPPoE'
        : 'Enable RADIUS for PPPoE server',
      icon: <Router className="h-5 w-5" />,
      command: `/ppp aaa set use-radius=yes accounting=yes interim-update=1m`,
      label: 'PPPoE'
    },
    {
      id: 'radius-incoming',
      title: language === 'ar' ? 'تفعيل RADIUS Incoming' : 'Enable RADIUS Incoming',
      description: language === 'ar'
        ? 'تفعيل استقبال أوامر CoA و Disconnect من خادم RADIUS'
        : 'Enable receiving CoA and Disconnect commands from RADIUS server',
      icon: <Globe className="h-5 w-5" />,
      command: `/radius incoming set port=1700 accept=yes`,
      label: 'Incoming'
    },
    {
      id: 'require-message-auth',
      title: language === 'ar' ? 'ضبط Message Auth' : 'Set Message Auth',
      description: language === 'ar'
        ? 'تعطيل require-message-auth للتوافق مع FreeRADIUS'
        : 'Disable require-message-auth for FreeRADIUS compatibility',
      icon: <Shield className="h-5 w-5" />,
      command: `/radius set [find] require-message-auth=no`,
      label: 'require-message'
    }
  ];

  // Filter commands based on connection type
  const filteredCommands = commands.filter(cmd => {
    if (cmd.showIf === undefined) return true;
    return cmd.showIf;
  });

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" dir={direction}>
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'ar' ? 'اتصال ميكروتك' : 'MikroTik Connection'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'ar' 
                ? 'نقطة اتصال من الميكروتك الى النظام'
                : 'Connection point from MikroTik to the system'}
            </p>
          </div>
        </div>

        {/* NAS Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Router className="h-5 w-5" />
              {language === 'ar' ? 'اختر جهاز NAS' : 'Select NAS Device'}
            </CardTitle>
            <CardDescription>
              {language === 'ar' 
                ? 'اختر جهاز MikroTik لعرض أوامر الإعداد الخاصة به'
                : 'Select a MikroTik device to view its setup commands'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {nasLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedNasId} onValueChange={setSelectedNasId}>
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue placeholder={language === 'ar' ? 'اختر جهاز...' : 'Select device...'} />
                </SelectTrigger>
                <SelectContent>
                  {nasDevices?.map((nas) => (
                    <SelectItem key={nas.id} value={nas.id.toString()}>
                      {nas.shortname} - {nas.nasname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Commands Section */}
        {selectedNasId && (
          <Card className="bg-slate-900 text-white border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">
                {language === 'ar' ? 'أوامر الإعداد' : 'Setup Commands'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {language === 'ar'
                  ? `أوامر إعداد ${selectedNas?.shortname} - نوع الاتصال: ${
                      connectionType === 'public_ip' ? 'اي بي عالمي' :
                      connectionType === 'vpn_pptp' ? 'VPN PPTP' : 'VPN SSTP'
                    }`
                  : `Setup commands for ${selectedNas?.shortname} - Connection type: ${connectionType}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredCommands.map((cmd) => (
                <div key={cmd.id} className="rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                  {/* Command Header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-700/50">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        onClick={() => copyToClipboard(cmd.command, cmd.id)}
                      >
                        {copiedCommand === cmd.id ? (
                          <>
                            <Check className="h-3 w-3 ml-1" />
                            {language === 'ar' ? 'تم' : 'Done'}
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 ml-1" />
                            {language === 'ar' ? 'نسخ' : 'Copy'}
                          </>
                        )}
                      </Button>
                    </div>
                    <span className="text-xs font-medium text-slate-300 bg-slate-600 px-2 py-1 rounded">
                      {cmd.label}
                    </span>
                  </div>
                  {/* Command Content */}
                  <div className="p-4">
                    <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all" dir="ltr">
                      {cmd.command}
                    </pre>
                  </div>
                  {/* Description */}
                  <div className="px-4 pb-3 border-t border-slate-700 pt-2">
                    <p className="text-xs text-slate-400">{cmd.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Instructions Card */}
        {!selectedNasId && (
          <Card>
            <CardHeader>
              <CardTitle>
                {language === 'ar' ? 'تعليمات الإعداد' : 'Setup Instructions'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {language === 'ar' ? 'أضف جهاز NAS' : 'Add NAS Device'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar'
                        ? 'قم بإضافة جهاز MikroTik من صفحة أجهزة NAS أولاً'
                        : 'Add your MikroTik device from the NAS Devices page first'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {language === 'ar' ? 'اختر الجهاز' : 'Select Device'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar'
                        ? 'اختر الجهاز من القائمة أعلاه لعرض الأوامر'
                        : 'Select the device from the list above to view commands'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {language === 'ar' ? 'انسخ الأوامر' : 'Copy Commands'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar'
                        ? 'انسخ كل أمر والصقه في Terminal الخاص بـ MikroTik'
                        : 'Copy each command and paste it in MikroTik Terminal'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-medium">
                      {language === 'ar' ? 'اختبر الاتصال' : 'Test Connection'}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {language === 'ar'
                        ? 'تأكد من نجاح الاتصال عبر اختبار مستخدم RADIUS'
                        : 'Verify connection by testing a RADIUS user'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
