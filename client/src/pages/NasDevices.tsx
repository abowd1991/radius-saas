import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Globe,
  Shield,
  Link2,
  Eye,
  EyeOff,
  Loader2,
  WifiOff,
  ArrowRightLeft,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { useState, useRef } from "react";

// Connection type options
const connectionTypes = [
  { value: "public_ip", labelAr: "اي بي عالمي", labelEn: "Public IP", icon: Globe },
  { value: "vpn_l2tp", labelAr: "اتصال VPN L2TP", labelEn: "VPN L2TP", icon: Shield },
  { value: "vpn_sstp", labelAr: "اتصال VPN SSTP", labelEn: "VPN SSTP", icon: Link2 },
];

export default function NasDevices() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDevice, setEditingDevice] = useState<any>(null);
  const [connectionType, setConnectionType] = useState("public_ip");
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("create");
  const [autoIpAddress, setAutoIpAddress] = useState("");
  const [apiTestResult, setApiTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [ipAddress, setIpAddress] = useState("");
  const [ipWarning, setIpWarning] = useState<string | null>(null);

  // Check if IP is private
  const isPrivateIP = (ip: string): boolean => {
    if (!ip) return false;
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return false;
    // 10.0.0.0 - 10.255.255.255
    if (parts[0] === 10) return true;
    // 172.16.0.0 - 172.31.255.255
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0 - 192.168.255.255
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  };

  // Handle IP change with validation
  const handleIpChange = (value: string) => {
    setIpAddress(value);
    if (connectionType === "public_ip" && isPrivateIP(value)) {
      setIpWarning(language === "ar" 
        ? "⚠️ هذا عنوان IP خاص (Private). إذا كان الراوتر خلف NAT، استخدم اتصال VPN بدلاً من ذلك."
        : "⚠️ This is a private IP address. If router is behind NAT, use VPN connection instead."
      );
    } else {
      setIpWarning(null);
    }
  };
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [vpnStatusDevice, setVpnStatusDevice] = useState<any>(null);
  const [isSyncingVpn, setIsSyncingVpn] = useState(false);
  // VPN credentials are auto-generated on the server, no need for state

  // Fetch NAS devices
  const { data: devices, isLoading, refetch } = trpc.nas.list.useQuery();

  // Mutations
  const createDevice = trpc.nas.create.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إضافة الشبكة بنجاح" : "Network added successfully");
      setIsAddDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const updateDevice = trpc.nas.update.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الشبكة بنجاح" : "Network updated successfully");
      setEditingDevice(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteDevice = trpc.nas.delete.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم حذف الشبكة" : "Network deleted");
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // VPN Status Query
  const vpnStatusQuery = trpc.nas.getVpnStatus.useQuery(
    { id: vpnStatusDevice?.id || 0 },
    { enabled: !!vpnStatusDevice }
  );

  // Sync VPN IP Mutation
  const syncVpnIp = trpc.nas.syncVpnIp.useMutation({
    onSuccess: (result: any) => {
      setIsSyncingVpn(false);
      if (result.success) {
        toast.success(result.message);
        vpnStatusQuery.refetch();
        refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: any) => {
      setIsSyncingVpn(false);
      toast.error(error.message);
    },
  });

  // Auto-sync VPN IP Mutation with retry
  const autoSyncVpnIp = trpc.nas.autoSyncVpnIp.useMutation({
    onSuccess: (result: any) => {
      setIsSyncingVpn(false);
      if (result.success) {
        toast.success(`${result.message} (محاولة ${result.attempts})`);
        vpnStatusQuery.refetch();
        refetch();
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: any) => {
      setIsSyncingVpn(false);
      toast.error(error.message);
    },
  });

  const handleSyncVpnIp = (nasId: number) => {
    setIsSyncingVpn(true);
    autoSyncVpnIp.mutate({ id: nasId, maxRetries: 3, retryDelayMs: 5000 });
  };

  // Retry Provisioning Mutation
  const retryProvisioning = trpc.nas.retryProvisioning.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        toast.success(language === "ar" ? "تم إعادة التهيئة بنجاح" : "Provisioning completed successfully");
      } else {
        toast.info(result.message);
      }
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const testApiConnection = trpc.nas.testApiConnection.useMutation({
    onSuccess: (result: any) => {
      setApiTestResult(result);
      setIsTestingApi(false);
      if (result.success) {
        toast.success(language === "ar" ? "✅ اتصال API ناجح!" : "✅ API connection successful!");
      } else {
        toast.error(result.message);
      }
    },
    onError: (error: any) => {
      setApiTestResult({ success: false, message: error.message });
      setIsTestingApi(false);
      toast.error(error.message);
    },
  });

  const handleTestApi = () => {
    // Get form values
    const form = document.querySelector('form') as HTMLFormElement;
    if (!form) return;
    
    const formData = new FormData(form);
    const nasIp = formData.get('ipAddress') as string;
    const apiPort = parseInt(formData.get('mikrotikApiPort') as string) || 8728;
    const apiUser = formData.get('mikrotikApiUser') as string;
    const apiPassword = formData.get('mikrotikApiPassword') as string;
    
    if (!nasIp || nasIp === 'pending') {
      toast.error(language === "ar" ? "يرجى إدخال عنوان IP" : "Please enter IP address");
      return;
    }
    if (!apiUser) {
      toast.error(language === "ar" ? "يرجى إدخال اسم مستخدم API" : "Please enter API username");
      return;
    }
    if (!apiPassword) {
      toast.error(language === "ar" ? "يرجى إدخال كلمة مرور API" : "Please enter API password");
      return;
    }
    
    setIsTestingApi(true);
    setApiTestResult(null);
    // Include nasId if editing an existing device (for VPN IP resolution)
    testApiConnection.mutate({ 
      nasIp, 
      apiPort, 
      apiUser, 
      apiPassword,
      nasId: editingDevice?.id 
    });
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
      case "maintenance":
        return <Badge variant="default" className="bg-yellow-500">{language === "ar" ? "صيانة" : "Maintenance"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConnectionTypeBadge = (type: string) => {
    const connType = connectionTypes.find(c => c.value === type);
    if (!connType) return null;
    const Icon = connType.icon;
    return (
      <Badge variant="outline" className="gap-1">
        <Icon className="h-3 w-3" />
        {language === "ar" ? connType.labelAr : connType.labelEn}
      </Badge>
    );
  };

  // Provisioning Status Badge
  const getProvisioningStatusBadge = (status: string | null | undefined, connectionType: string | null) => {
    // Only show for VPN connections
    if (connectionType === 'public_ip') return null;
    
    switch (status) {
      case 'ready':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle className="h-3 w-3" />
            {language === "ar" ? "جاهز" : "Ready"}
          </Badge>
        );
      case 'provisioning':
        return (
          <Badge variant="default" className="bg-blue-500 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {language === "ar" ? "جاري التهيئة" : "Provisioning"}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {language === "ar" ? "خطأ" : "Error"}
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            {language === "ar" ? "بانتظار الاتصال" : "Pending"}
          </Badge>
        );
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // For VPN connections, IP will be assigned automatically by the system
    // For Public IP, user provides the IP manually
    const ipAddress = connectionType === "public_ip" 
      ? formData.get("ipAddress") as string
      : "pending"; // Will be updated when VPN connects
    
    // MikroTik API settings
    const apiEnabled = formData.get("apiEnabled") === "on";
    const mikrotikApiPort = formData.get("mikrotikApiPort") ? parseInt(formData.get("mikrotikApiPort") as string) : 8728;
    const mikrotikApiUser = formData.get("mikrotikApiUser") as string || undefined;
    const mikrotikApiPassword = formData.get("mikrotikApiPassword") as string || undefined;
    
    const data = {
      name: formData.get("name") as string,
      ipAddress: ipAddress,
      secret: formData.get("secret") as string,
      type: formData.get("type") as "mikrotik" | "cisco" | "other",
      connectionType: connectionType as "public_ip" | "vpn_l2tp" | "vpn_sstp",
      description: formData.get("description") as string || undefined,
      // VPN credentials will be auto-generated on the server
      vpnUsername: undefined,
      vpnPassword: undefined,
      // MikroTik API settings (optional)
      apiEnabled: apiEnabled,
      mikrotikApiPort: mikrotikApiPort,
      mikrotikApiUser: mikrotikApiUser,
      mikrotikApiPassword: mikrotikApiPassword,
    };

    if (editingDevice) {
      updateDevice.mutate({ id: editingDevice.id, ...data });
    } else {
      createDevice.mutate(data);
    }
  };

  const filteredDevices = devices?.filter((device: any) =>
    (device.shortname || device.nasname).toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.nasname.includes(searchQuery)
  );

  // Create Network Form Component
  const CreateNetworkForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Connection Type Selector */}
      <div className="space-y-3">
        <Label className="text-base font-medium">
          {language === "ar" ? "نوع الاتصال" : "Connection Type"}
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {connectionTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = connectionType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setConnectionType(type.value)}
                className={`
                  relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                  ${isSelected 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <Icon className={`h-6 w-6 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium text-center">
                  {language === "ar" ? type.labelAr : type.labelEn}
                </span>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">{language === "ar" ? "إسم الشبكة" : "Network Name"}</Label>
          <Input 
            id="name" 
            name="name" 
            required 
            placeholder={language === "ar" ? "أدخل اسم الشبكة" : "Enter network name"}
            className="bg-background"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ipAddress">
            {connectionType === "public_ip" 
              ? (language === "ar" ? "عنوان IP للراوتر" : "Router IP Address")
              : (language === "ar" ? "عنوان IP النفق (تلقائي)" : "Tunnel IP (Auto)")
            }
          </Label>
          {connectionType === "public_ip" ? (
            <>
              <Input 
                id="ipAddress" 
                name="ipAddress" 
                placeholder="203.0.113.50"
                value={ipAddress}
                onChange={(e) => handleIpChange(e.target.value)}
                required 
                className={`bg-background ${ipWarning ? 'border-amber-500' : ''}`}
              />
              <p className="text-xs text-muted-foreground">
                {language === "ar" 
                  ? "أدخل عنوان IP العام للراوتر (يجب أن يكون قابلاً للوصول من الإنترنت)"
                  : "Enter the router's public IP address (must be reachable from the internet)"
                }
              </p>
              {ipWarning && (
                <p className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                  {ipWarning}
                </p>
              )}
            </>
          ) : (
            <div className="relative">
              <Input 
                id="ipAddress" 
                name="ipAddress" 
                value={autoIpAddress || (language === "ar" ? "سيتم تعيينه تلقائياً" : "Will be assigned automatically")}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
              <Badge variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">
                {language === "ar" ? "تلقائي" : "Auto"}
              </Badge>
            </div>
          )}
          {connectionType !== "public_ip" && (
            <p className="text-xs text-muted-foreground">
              {language === "ar" 
                ? "سيتم تعيين عنوان IP تلقائياً بعد إنشاء اتصال VPN"
                : "IP address will be assigned automatically after VPN connection is established"
              }
            </p>
          )}
        </div>
      </div>

      {/* VPN Credentials - Only show for VPN connection types */}
      {connectionType !== "public_ip" && (
        <div className="p-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="h-4 w-4" />
            <span className="font-medium text-sm">
              {language === "ar" ? "بيانات اتصال VPN" : "VPN Connection Credentials"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vpnUsername">
                {language === "ar" ? "اسم مستخدم VPN (تلقائي)" : "VPN Username (Auto)"}
              </Label>
              <Input 
                id="vpnUsername" 
                value={language === "ar" ? "سيتم توليده تلقائياً" : "Will be auto-generated"}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vpnPassword">
                {language === "ar" ? "كلمة مرور VPN (تلقائي)" : "VPN Password (Auto)"}
              </Label>
              <Input 
                id="vpnPassword" 
                value={language === "ar" ? "سيتم توليدها تلقائياً" : "Will be auto-generated"}
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {language === "ar" 
              ? "سيتم توليد بيانات VPN تلقائياً وإنشاء مستخدم VPN في السيرفر عند حفظ الشبكة."
              : "VPN credentials will be auto-generated and VPN user will be created on the server when saving."
            }
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="secret">
            {language === "ar" ? "RADIUS Secret" : "RADIUS Secret"}
          </Label>
          <div className="relative">
            <Input 
              id="secret" 
              name="secret" 
              type={showPassword ? "text" : "password"} 
              required 
              className="bg-background pr-10"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">{language === "ar" ? "نوع" : "Type"}</Label>
          <Select name="type" defaultValue="mikrotik">
            <SelectTrigger className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mikrotik">{language === "ar" ? "مايكروتك" : "MikroTik"}</SelectItem>
              <SelectItem value="cisco">Cisco</SelectItem>
              <SelectItem value="ubiquiti">Ubiquiti</SelectItem>
              <SelectItem value="other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">{language === "ar" ? "وصف" : "Description"}</Label>
        <Input 
          id="description" 
          name="description" 
          className="bg-background"
          placeholder={language === "ar" ? "وصف اختياري للشبكة" : "Optional network description"}
        />
      </div>

      <div className="flex justify-center pt-4">
        <Button 
          type="submit" 
          disabled={createDevice.isPending}
          className="min-w-[200px]"
        >
          {createDevice.isPending 
            ? (language === "ar" ? "جاري الحفظ..." : "Saving...") 
            : (language === "ar" ? "حفظ التغييرات" : "Save Changes")
          }
        </Button>
      </div>
    </form>
  );

  // API Connection Tab Content
  const SpecialToolsContent = () => {
    const [selectedNasId, setSelectedNasId] = useState<number | null>(null);
    const [apiEnabled, setApiEnabled] = useState(false);
    const [apiPort, setApiPort] = useState("8728");
    const [apiUser, setApiUser] = useState("admin");
    const [apiPassword, setApiPassword] = useState("");
    const [testResult, setTestResult] = useState<{success: boolean; message: string} | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [connectionTested, setConnectionTested] = useState(false);

    // Get selected NAS device
    const selectedNas = devices?.find((d: any) => d.id === selectedNasId);

    // Load existing API settings when network is selected
    const handleNetworkSelect = (nasId: string) => {
      const id = parseInt(nasId);
      setSelectedNasId(id);
      setTestResult(null);
      setConnectionTested(false);
      
      const device = devices?.find((d: any) => d.id === id);
      if (device) {
        setApiEnabled(device.apiEnabled || false);
        setApiPort(device.mikrotikApiPort?.toString() || "8728");
        setApiUser(device.mikrotikApiUser || "admin");
        setApiPassword(""); // Don't load password for security
      }
    };

    const testApi = trpc.nas.testApiConnection.useMutation({
      onSuccess: (data) => {
        const result = data as { success: boolean; message: string };
        setTestResult(result);
        setIsTesting(false);
        if (result.success) {
          setConnectionTested(true);
          toast.success(language === "ar" ? "اتصال ناجح!" : "Connection successful!");
        } else {
          setConnectionTested(false);
          toast.error(result.message);
        }
      },
      onError: (error) => {
        setTestResult({ success: false, message: error.message });
        setIsTesting(false);
        setConnectionTested(false);
        toast.error(error.message);
      },
    });

    const saveApiSettings = trpc.nas.update.useMutation({
      onSuccess: () => {
        setIsSaving(false);
        toast.success(language === "ar" ? "تم حفظ إعدادات API بنجاح" : "API settings saved successfully");
        refetch();
      },
      onError: (error) => {
        setIsSaving(false);
        toast.error(error.message);
      },
    });

    const handleTest = () => {
      if (!selectedNas) {
        toast.error(language === "ar" ? "يرجى اختيار شبكة" : "Please select a network");
        return;
      }
      if (!apiPassword) {
        toast.error(language === "ar" ? "يرجى إدخال كلمة مرور API" : "Please enter API password");
        return;
      }
      setIsTesting(true);
      setTestResult(null);
      setConnectionTested(false);
      testApi.mutate({
        nasIp: selectedNas.nasname,
        apiPort: parseInt(apiPort),
        apiUser,
        apiPassword,
        nasId: selectedNas.id, // Send NAS ID to get VPN local IP
      });
    };

    const handleSave = () => {
      if (!selectedNasId) {
        toast.error(language === "ar" ? "يرجى اختيار شبكة" : "Please select a network");
        return;
      }
      if (apiEnabled && !connectionTested) {
        toast.error(language === "ar" ? "يرجى اختبار الاتصال أولاً" : "Please test the connection first");
        return;
      }
      setIsSaving(true);
      saveApiSettings.mutate({
        id: selectedNasId,
        apiEnabled,
        mikrotikApiPort: parseInt(apiPort),
        mikrotikApiUser: apiUser,
        mikrotikApiPassword: apiPassword || undefined,
      });
    };

    return (
      <div className="space-y-6 py-4">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold mb-2">
            {language === "ar" ? "إعدادات MikroTik API" : "MikroTik API Settings"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {language === "ar" 
              ? "إدارة إعدادات API للشبكات الموجودة"
              : "Manage API settings for existing networks"
            }
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          {/* Select Network */}
          <div className="space-y-2">
            <Label>{language === "ar" ? "اختر الشبكة" : "Select Network"}</Label>
            <Select 
              value={selectedNasId?.toString() || ""} 
              onValueChange={handleNetworkSelect}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={language === "ar" ? "اختر شبكة..." : "Select network..."} />
              </SelectTrigger>
              <SelectContent>
                {devices?.filter((d: any) => d.type === "mikrotik").map((device: any) => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.shortname} ({device.nasname})
                    {device.apiEnabled && " ✓"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedNasId && (
            <>
              {/* API Enabled Toggle */}
              <div className="p-4 rounded-lg border border-dashed border-blue-500/30 bg-blue-500/5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-sm">
                      {language === "ar" ? "تفعيل API" : "Enable API"}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={apiEnabled}
                    onChange={(e) => {
                      setApiEnabled(e.target.checked);
                      setConnectionTested(false);
                    }}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>
                <p className="text-xs text-muted-foreground mt-2">
                  {language === "ar" 
                    ? "تفعيل API يسمح بتغيير السرعة فوراً بدون انقطاع المستخدم"
                    : "Enabling API allows instant speed changes without disconnecting users"
                  }
                </p>
              </div>

              {/* API Port */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "منفذ API" : "API Port"}</Label>
                <Input
                  type="number"
                  value={apiPort}
                  onChange={(e) => {
                    setApiPort(e.target.value);
                    setConnectionTested(false);
                  }}
                  placeholder="8728"
                  className="bg-background"
                />
              </div>

              {/* API Username */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم مستخدم API" : "API Username"}</Label>
                <Input
                  value={apiUser}
                  onChange={(e) => {
                    setApiUser(e.target.value);
                    setConnectionTested(false);
                  }}
                  placeholder="admin"
                  className="bg-background"
                />
              </div>

              {/* API Password */}
              <div className="space-y-2">
                <Label>{language === "ar" ? "كلمة مرور API" : "API Password"}</Label>
                <Input
                  type="password"
                  value={apiPassword}
                  onChange={(e) => {
                    setApiPassword(e.target.value);
                    setConnectionTested(false);
                  }}
                  placeholder={selectedNas?.mikrotikApiPassword ? "•••••••• (محفوظة)" : "••••••••"}
                  className="bg-background"
                />
                {selectedNas?.mikrotikApiPassword && (
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" 
                      ? "اترك فارغاً للإبقاء على كلمة المرور الحالية"
                      : "Leave empty to keep current password"
                    }
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                {/* Test Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || !apiPassword}
                  className="flex-1 gap-2"
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {language === "ar" ? "جاري..." : "Testing..."}
                    </>
                  ) : (
                    <>
                      <Wifi className="h-4 w-4" />
                      {language === "ar" ? "اختبار" : "Test"}
                    </>
                  )}
                </Button>

                {/* Save Button */}
                <Button
                  onClick={handleSave}
                  disabled={isSaving || (apiEnabled && !connectionTested)}
                  className="flex-1 gap-2"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {language === "ar" ? "جاري..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      {language === "ar" ? "حفظ الإعدادات" : "Save Settings"}
                    </>
                  )}
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  testResult.success 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  {testResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className={testResult.success ? 'text-green-600' : 'text-red-600'}>
                    {testResult.message}
                  </span>
                </div>
              )}

              {/* Info about test requirement */}
              {apiEnabled && !connectionTested && (
                <p className="text-xs text-amber-600 text-center">
                  {language === "ar" 
                    ? "يجب اختبار الاتصال بنجاح قبل الحفظ"
                    : "Connection must be tested successfully before saving"
                  }
                </p>
              )}
            </>
          )}

          {/* No networks message */}
          {devices?.filter((d: any) => d.type === "mikrotik").length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Router className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{language === "ar" ? "لا توجد شبكات MikroTik" : "No MikroTik networks found"}</p>
              <p className="text-sm mt-2">
                {language === "ar" 
                  ? "أنشئ شبكة جديدة أولاً"
                  : "Create a new network first"
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === "ar" ? "إنشاء شبكة جديدة" : "Create New Network"}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span>{language === "ar" ? "الرئيسية" : "Home"}</span>
            <span>›</span>
            <span>{language === "ar" ? "قائمة الشبكات" : "Network List"}</span>
          </p>
        </div>
      </div>

      {/* Main Card with Tabs */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="create" className="gap-2">
                <Edit className="h-4 w-4" />
                {language === "ar" ? "إنشاء شبكة جديدة" : "Create Network"}
              </TabsTrigger>
              <TabsTrigger value="tools" className="gap-2">
                <Wifi className="h-4 w-4" />
                {language === "ar" ? "اتصال API" : "API Connection"}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="create">
              <CreateNetworkForm />
            </TabsContent>
            
            <TabsContent value="tools">
              <SpecialToolsContent />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الشبكات" : "Total Networks"}
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
              {devices?.filter((d: any) => d.status === "active").length || 0}
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
              {devices?.filter((d: any) => d.status === "inactive").length || 0}
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
              {devices?.filter((d: any) => d.type === "mikrotik").length || 0}
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
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة الشبكات" : "Network List"}</CardTitle>
          <CardDescription>
            {language === "ar" ? "جميع الشبكات المسجلة في النظام" : "All registered networks in the system"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDevices && filteredDevices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>{language === "ar" ? "نوع الاتصال" : "Connection Type"}</TableHead>
                  <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{language === "ar" ? "حالة التهيئة" : "Provisioning"}</TableHead>
                  <TableHead>{language === "ar" ? "آخر اتصال" : "Last Seen"}</TableHead>
                  <TableHead className="text-center">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device: any) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Router className="h-4 w-4 text-muted-foreground" />
                        {device.shortname || device.nasname}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{device.nasname}</TableCell>
                    <TableCell>
                      {getConnectionTypeBadge((device as any).connectionType || "public_ip")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{device.type || "mikrotik"}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(device.status)}</TableCell>
                    <TableCell>{getProvisioningStatusBadge((device as any).provisioningStatus, (device as any).connectionType)}</TableCell>
                    <TableCell>{formatDate(device.lastSeen)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingDevice(device)}>
                            <Edit className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {t("common.edit")}
                          </DropdownMenuItem>
                          {/* VPN Status option - only for VPN connection types */}
                          {((device as any).connectionType === 'vpn_l2tp' || (device as any).connectionType === 'vpn_sstp') && (
                            <DropdownMenuItem onClick={() => setVpnStatusDevice(device)}>
                              <Wifi className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "حالة VPN" : "VPN Status"}
                            </DropdownMenuItem>
                          )}
                          {/* Retry Provisioning - only for VPN with pending/error status */}
                          {((device as any).connectionType === 'vpn_l2tp' || (device as any).connectionType === 'vpn_sstp') && 
                           ((device as any).provisioningStatus === 'pending' || (device as any).provisioningStatus === 'error') && (
                            <DropdownMenuItem onClick={() => retryProvisioning.mutate({ nasId: device.id })}>
                              <Zap className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {language === "ar" ? "إعادة التهيئة" : "Retry Provisioning"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              if (confirm(language === "ar" ? "هل أنت متأكد من حذف هذه الشبكة؟" : "Are you sure you want to delete this network?")) {
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
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Router className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">
                {language === "ar" ? "لا توجد شبكات" : "No Networks"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {language === "ar" ? "قم بإضافة شبكة جديدة للبدء" : "Add a new network to get started"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingDevice} onOpenChange={(open) => !open && setEditingDevice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل الشبكة" : "Edit Network"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "تعديل بيانات الشبكة" : "Edit network information"}
            </DialogDescription>
          </DialogHeader>
          {editingDevice && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Connection Type Selector */}
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  {language === "ar" ? "نوع الاتصال" : "Connection Type"}
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {connectionTypes.map((type) => {
                    const Icon = type.icon;
                    const isSelected = connectionType === type.value;
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setConnectionType(type.value)}
                        className={`
                          relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
                          ${isSelected 
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                          }
                        `}
                      >
                        <Icon className={`h-6 w-6 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="text-sm font-medium text-center">
                          {language === "ar" ? type.labelAr : type.labelEn}
                        </span>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">{language === "ar" ? "إسم الشبكة" : "Network Name"}</Label>
                  <Input 
                    id="edit-name" 
                    name="name" 
                    defaultValue={editingDevice.shortname || ""} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-ipAddress">IP</Label>
                  <Input 
                    id="edit-ipAddress" 
                    name="ipAddress" 
                    defaultValue={editingDevice.nasname} 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-secret">{language === "ar" ? "كلمة السر" : "Secret"}</Label>
                  <div className="relative">
                    <Input 
                      id="edit-secret" 
                      name="secret" 
                      type={showPassword ? "text" : "password"} 
                      defaultValue={editingDevice.secret || ""} 
                      required 
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">{language === "ar" ? "نوع" : "Type"}</Label>
                  <Select name="type" defaultValue={editingDevice.type || "mikrotik"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mikrotik">{language === "ar" ? "مايكروتك" : "MikroTik"}</SelectItem>
                      <SelectItem value="cisco">Cisco</SelectItem>
                      <SelectItem value="ubiquiti">Ubiquiti</SelectItem>
                      <SelectItem value="other">{language === "ar" ? "أخرى" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">{language === "ar" ? "وصف" : "Description"}</Label>
                <Input 
                  id="edit-description" 
                  name="description" 
                  defaultValue={editingDevice.description || ""} 
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingDevice(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={updateDevice.isPending}>
                  {updateDevice.isPending 
                    ? (language === "ar" ? "جاري الحفظ..." : "Saving...") 
                    : t("common.save")
                  }
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* VPN Status Dialog */}
      <Dialog open={!!vpnStatusDevice} onOpenChange={(open) => !open && setVpnStatusDevice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {language === "ar" ? "حالة VPN" : "VPN Status"}
            </DialogTitle>
            <DialogDescription>
              {vpnStatusDevice?.shortname || vpnStatusDevice?.nasname}
            </DialogDescription>
          </DialogHeader>
          
          {vpnStatusQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vpnStatusQuery.data ? (
            <div className="space-y-4">
              {/* VPN Connection Status */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {vpnStatusQuery.data.connected ? (
                    <div className="p-2 rounded-full bg-green-500/10">
                      <Wifi className="h-5 w-5 text-green-500" />
                    </div>
                  ) : (
                    <div className="p-2 rounded-full bg-red-500/10">
                      <WifiOff className="h-5 w-5 text-red-500" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">
                      {language === "ar" ? "حالة الاتصال" : "Connection Status"}
                    </p>
                    <p className={`text-sm ${vpnStatusQuery.data.connected ? 'text-green-500' : 'text-red-500'}`}>
                      {vpnStatusQuery.data.message}
                    </p>
                  </div>
                </div>
                <Badge variant={vpnStatusQuery.data.connected ? "default" : "destructive"}>
                  {vpnStatusQuery.data.connected 
                    ? (language === "ar" ? "متصل" : "Connected")
                    : (language === "ar" ? "غير متصل" : "Disconnected")
                  }
                </Badge>
              </div>

              {/* IP Information */}
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "اسم مستخدم VPN" : "VPN Username"}
                  </span>
                  <span className="font-mono text-sm">{vpnStatusQuery.data.vpnUsername || '-'}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "VPN Local IP (مصدر RADIUS)" : "VPN Local IP (RADIUS Source)"}
                  </span>
                  <span className={`font-mono text-sm ${vpnStatusQuery.data.vpnLocalIp ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {vpnStatusQuery.data.vpnLocalIp || (language === "ar" ? "غير متوفر" : "Not available")}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">
                    {language === "ar" ? "nasname الحالي" : "Current nasname"}
                  </span>
                  <span className={`font-mono text-sm ${
                    vpnStatusQuery.data.isPlaceholder ? 'text-yellow-500' : 
                    (vpnStatusQuery.data.nasname === vpnStatusQuery.data.vpnLocalIp ? 'text-green-500' : 'text-orange-500')
                  }`}>
                    {vpnStatusQuery.data.nasname}
                  </span>
                </div>

                {/* Sync Status */}
                {vpnStatusQuery.data.needsSync && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      {language === "ar" 
                        ? "⚠️ nasname لا يتطابق مع VPN IP. يجب المزامنة ليعمل RADIUS."
                        : "⚠️ nasname doesn't match VPN IP. Sync required for RADIUS to work."
                      }
                    </p>
                  </div>
                )}

                {/* Success Status */}
                {vpnStatusQuery.data.connected && !vpnStatusQuery.data.needsSync && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      {language === "ar" 
                        ? "✅ النظام جاهز - RADIUS سيعمل بشكل صحيح"
                        : "✅ System ready - RADIUS will work correctly"
                      }
                    </p>
                  </div>
                )}
              </div>

              {/* Sync Button */}
              {vpnStatusQuery.data.connected && vpnStatusQuery.data.needsSync && (
                <Button 
                  onClick={() => handleSyncVpnIp(vpnStatusDevice.id)}
                  disabled={isSyncingVpn}
                  className="w-full"
                >
                  {isSyncingVpn ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {language === "ar" ? "جاري المزامنة..." : "Syncing..."}
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      {language === "ar" ? "مزامنة VPN IP" : "Sync VPN IP"}
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              {language === "ar" ? "فشل تحميل البيانات" : "Failed to load data"}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => vpnStatusQuery.refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {language === "ar" ? "تحديث" : "Refresh"}
            </Button>
            <Button variant="secondary" onClick={() => setVpnStatusDevice(null)}>
              {language === "ar" ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
