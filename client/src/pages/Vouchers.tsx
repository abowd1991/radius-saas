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
} from "lucide-react";
import { useState } from "react";

export default function Vouchers() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [redeemCode, setRedeemCode] = useState("");

  // Fetch vouchers
  const { data: vouchers, isLoading, refetch } = trpc.vouchers.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as "unused" | "used" | "expired" | "cancelled" : undefined,
  });

  // Fetch plans for selection
  const { data: plans } = trpc.plans.list.useQuery();

  // Mutations
  const generateVouchers = trpc.vouchers.generate.useMutation({
    onSuccess: (data) => {
      toast.success(
        language === "ar" 
          ? `تم إنشاء ${data.quantity} كرت بنجاح` 
          : `Successfully generated ${data.quantity} vouchers`
      );
      setIsGenerateDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const redeemVoucher = trpc.vouchers.redeem.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم استخدام الكرت بنجاح" : "Voucher redeemed successfully");
      setIsRedeemDialogOpen(false);
      setRedeemCode("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(language === "ar" ? "تم نسخ الكود" : "Code copied");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "unused":
        return <Badge variant="default" className="bg-green-500">{t("vouchers.unused")}</Badge>;
      case "used":
        return <Badge variant="secondary">{t("vouchers.used")}</Badge>;
      case "expired":
        return <Badge variant="destructive">{t("vouchers.expired")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    generateVouchers.mutate({
      planId: parseInt(formData.get("planId") as string),
      quantity: parseInt(formData.get("quantity") as string),
      batchName: formData.get("prefix") as string || undefined,
      expiresInDays: parseInt(formData.get("expiryDays") as string) || undefined,
    });
  };

  const handleRedeem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    redeemVoucher.mutate({ code: redeemCode });
  };

  const isClient = user?.role === "client";
  const canGenerate = user?.role === "super_admin" || user?.role === "reseller";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("vouchers.title")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة كروت الشحن والاشتراكات" : "Manage vouchers and subscription cards"}
          </p>
        </div>
        <div className="flex gap-2">
          {isClient && (
            <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <CreditCard className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  {t("vouchers.redeem")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("vouchers.redeem")}</DialogTitle>
                  <DialogDescription>
                    {language === "ar" ? "أدخل كود الكرت لتفعيل الاشتراك" : "Enter the voucher code to activate subscription"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRedeem}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="redeemCode">{t("vouchers.code")}</Label>
                      <Input
                        id="redeemCode"
                        value={redeemCode}
                        onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                        placeholder={t("vouchers.enter_code")}
                        className="text-center text-lg tracking-widest"
                        maxLength={16}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsRedeemDialogOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={redeemVoucher.isPending || !redeemCode}>
                      {redeemVoucher.isPending ? (language === "ar" ? "جاري التفعيل..." : "Redeeming...") : t("vouchers.redeem")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          
          {canGenerate && (
            <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                  {t("vouchers.generate")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("vouchers.generate")}</DialogTitle>
                  <DialogDescription>
                    {language === "ar" ? "إنشاء كروت شحن جديدة" : "Generate new voucher cards"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleGenerate}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="planId">{t("vouchers.plan")}</Label>
                      <Select name="planId" required>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختر الخطة" : "Select plan"} />
                        </SelectTrigger>
                        <SelectContent>
                          {plans?.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id.toString()}>
                              {language === "ar" && plan.nameAr ? plan.nameAr : plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="quantity">{t("common.quantity")}</Label>
                      <Input
                        id="quantity"
                        name="quantity"
                        type="number"
                        min="1"
                        max="100"
                        defaultValue="10"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="prefix">{language === "ar" ? "بادئة الكود" : "Code Prefix"}</Label>
                      <Input
                        id="prefix"
                        name="prefix"
                        placeholder="e.g., VIP"
                        maxLength={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="expiryDays">{language === "ar" ? "صلاحية الكرت (أيام)" : "Voucher Validity (days)"}</Label>
                      <Input
                        id="expiryDays"
                        name="expiryDays"
                        type="number"
                        min="1"
                        defaultValue="365"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={generateVouchers.isPending}>
                      {generateVouchers.isPending ? (language === "ar" ? "جاري الإنشاء..." : "Generating...") : t("vouchers.generate")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${direction === "rtl" ? "right-3" : "left-3"}`} />
              <Input
                placeholder={language === "ar" ? "بحث بالكود..." : "Search by code..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={direction === "rtl" ? "pr-9" : "pl-9"}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="unused">{t("vouchers.unused")}</SelectItem>
                <SelectItem value="used">{t("vouchers.used")}</SelectItem>
                <SelectItem value="expired">{t("vouchers.expired")}</SelectItem>
              </SelectContent>
            </Select>
            {canGenerate && (
              <Button variant="outline">
                <Download className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                {t("vouchers.download_pdf")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vouchers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("vouchers.code")}</TableHead>
                <TableHead>{t("vouchers.plan")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.created_at")}</TableHead>
                {canGenerate && <TableHead>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</TableHead>}
                {canGenerate && <TableHead>{language === "ar" ? "مستخدم بواسطة" : "Used By"}</TableHead>}
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
              ) : vouchers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد كروت" : "No vouchers found"}
                  </TableCell>
                </TableRow>
              ) : (
                vouchers?.map((voucher) => (
                  <TableRow key={voucher.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                          {voucher.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(voucher.code)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {voucher.planId ? `Plan #${voucher.planId}` : "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(voucher.status)}</TableCell>
                    <TableCell>{formatDate(voucher.createdAt)}</TableCell>
                    {canGenerate && <TableCell>{formatDate(voucher.expiresAt)}</TableCell>}
                    {canGenerate && (
                      <TableCell>
                        {voucher.usedAt ? formatDate(voucher.usedAt) : "-"}
                      </TableCell>
                    )}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align={direction === "rtl" ? "start" : "end"}>
                          <DropdownMenuItem onClick={() => copyToClipboard(voucher.code)}>
                            <Copy className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                            {language === "ar" ? "نسخ الكود" : "Copy Code"}
                          </DropdownMenuItem>
                          {voucher.status === "unused" && isClient && (
                            <DropdownMenuItem onClick={() => {
                              setRedeemCode(voucher.code);
                              setIsRedeemDialogOpen(true);
                            }}>
                              <CreditCard className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                              {t("vouchers.redeem")}
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
    </div>
  );
}
