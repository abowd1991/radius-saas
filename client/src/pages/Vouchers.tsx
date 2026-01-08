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
import { Progress } from "@/components/ui/progress";
import { useLocation } from "wouter";
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
  
  // Batch management dialogs
  const [isEditTimeDialogOpen, setIsEditTimeDialogOpen] = useState(false);
  const [isEditPropertiesDialogOpen, setIsEditPropertiesDialogOpen] = useState(false);
  const [isDeleteBatchDialogOpen, setIsDeleteBatchDialogOpen] = useState(false);
  const [deleteWithCards, setDeleteWithCards] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  
  // Edit time form
  const [editTimeForm, setEditTimeForm] = useState({
    cardTimeValue: "0",
    cardTimeUnit: "hours" as "hours" | "days",
    internetTimeValue: "0",
    internetTimeUnit: "hours" as "hours" | "days",
    timeFromActivation: true,
  });
  
  // Edit properties form
  const [editPropertiesForm, setEditPropertiesForm] = useState({
    simultaneousUse: "1",
    planId: "",
    hotspotPort: "",
    macBinding: false,
  });
  
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

  // Progress state for bulk generation
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Navigation
  const [, setLocation] = useLocation();

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
    onMutate: () => {
      setIsGenerating(true);
      setGenerationProgress(0);
      // Simulate progress for better UX
      const interval = setInterval(() => {
        setGenerationProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 200);
      return { interval };
    },
    onSuccess: (data, _, context) => {
      if (context?.interval) clearInterval(context.interval);
      setGenerationProgress(100);
      setTimeout(() => {
        setIsGenerating(false);
        setGenerationProgress(0);
        toast.success(language === 'ar' 
          ? `تم إنشاء ${data.quantity} كرت بنجاح` 
          : `Successfully generated ${data.quantity} cards`
        );
        setIsGenerateDialogOpen(false);
        refetch();
        refetchBatches();
        resetGenerateForm();
      }, 500);
    },
    onError: (error, _, context) => {
      if (context?.interval) clearInterval(context.interval);
      setIsGenerating(false);
      setGenerationProgress(0);
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

  // Batch management mutations
  const enableBatchMutation = trpc.vouchers.enableBatch.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' 
        ? `تم تمكين الدفعة (${data.affectedCards} كرت)` 
        : `Batch enabled (${data.affectedCards} cards)`);
      refetchBatches();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const disableBatchMutation = trpc.vouchers.disableBatch.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' 
        ? `تم تعطيل الدفعة (${data.affectedCards} كرت)` 
        : `Batch disabled (${data.affectedCards} cards)`);
      refetchBatches();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateBatchTimeMutation = trpc.vouchers.updateBatchTime.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' 
        ? `تم تحديث الوقت (${data.affectedCards} كرت)` 
        : `Time updated (${data.affectedCards} cards)`);
      setIsEditTimeDialogOpen(false);
      refetchBatches();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateBatchPropertiesMutation = trpc.vouchers.updateBatchProperties.useMutation({
    onSuccess: (data) => {
      toast.success(language === 'ar' 
        ? `تم تحديث الخصائص (${data.affectedCards} كرت)` 
        : `Properties updated (${data.affectedCards} cards)`);
      setIsEditPropertiesDialogOpen(false);
      refetchBatches();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteBatchMutation = trpc.vouchers.deleteBatch.useMutation({
    onSuccess: (data) => {
      if (data.deletedCards > 0) {
        toast.success(language === 'ar' 
          ? `تم حذف الدفعة و ${data.deletedCards} كرت` 
          : `Batch and ${data.deletedCards} cards deleted`);
      } else {
        toast.success(language === 'ar' 
          ? `تم حذف الدفعة (الكروت موجودة)` 
          : `Batch deleted (cards preserved)`);
      }
      setIsDeleteBatchDialogOpen(false);
      setDeleteWithCards(false);
      refetchBatches();
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Batch action handlers
  const handleEnableBatch = (batchId: string) => {
    enableBatchMutation.mutate({ batchId });
  };

  const handleDisableBatch = (batchId: string) => {
    disableBatchMutation.mutate({ batchId });
  };

  const openEditTimeDialog = (batch: any) => {
    setSelectedBatch(batch);
    setEditTimeForm({
      cardTimeValue: String(batch.cardTimeValue || 0),
      cardTimeUnit: batch.cardTimeUnit || 'hours',
      internetTimeValue: String(batch.internetTimeValue || 0),
      internetTimeUnit: batch.internetTimeUnit || 'hours',
      timeFromActivation: batch.timeFromActivation !== false,
    });
    setIsEditTimeDialogOpen(true);
  };

  const openEditPropertiesDialog = (batch: any) => {
    setSelectedBatch(batch);
    setEditPropertiesForm({
      simultaneousUse: String(batch.simultaneousUse || 1),
      planId: String(batch.planId || ''),
      hotspotPort: batch.hotspotPort || '',
      macBinding: batch.macBinding || false,
    });
    setIsEditPropertiesDialogOpen(true);
  };

  const openDeleteBatchDialog = (batch: any) => {
    setSelectedBatch(batch);
    setDeleteWithCards(false);
    setIsDeleteBatchDialogOpen(true);
  };

  const handleDeleteBatch = () => {
    if (!selectedBatch) return;
    deleteBatchMutation.mutate({
      batchId: selectedBatch.batchId,
      deleteCards: deleteWithCards,
    });
  };

  const handleUpdateBatchTime = () => {
    if (!selectedBatch) return;
    updateBatchTimeMutation.mutate({
      batchId: selectedBatch.batchId,
      cardTimeValue: parseInt(editTimeForm.cardTimeValue) || 0,
      cardTimeUnit: editTimeForm.cardTimeUnit,
      internetTimeValue: parseInt(editTimeForm.internetTimeValue) || 0,
      internetTimeUnit: editTimeForm.internetTimeUnit,
      timeFromActivation: editTimeForm.timeFromActivation,
    });
  };

  const handleUpdateBatchProperties = () => {
    if (!selectedBatch) return;
    updateBatchPropertiesMutation.mutate({
      batchId: selectedBatch.batchId,
      simultaneousUse: parseInt(editPropertiesForm.simultaneousUse) || 1,
      planId: editPropertiesForm.planId ? parseInt(editPropertiesForm.planId) : undefined,
      hotspotPort: editPropertiesForm.hotspotPort || undefined,
      macBinding: editPropertiesForm.macBinding,
    });
  };

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
  // Allow client, reseller, and admin to create cards
  const canCreateCards = user?.role === 'client' || user?.role === 'reseller' || isAdmin;
  const isReseller = canCreateCards; // Keep for backward compatibility
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
              <Button variant="outline" onClick={() => setLocation('/print-cards')}>
                <Printer className="h-4 w-4 me-2" />
                {language === 'ar' ? 'طباعة PDF' : 'Print PDF'}
              </Button>

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

                  {/* Progress Bar for Generation */}
                  {isGenerating && (
                    <div className="space-y-2 py-4">
                      <div className="flex justify-between text-sm">
                        <span>{language === 'ar' ? 'جاري إنشاء البطاقات...' : 'Generating cards...'}</span>
                        <span>{Math.round(generationProgress)}%</span>
                      </div>
                      <Progress value={generationProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground text-center">
                        {language === 'ar' 
                          ? `إنشاء ${generateForm.quantity} بطاقة - الرجاء الانتظار`
                          : `Creating ${generateForm.quantity} cards - Please wait`
                        }
                      </p>
                    </div>
                  )}

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => {
                      setIsGenerateDialogOpen(false);
                      resetGenerateForm();
                    }} disabled={isGenerating}>
                      {language === 'ar' ? 'إلغاء' : 'Discard'}
                    </Button>
                    <Button onClick={handleGenerateCards} disabled={generateMutation.isPending || isGenerating}>
                      {isGenerating 
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
                    <TableHead>{language === 'ar' ? 'الخدمة' : 'Plan'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'إجمالي' : 'Total'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'غير مستخدم' : 'Unused'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'نشط' : 'Active'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'مستخدم' : 'Used'}</TableHead>
                    <TableHead className="text-center">{language === 'ar' ? 'معلق' : 'Suspended'}</TableHead>
                    <TableHead>{language === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                    <TableHead>{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead className="text-end">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        {language === 'ar' ? 'لا توجد دفعات' : 'No batches found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches?.map((batch: any) => (
                      <TableRow key={batch.batchId} className={!batch.enabled ? 'opacity-60 bg-muted/30' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {batch.name}
                            {!batch.enabled && (
                              <Badge variant="destructive" className="text-xs">
                                {language === 'ar' ? 'معطل' : 'Disabled'}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{batch.planName || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {batch.stats?.total || batch.quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {batch.stats?.unused || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {batch.stats?.active || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-gray-600 dark:text-gray-400">
                            {batch.stats?.used || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-orange-600 dark:text-orange-400">
                            {batch.stats?.suspended || 0}
                          </span>
                        </TableCell>
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
                                setLocation(`/print-cards?batch=${batch.batchId}`);
                              }}
                            >
                              <Printer className="h-4 w-4 me-1" />
                              PDF
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {batch.enabled ? (
                                  <DropdownMenuItem
                                    onClick={() => handleDisableBatch(batch.batchId)}
                                    className="text-destructive"
                                  >
                                    <XCircle className="h-4 w-4 me-2" />
                                    {language === 'ar' ? 'تعطيل الدفعة' : 'Disable Batch'}
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleEnableBatch(batch.batchId)}
                                    className="text-green-600"
                                  >
                                    <CheckCircle2 className="h-4 w-4 me-2" />
                                    {language === 'ar' ? 'تمكين الدفعة' : 'Enable Batch'}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openEditTimeDialog(batch)}
                                >
                                  <Clock className="h-4 w-4 me-2" />
                                  {language === 'ar' ? 'تعديل الوقت' : 'Edit Time'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openEditPropertiesDialog(batch)}
                                >
                                  <RefreshCw className="h-4 w-4 me-2" />
                                  {language === 'ar' ? 'تعديل الخصائص' : 'Edit Properties'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => openDeleteBatchDialog(batch)}
                                  className="text-destructive"
                                >
                                  <Ban className="h-4 w-4 me-2" />
                                  {language === 'ar' ? 'حذف الدفعة' : 'Delete Batch'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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

      {/* Edit Time Dialog */}
      <Dialog open={isEditTimeDialogOpen} onOpenChange={setIsEditTimeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل الوقت للدفعة' : 'Edit Batch Time'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `تعديل إعدادات الوقت لجميع الكروت في الدفعة: ${selectedBatch?.name}` 
                : `Edit time settings for all cards in batch: ${selectedBatch?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{language === 'ar' ? 'الوقت المتاح من تفعيل الكرت' : 'Card Activation Time'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={editTimeForm.cardTimeValue}
                    onChange={(e) => setEditTimeForm(prev => ({ ...prev, cardTimeValue: e.target.value }))}
                    min="0"
                  />
                  <Select
                    value={editTimeForm.cardTimeUnit}
                    onValueChange={(v) => setEditTimeForm(prev => ({ ...prev, cardTimeUnit: v as 'hours' | 'days' }))}
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
                <Label>{language === 'ar' ? 'الوقت على الانترنت' : 'Internet Time'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={editTimeForm.internetTimeValue}
                    onChange={(e) => setEditTimeForm(prev => ({ ...prev, internetTimeValue: e.target.value }))}
                    min="0"
                  />
                  <Select
                    value={editTimeForm.internetTimeUnit}
                    onValueChange={(v) => setEditTimeForm(prev => ({ ...prev, internetTimeUnit: v as 'hours' | 'days' }))}
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
            <div className="flex items-center justify-between">
              <Label>{language === 'ar' ? 'تحسب من تفعيل الكرت' : 'Count from activation'}</Label>
              <Switch
                checked={editTimeForm.timeFromActivation}
                onCheckedChange={(checked) => setEditTimeForm(prev => ({ ...prev, timeFromActivation: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditTimeDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleUpdateBatchTime}
              disabled={updateBatchTimeMutation.isPending}
            >
              {updateBatchTimeMutation.isPending 
                ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...')
                : (language === 'ar' ? 'تحديث' : 'Update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Properties Dialog */}
      <Dialog open={isEditPropertiesDialogOpen} onOpenChange={setIsEditPropertiesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {language === 'ar' ? 'تعديل خصائص الدفعة' : 'Edit Batch Properties'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `تعديل خصائص جميع الكروت في الدفعة: ${selectedBatch?.name}` 
                : `Edit properties for all cards in batch: ${selectedBatch?.name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'عدد الأجهزة المسموح لها بالاتصال' : 'Simultaneous Use'}</Label>
              <Input
                type="number"
                value={editPropertiesForm.simultaneousUse}
                onChange={(e) => setEditPropertiesForm(prev => ({ ...prev, simultaneousUse: e.target.value }))}
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'الخدمة المرتبطة' : 'Linked Plan'}</Label>
              <Select
                value={editPropertiesForm.planId}
                onValueChange={(v) => setEditPropertiesForm(prev => ({ ...prev, planId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={language === 'ar' ? 'اختر الخدمة' : 'Select plan'} />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((plan: any) => (
                    <SelectItem key={plan.id} value={String(plan.id)}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{language === 'ar' ? 'تحديد منفذ هوتسبوت' : 'Hotspot Port'}</Label>
              <Input
                value={editPropertiesForm.hotspotPort}
                onChange={(e) => setEditPropertiesForm(prev => ({ ...prev, hotspotPort: e.target.value }))}
                placeholder={language === 'ar' ? 'فارغ = السماح للجميع' : 'Empty = Allow all'}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>{language === 'ar' ? 'ربط الماك' : 'MAC Binding'}</Label>
              <Switch
                checked={editPropertiesForm.macBinding}
                onCheckedChange={(checked) => setEditPropertiesForm(prev => ({ ...prev, macBinding: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditPropertiesDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleUpdateBatchProperties}
              disabled={updateBatchPropertiesMutation.isPending}
            >
              {updateBatchPropertiesMutation.isPending 
                ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...')
                : (language === 'ar' ? 'تحديث' : 'Update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Dialog */}
      <Dialog open={isDeleteBatchDialogOpen} onOpenChange={setIsDeleteBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {language === 'ar' ? 'حذف الدفعة' : 'Delete Batch'}
            </DialogTitle>
            <DialogDescription>
              {language === 'ar' 
                ? `هل أنت متأكد من حذف الدفعة: ${selectedBatch?.name}؟` 
                : `Are you sure you want to delete batch: ${selectedBatch?.name}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-sm text-destructive">
                {language === 'ar' 
                  ? `هذه الدفعة تحتوي على ${selectedBatch?.stats?.total || selectedBatch?.quantity || 0} كرت` 
                  : `This batch contains ${selectedBatch?.stats?.total || selectedBatch?.quantity || 0} cards`}
              </p>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="text-base">
                  {language === 'ar' ? 'حذف الكروت أيضاً' : 'Delete cards too'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' 
                    ? 'إذا لم يتم تفعيله، سيتم فقط حذف الدفعة مع بقاء الكروت' 
                    : 'If disabled, only batch will be deleted, cards will remain'}
                </p>
              </div>
              <Switch
                checked={deleteWithCards}
                onCheckedChange={setDeleteWithCards}
              />
            </div>
            {deleteWithCards && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                  {language === 'ar' 
                    ? '⚠️ تحذير: سيتم حذف جميع الكروت وبياناتها من RADIUS بشكل نهائي!' 
                    : '⚠️ Warning: All cards and their RADIUS data will be permanently deleted!'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteBatchDialogOpen(false)}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteBatch}
              disabled={deleteBatchMutation.isPending}
            >
              {deleteBatchMutation.isPending 
                ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...')
                : (language === 'ar' ? 'حذف' : 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
