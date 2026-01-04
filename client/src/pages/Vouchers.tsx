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
  
  // Form state for generating cards
  const [generateForm, setGenerateForm] = useState({
    planId: "",
    quantity: "10",
    batchName: "",
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

  // Mutations
  const generateVouchers = trpc.vouchers.generate.useMutation({
    onSuccess: (data) => {
      toast.success(
        language === "ar" 
          ? `تم إنشاء ${data.quantity} بطاقة بنجاح` 
          : `Successfully generated ${data.quantity} cards`
      );
      setIsGenerateDialogOpen(false);
      setGenerateForm({ planId: "", quantity: "10", batchName: "" });
      refetch();
      refetchBatches();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const redeemVoucher = trpc.vouchers.redeem.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تفعيل البطاقة بنجاح" : "Card activated successfully");
      setIsRedeemDialogOpen(false);
      setRedeemCode("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const generatePDF = trpc.vouchers.generateBatchPDF.useMutation({
    onSuccess: (data) => {
      toast.success(language === "ar" ? "تم إنشاء ملف الطباعة بنجاح" : "Print file generated successfully");
      // Open the HTML in a new tab for printing
      if (data.htmlUrl) {
        window.open(data.htmlUrl, '_blank');
      }
      setIsPrintDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const suspendCard = trpc.vouchers.suspend.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إيقاف البطاقة" : "Card suspended");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const unsuspendCard = trpc.vouchers.unsuspend.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تفعيل البطاقة" : "Card reactivated");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(language === "ar" ? "تم النسخ" : "Copied");
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; labelAr: string }> = {
      unused: { variant: "secondary", label: "Unused", labelAr: "غير مستخدم" },
      active: { variant: "default", label: "Active", labelAr: "نشط" },
      used: { variant: "outline", label: "Used", labelAr: "مستخدم" },
      expired: { variant: "destructive", label: "Expired", labelAr: "منتهي" },
      suspended: { variant: "destructive", label: "Suspended", labelAr: "موقوف" },
      cancelled: { variant: "destructive", label: "Cancelled", labelAr: "ملغي" },
    };
    const config = statusConfig[status] || statusConfig.unused;
    return (
      <Badge variant={config.variant}>
        {language === "ar" ? config.labelAr : config.label}
      </Badge>
    );
  };

  const handleGenerateCards = () => {
    if (!generateForm.planId || !generateForm.quantity) {
      toast.error(language === "ar" ? "يرجى ملء جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    generateVouchers.mutate({
      planId: parseInt(generateForm.planId),
      quantity: parseInt(generateForm.quantity),
      batchName: generateForm.batchName || undefined,
    });
  };

  const handlePrintBatch = () => {
    if (!selectedBatchId) {
      toast.error(language === "ar" ? "يرجى اختيار دفعة" : "Please select a batch");
      return;
    }
    generatePDF.mutate({
      batchId: selectedBatchId,
      companyName: printSettings.companyName,
      hotspotUrl: printSettings.hotspotUrl || undefined,
      cardsPerPage: parseInt(printSettings.cardsPerPage),
    });
  };

  const filteredVouchers = vouchers?.filter(v => {
    if (!searchQuery) return true;
    return v.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
           v.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const isAdmin = user?.role === 'super_admin';
  const isReseller = user?.role === 'reseller' || isAdmin;

  return (
    <div className="space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "بطاقات RADIUS" : "RADIUS Cards"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "إدارة بطاقات الإنترنت وتوليد دفعات جديدة"
              : "Manage internet cards and generate new batches"}
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'client' && (
            <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CreditCard className="h-4 w-4 me-2" />
                  {language === "ar" ? "تفعيل بطاقة" : "Activate Card"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{language === "ar" ? "تفعيل بطاقة" : "Activate Card"}</DialogTitle>
                  <DialogDescription>
                    {language === "ar" 
                      ? "أدخل الرقم التسلسلي للبطاقة لتفعيلها"
                      : "Enter the card serial number to activate it"}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "الرقم التسلسلي" : "Serial Number"}</Label>
                    <Input
                      placeholder="XXXX-XXXX-XXXX"
                      value={redeemCode}
                      onChange={(e) => setRedeemCode(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>
                    {language === "ar" ? "إلغاء" : "Cancel"}
                  </Button>
                  <Button 
                    onClick={() => redeemVoucher.mutate({ code: redeemCode })}
                    disabled={redeemVoucher.isPending}
                  >
                    {language === "ar" ? "تفعيل" : "Activate"}
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
                    {language === "ar" ? "طباعة PDF" : "Print PDF"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === "ar" ? "طباعة البطاقات" : "Print Cards"}</DialogTitle>
                    <DialogDescription>
                      {language === "ar" 
                        ? "اختر الدفعة وإعدادات الطباعة"
                        : "Select batch and print settings"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "الدفعة" : "Batch"}</Label>
                      <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر دفعة" : "Select batch"} />
                        </SelectTrigger>
                        <SelectContent>
                          {batches?.map((batch) => (
                            <SelectItem key={batch.batchId} value={batch.batchId}>
                              {batch.name} ({batch.quantity} {language === "ar" ? "بطاقة" : "cards"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "اسم الشركة" : "Company Name"}</Label>
                      <Input
                        value={printSettings.companyName}
                        onChange={(e) => setPrintSettings(s => ({ ...s, companyName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "رابط Hotspot (اختياري)" : "Hotspot URL (optional)"}</Label>
                      <Input
                        placeholder="http://hotspot.example.com/login"
                        value={printSettings.hotspotUrl}
                        onChange={(e) => setPrintSettings(s => ({ ...s, hotspotUrl: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "عدد البطاقات في الصفحة" : "Cards per Page"}</Label>
                      <Select 
                        value={printSettings.cardsPerPage} 
                        onValueChange={(v) => setPrintSettings(s => ({ ...s, cardsPerPage: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="6">6</SelectItem>
                          <SelectItem value="8">8</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsPrintDialogOpen(false)}>
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button onClick={handlePrintBatch} disabled={generatePDF.isPending}>
                      <Printer className="h-4 w-4 me-2" />
                      {language === "ar" ? "إنشاء PDF" : "Generate PDF"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 me-2" />
                    {language === "ar" ? "إنشاء بطاقات" : "Generate Cards"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === "ar" ? "إنشاء بطاقات جديدة" : "Generate New Cards"}</DialogTitle>
                    <DialogDescription>
                      {language === "ar" 
                        ? "سيتم إنشاء حسابات RADIUS حقيقية لكل بطاقة"
                        : "Real RADIUS accounts will be created for each card"}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "الخطة" : "Plan"} *</Label>
                      <Select 
                        value={generateForm.planId} 
                        onValueChange={(v) => setGenerateForm(f => ({ ...f, planId: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر خطة" : "Select plan"} />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id.toString()}>
                              {language === "ar" ? plan.nameAr || plan.name : plan.name} - {plan.price} $
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "العدد" : "Quantity"} *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="1000"
                        value={generateForm.quantity}
                        onChange={(e) => setGenerateForm(f => ({ ...f, quantity: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "اسم الدفعة (اختياري)" : "Batch Name (optional)"}</Label>
                      <Input
                        placeholder={language === "ar" ? "مثال: دفعة يناير 2024" : "e.g., January 2024 Batch"}
                        value={generateForm.batchName}
                        onChange={(e) => setGenerateForm(f => ({ ...f, batchName: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                      {language === "ar" ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button onClick={handleGenerateCards} disabled={generateVouchers.isPending}>
                      {language === "ar" ? "إنشاء" : "Generate"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cards">
            <CreditCard className="h-4 w-4 me-2" />
            {language === "ar" ? "البطاقات" : "Cards"}
          </TabsTrigger>
          {isReseller && (
            <TabsTrigger value="batches">
              <Package className="h-4 w-4 me-2" />
              {language === "ar" ? "الدفعات" : "Batches"}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={language === "ar" ? "بحث بالرقم التسلسلي أو اسم المستخدم..." : "Search by serial or username..."}
                    className="ps-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 me-2" />
                    <SelectValue placeholder={language === "ar" ? "الحالة" : "Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                    <SelectItem value="unused">{language === "ar" ? "غير مستخدم" : "Unused"}</SelectItem>
                    <SelectItem value="active">{language === "ar" ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="used">{language === "ar" ? "مستخدم" : "Used"}</SelectItem>
                    <SelectItem value="expired">{language === "ar" ? "منتهي" : "Expired"}</SelectItem>
                    <SelectItem value="suspended">{language === "ar" ? "موقوف" : "Suspended"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cards Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "الرقم التسلسلي" : "Serial Number"}</TableHead>
                    <TableHead>{language === "ar" ? "اسم المستخدم" : "Username"}</TableHead>
                    <TableHead>{language === "ar" ? "كلمة المرور" : "Password"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ الإنشاء" : "Created"}</TableHead>
                    <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "Expires"}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredVouchers?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {language === "ar" ? "لا توجد بطاقات" : "No cards found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVouchers?.map((card) => (
                      <TableRow key={card.id}>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {card.serialNumber}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(card.serialNumber)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{card.username}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {card.password}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(card.password)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(card.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(card.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {card.expiresAt 
                            ? new Date(card.expiresAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => copyToClipboard(`${card.username}:${card.password}`)}>
                                  <Copy className="h-4 w-4 me-2" />
                                  {language === "ar" ? "نسخ البيانات" : "Copy Credentials"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {card.status === 'active' && (
                                  <DropdownMenuItem 
                                    onClick={() => suspendCard.mutate({ cardId: card.id })}
                                    className="text-destructive"
                                  >
                                    <Ban className="h-4 w-4 me-2" />
                                    {language === "ar" ? "إيقاف" : "Suspend"}
                                  </DropdownMenuItem>
                                )}
                                {card.status === 'suspended' && (
                                  <DropdownMenuItem onClick={() => unsuspendCard.mutate({ cardId: card.id })}>
                                    <CheckCircle2 className="h-4 w-4 me-2" />
                                    {language === "ar" ? "تفعيل" : "Reactivate"}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batches Tab */}
        {isReseller && (
          <TabsContent value="batches" className="space-y-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "معرف الدفعة" : "Batch ID"}</TableHead>
                      <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                      <TableHead>{language === "ar" ? "العدد" : "Quantity"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{language === "ar" ? "تاريخ الإنشاء" : "Created"}</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {language === "ar" ? "لا توجد دفعات" : "No batches found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      batches?.map((batch) => (
                        <TableRow key={batch.batchId}>
                          <TableCell className="font-mono text-sm">{batch.batchId}</TableCell>
                          <TableCell>{batch.name}</TableCell>
                          <TableCell>{batch.quantity}</TableCell>
                          <TableCell>
                            <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                              {batch.status === 'completed' 
                                ? (language === "ar" ? "مكتمل" : "Completed")
                                : (language === "ar" ? "قيد الإنشاء" : "Generating")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(batch.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedBatchId(batch.batchId);
                                  setIsPrintDialogOpen(true);
                                }}
                              >
                                <Printer className="h-4 w-4" />
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
        )}
      </Tabs>
    </div>
  );
}
