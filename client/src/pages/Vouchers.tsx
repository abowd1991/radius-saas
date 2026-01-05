import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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
  Download,
  CreditCard,
  Search,
  Filter,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Printer,
  Package,
  Eye,
  Ban,
  RefreshCw,
  FileSpreadsheet,
  Wifi,
} from "lucide-react";
import { useState } from "react";

export default function Vouchers() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [activeTab, setActiveTab] = useState("cards");
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [redeemCode, setRedeemCode] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  
  // Form state for generating cards - Updated with all new fields
  const [generateForm, setGenerateForm] = useState({
    planId: "",
    quantity: "1",
    batchName: "",
    cardPrice: "0",
    prefix: "",
    simultaneousUse: "1",
    usernameLength: "6",
    passwordLength: "4",
    subscriberGroup: "Default group",
    hotspotPort: "",
    internetTimeValue: "0",
    internetTimeUnit: "hours" as "hours" | "days",
    cardTimeValue: "0",
    cardTimeUnit: "hours" as "hours" | "days",
    timeFromActivation: true,
    macBinding: false,
  });

  // Print settings
  const [printSettings, setPrintSettings] = useState({
    companyName: "RADIUS SaaS",
    hotspotUrl: "",
    cardsPerPage: "8",
  });

  // Fetch vouchers
  const { data: vouchers, isLoading, refetch } = trpc.vouchers.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as "unused" | "active" | "used" | "expired" | "suspended" | "cancelled" : undefined,
  });

  // Fetch batches
  const { data: batches, refetch: refetchBatches } = trpc.vouchers.getBatches.useQuery();

  // Fetch plans for selection
  const { data: plans } = trpc.plans.list.useQuery();

  // Fetch subscriber groups
  const { data: subscriberGroups } = trpc.vouchers.getSubscriberGroups.useQuery();

  // Mutations
  const generateMutation = trpc.vouchers.generate.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' 
        ? `تم إنشاء ${data.quantity} كرت بنجاح` 
        : `Successfully generated ${data.quantity} cards`
      );
      setIsGenerateDialogOpen(false);
      refetch();
      refetchBatches();
      resetGenerateForm();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const redeemMutation = trpc.vouchers.redeem.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تفعيل الكرت بنجاح' : 'Card activated successfully');
      setIsRedeemDialogOpen(false);
      setRedeemCode("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const suspendMutation = trpc.vouchers.suspend.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم تعليق الكرت' : 'Card suspended');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unsuspendMutation = trpc.vouchers.unsuspend.useMutation({
    onSuccess: () => {
      toast.success(language === 'ar' ? 'تم إعادة تفعيل الكرت' : 'Card reactivated');
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generatePDFMutation = trpc.vouchers.generateBatchPDF.useMutation({
    onSuccess: (data) => {
      if (data.htmlUrl) {
        window.open(data.htmlUrl, '_blank');
      }
      toast.success(language === 'ar' ? 'تم إنشاء ملف PDF' : 'PDF generated successfully');
      setIsPrintDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const resetGenerateForm = () => {
    setGenerateForm({
      planId: "",
      quantity: "1",
      batchName: "",
      cardPrice: "0",
      prefix: "",
      simultaneousUse: "1",
      usernameLength: "6",
      passwordLength: "4",
      subscriberGroup: "Default group",
      hotspotPort: "",
      internetTimeValue: "0",
      internetTimeUnit: "hours",
      cardTimeValue: "0",
      cardTimeUnit: "hours",
      timeFromActivation: true,
      macBinding: false,
    });
  };

  const handleGenerateCards = () => {
    if (!generateForm.planId) {
      toast.error(language === 'ar' ? 'يرجى اختيار الخدمة' : 'Please select a plan');
      return;
    }
    
    generateMutation.mutate({
      planId: parseInt(generateForm.planId),
      quantity: parseInt(generateForm.quantity) || 1,
      batchName: generateForm.batchName || undefined,
      cardPrice: parseFloat(generateForm.cardPrice) || 0,
      prefix: generateForm.prefix || undefined,
      simultaneousUse: parseInt(generateForm.simultaneousUse) || 1,
      usernameLength: parseInt(generateForm.usernameLength) || 6,
      passwordLength: parseInt(generateForm.passwordLength) || 4,
      subscriberGroup: generateForm.subscriberGroup || 'Default group',
      hotspotPort: generateForm.hotspotPort || undefined,
      internetTimeValue: parseInt(generateForm.internetTimeValue) || 0,
      internetTimeUnit: generateForm.internetTimeUnit,
      cardTimeValue: parseInt(generateForm.cardTimeValue) || 0,
      cardTimeUnit: generateForm.cardTimeUnit,
      timeFromActivation: generateForm.timeFromActivation,
      macBinding: generateForm.macBinding,
    });
  };

  const handleRedeemCard = () => {
    if (!redeemCode.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال رمز الكرت' : 'Please enter card code');
      return;
    }
    redeemMutation.mutate({ code: redeemCode.trim() });
  };

  const handlePrintBatch = () => {
    if (!selectedBatchId) {
      toast.error(language === 'ar' ? 'يرجى اختيار دفعة' : 'Please select a batch');
      return;
    }
    generatePDFMutation.mutate({
      batchId: selectedBatchId,
      companyName: printSettings.companyName,
      hotspotUrl: printSettings.hotspotUrl,
      cardsPerPage: parseInt(printSettings.cardsPerPage) || 8,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === 'ar' ? 'تم النسخ' : 'Copied');
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; labelAr: string }> = {
      unused: { variant: "secondary", label: "Unused", labelAr: "غير مستخدم" },
      active: { variant: "default", label: "Active", labelAr: "نشط" },
      used: { variant: "outline", label: "Used", labelAr: "مستخدم" },
      expired: { variant: "destructive", label: "Expired", labelAr: "منتهي" },
      suspended: { variant: "destructive", label: "Suspended", labelAr: "معلق" },
      cancelled: { variant: "destructive", label: "Cancelled", labelAr: "ملغي" },
    };
    const config = statusConfig[status] || statusConfig.unused;
    return (
      <Badge variant={config.variant}>
        {language === 'ar' ? config.labelAr : config.label}
      </Badge>
    );
  };

  const filteredVouchers = vouchers?.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.username?.toLowerCase().includes(query) ||
      v.serialNumber?.toLowerCase().includes(query) ||
      v.password?.toLowerCase().includes(query)
    );
  });

  const isAdmin = user?.role === 'super_admin';
  const isReseller = user?.role === 'reseller' || isAdmin;
  const isClient = user?.role === 'client';

  return (
    <div className="space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === 'ar' ? 'إدارة الكروت' : 'Card Management'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'إنشاء وإدارة كروت RADIUS للمشتركين'
              : 'Create and manage RADIUS cards for subscribers'
            }
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isClient && (
            <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CreditCard className="h-4 w-4 me-2" />
                  {language === 'ar' ? 'شحن كرت' : 'Redeem Card'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === 'ar' ? 'شحن كرت' : 'Redeem Card'}</DialogTitle>
                  <DialogDescription>
                    {language === 'ar' 
                      ? 'أدخل رقم الكرت أو الرقم التسلسلي لتفعيله'
                      : 'Enter the card number or serial to activate it'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>{language === 'ar' ? 'رمز الكرت' : 'Card Code'}</Label>
                    <Input
                      placeholder={language === 'ar' ? 'أدخل رقم الكرت...' : 'Enter card code...'}
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button onClick={handleRedeemCard} disabled={redeemMutation.isPending}>
                    {redeemMutation.isPending 
                      ? (language === 'ar' ? 'جاري التفعيل...' : 'Activating...')
                      : (language === 'ar' ? 'تفعيل' : 'Activate')
                    }
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          
          {isReseller && (
            <>
              <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Printer className="h-4 w-4 me-2" />
                    {language === 'ar' ? 'طباعة PDF' : 'Print PDF'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'طباعة الكروت' : 'Print Cards'}</DialogTitle>
                    <DialogDescription>
                      {language === 'ar' 
                        ? 'اختر الدفعة وإعدادات الطباعة'
                        : 'Select batch and print settings'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اختر الدفعة' : 'Select Batch'}</Label>
                      <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === 'ar' ? 'اختر دفعة...' : 'Select batch...'} />
                        </SelectTrigger>
                        <SelectContent>
                          {batches?.map((batch: any) => (
                            <SelectItem key={batch.batchId} value={batch.batchId}>
                              {batch.name} ({batch.quantity} {language === 'ar' ? 'كرت' : 'cards'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اسم الشركة' : 'Company Name'}</Label>
                      <Input
                        value={printSettings.companyName}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'رابط Hotspot' : 'Hotspot URL'}</Label>
                      <Input
                        placeholder="http://hotspot.local"
                        value={printSettings.hotspotUrl}
                        onChange={(e) => setPrintSettings(prev => ({ ...prev, hotspotUrl: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'عدد الكروت في الصفحة' : 'Cards per Page'}</Label>
                      <Select 
                        value={printSettings.cardsPerPage} 
                        onValueChange={(v) => setPrintSettings(prev => ({ ...prev, cardsPerPage: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="12">12</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                    <Button onClick={handlePrintBatch} disabled={generatePDFMutation.isPending}>
                      {generatePDFMutation.isPending 
                        ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...')
                        : (language === 'ar' ? 'إنشاء PDF' : 'Generate PDF')
                      }
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 me-2" />
                    {language === 'ar' ? 'إنشاء كروت' : 'Generate Cards'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'إنشاء كروت RADIUS جديدة' : 'Generate New RADIUS Cards'}</DialogTitle>
                    <DialogDescription>
                      {language === 'ar' 
                        ? 'كل كرت يمثل حساب RADIUS حقيقي جاهز للاستخدام على MikroTik'
                        : 'Each card represents a real RADIUS account ready for MikroTik'
                      }
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6 py-4">
                    {/* Row 1: Quantity, Price, Prefix */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'كمية' : 'Quantity'}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="1000"
                          value={generateForm.quantity}
                          onChange={(e) => setGenerateForm(prev => ({ ...prev, quantity: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'سعر الكرت' : 'Card Price'}</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={generateForm.cardPrice}
                          onChange={(e) => setGenerateForm(prev => ({ ...prev, cardPrice: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'حرف او رقم يبدأ الكرت به' : 'Card Prefix'}</Label>
                        <Input
                          maxLength={10}
                          placeholder=""
                          value={generateForm.prefix}
                          onChange={(e) => setGenerateForm(prev => ({ ...prev, prefix: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Row 2: Simultaneous Use, Username Length, Password Length */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'عدد الأجهزة التي يمكنها الاتصال' : 'Simultaneous Connections'}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={generateForm.simultaneousUse}
                          onChange={(e) => setGenerateForm(prev => ({ ...prev, simultaneousUse: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'طول رقم الكرت' : 'Username Length'}</Label>
                        <Select 
                          value={generateForm.usernameLength} 
                          onValueChange={(v) => setGenerateForm(prev => ({ ...prev, usernameLength: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'طول كلمة السر' : 'Password Length'}</Label>
                        <Select 
                          value={generateForm.passwordLength} 
                          onValueChange={(v) => setGenerateForm(prev => ({ ...prev, passwordLength: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[4, 5, 6, 7, 8, 9, 10, 12, 14, 16].map(n => (
                              <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 3: Plan and Subscriber Group */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الخدمة المرتبطة بالكرت' : 'Service Plan'}</Label>
                        <Select 
                          value={generateForm.planId} 
                          onValueChange={(v) => setGenerateForm(prev => ({ ...prev, planId: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة...' : 'Select plan...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {plans?.map((plan: any) => (
                              <SelectItem key={plan.id} value={String(plan.id)}>
                                {language === 'ar' && plan.nameAr ? plan.nameAr : plan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'مجموعة المشتركين' : 'Subscriber Group'}</Label>
                        <Select 
                          value={generateForm.subscriberGroup} 
                          onValueChange={(v) => setGenerateForm(prev => ({ ...prev, subscriberGroup: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(subscriberGroups || ['Default group']).map((group: string) => (
                              <SelectItem key={group} value={group}>{group}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Row 4: Hotspot Port */}
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'تحديد منفذ هوتسبوت' : 'Hotspot Port Restriction'}</Label>
                      <Input
                        placeholder={language === 'ar' ? 'فارغ = السماح للجميع' : 'Empty = Allow all'}
                        value={generateForm.hotspotPort}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, hotspotPort: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        {language === 'ar' 
                          ? 'مثال: hs-LAN 5, hs-LAN 1, hs-LAN 2'
                          : 'Example: hs-LAN 5, hs-LAN 1, hs-LAN 2'
                        }
                      </p>
                    </div>

                    {/* Row 5: Internet Time and Card Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الوقت المتاح على الانترنت' : 'Internet Time Limit'}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            className="flex-1"
                            value={generateForm.internetTimeValue}
                            onChange={(e) => setGenerateForm(prev => ({ ...prev, internetTimeValue: e.target.value }))}
                          />
                          <Select 
                            value={generateForm.internetTimeUnit} 
                            onValueChange={(v: "hours" | "days") => setGenerateForm(prev => ({ ...prev, internetTimeUnit: v }))}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hours">{language === 'ar' ? 'ساعة' : 'Hours'}</SelectItem>
                              <SelectItem value="days">{language === 'ar' ? 'يوم' : 'Days'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'ar' ? 'الوقت المتاح من تفعيل الكرت' : 'Card Validity Time'}</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min="0"
                            className="flex-1"
                            value={generateForm.cardTimeValue}
                            onChange={(e) => setGenerateForm(prev => ({ ...prev, cardTimeValue: e.target.value }))}
                          />
                          <Select 
                            value={generateForm.cardTimeUnit} 
                            onValueChange={(v: "hours" | "days") => setGenerateForm(prev => ({ ...prev, cardTimeUnit: v }))}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hours">{language === 'ar' ? 'ساعة' : 'Hours'}</SelectItem>
                              <SelectItem value="days">{language === 'ar' ? 'يوم' : 'Days'}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Row 6: Switches */}
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={generateForm.timeFromActivation}
                          onCheckedChange={(checked) => setGenerateForm(prev => ({ ...prev, timeFromActivation: checked }))}
                        />
                        <Label className="cursor-pointer">
                          {language === 'ar' ? 'تحسب من تفعيل الكرت' : 'Count from activation'}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={generateForm.macBinding}
                          onCheckedChange={(checked) => setGenerateForm(prev => ({ ...prev, macBinding: checked }))}
                        />
                        <Label className="cursor-pointer">
                          {language === 'ar' ? 'عدم ربط الماك' : 'No MAC binding'}
                        </Label>
                      </div>
                    </div>

                    {/* Row 7: Batch Name */}
                    <div className="space-y-2">
                      <Label>{language === 'ar' ? 'اسم الدفعة (اختياري)' : 'Batch Name (Optional)'}</Label>
                      <Input
                        placeholder={language === 'ar' ? 'مثال: دفعة يناير 2026' : 'e.g., January 2026 Batch'}
                        value={generateForm.batchName}
                        onChange={(e) => setGenerateForm(prev => ({ ...prev, batchName: e.target.value }))}
                      />
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => {
                      setIsGenerateDialogOpen(false);
                      resetGenerateForm();
                    }}>
                      {language === 'ar' ? 'إلغاء' : 'Discard'}
                    </Button>
                    <Button onClick={handleGenerateCards} disabled={generateMutation.isPending}>
                      {generateMutation.isPending 
                        ? (language === 'ar' ? 'جاري الإنشاء...' : 'Generating...')
                        : (language === 'ar' ? 'إنشاء' : 'Submit')
                      }
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'إجمالي الكروت' : 'Total Cards'}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vouchers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'غير مستخدمة' : 'Unused'}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vouchers?.filter(v => v.status === 'unused').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'نشطة' : 'Active'}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {vouchers?.filter(v => v.status === 'active').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === 'ar' ? 'الدفعات' : 'Batches'}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{batches?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cards">
            <CreditCard className="h-4 w-4 me-2" />
            {language === 'ar' ? 'الكروت' : 'Cards'}
          </TabsTrigger>
          <TabsTrigger value="batches">
            <Package className="h-4 w-4 me-2" />
            {language === 'ar' ? 'الدفعات' : 'Batches'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={language === 'ar' ? 'بحث بالرقم أو اسم المستخدم...' : 'Search by number or username...'}
                className="ps-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 me-2" />
                <SelectValue placeholder={language === 'ar' ? 'الحالة' : 'Status'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{language === 'ar' ? 'الكل' : 'All'}</SelectItem>
                <SelectItem value="unused">{language === 'ar' ? 'غير مستخدم' : 'Unused'}</SelectItem>
                <SelectItem value="active">{language === 'ar' ? 'نشط' : 'Active'}</SelectItem>
                <SelectItem value="used">{language === 'ar' ? 'مستخدم' : 'Used'}</SelectItem>
                <SelectItem value="expired">{language === 'ar' ? 'منتهي' : 'Expired'}</SelectItem>
                <SelectItem value="suspended">{language === 'ar' ? 'معلق' : 'Suspended'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Cards Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'رقم الكرت (Username)' : 'Card Number (Username)'}</TableHead>
                    <TableHead>{language === 'ar' ? 'كلمة السر' : 'Password'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الرقم التسلسلي' : 'Serial'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
                      </TableCell>
                    </TableRow>
                  ) : filteredVouchers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {language === 'ar' ? 'لا توجد كروت' : 'No cards found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVouchers?.map((voucher: any) => (
                      <TableRow key={voucher.id}>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            {voucher.username}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(voucher.username)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-2">
                            {voucher.password}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(voucher.password)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{voucher.serialNumber}</TableCell>
                        <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {voucher.createdAt ? new Date(voucher.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                        </TableCell>
                        <TableCell className="text-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyToClipboard(`${voucher.username}:${voucher.password}`)}>
                                <Copy className="h-4 w-4 me-2" />
                                {language === 'ar' ? 'نسخ البيانات' : 'Copy Credentials'}
                              </DropdownMenuItem>
                              {isAdmin && voucher.status === 'active' && (
                                <DropdownMenuItem onClick={() => suspendMutation.mutate({ cardId: voucher.id })}>
                                  <Ban className="h-4 w-4 me-2" />
                                  {language === 'ar' ? 'تعليق' : 'Suspend'}
                                </DropdownMenuItem>
                              )}
                              {isAdmin && voucher.status === 'suspended' && (
                                <DropdownMenuItem onClick={() => unsuspendMutation.mutate({ cardId: voucher.id })}>
                                  <RefreshCw className="h-4 w-4 me-2" />
                                  {language === 'ar' ? 'إعادة تفعيل' : 'Reactivate'}
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
        </TabsContent>

        <TabsContent value="batches" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === 'ar' ? 'اسم الدفعة' : 'Batch Name'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الكمية' : 'Quantity'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {language === 'ar' ? 'لا توجد دفعات' : 'No batches found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches?.map((batch: any) => (
                      <TableRow key={batch.batchId}>
                        <TableCell className="font-medium">{batch.name}</TableCell>
                        <TableCell>{batch.quantity}</TableCell>
                        <TableCell>
                          <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                            {batch.status === 'completed' 
                              ? (language === 'ar' ? 'مكتمل' : 'Completed')
                              : (language === 'ar' ? 'قيد الإنشاء' : 'Generating')
                            }
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {batch.createdAt ? new Date(batch.createdAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US') : '-'}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedBatchId(batch.batchId);
                                setIsPrintDialogOpen(true);
                              }}
                            >
                              <Printer className="h-4 w-4 me-1" />
                              PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
