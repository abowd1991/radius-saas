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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Wallet as WalletIcon,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Building,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function Wallet() {
  const { user } = useAuth();
  const { t, language, direction } = useLanguage();
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string>("");
  const [transferCurrency, setTransferCurrency] = useState<"USD" | "ILS">("USD");

  // Fetch wallet data
  const { data: wallet, isLoading: walletLoading, refetch: refetchWallet } = trpc.wallet.getMyWallet.useQuery();
  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = trpc.wallet.getTransactions.useQuery({
    limit: 20,
  });

  // Mutations
  const deposit = trpc.wallet.deposit.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إضافة الرصيد بنجاح" : "Deposit successful");
      setIsDepositDialogOpen(false);
      setDepositAmount("");
      refetchWallet();
      refetchTransactions();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  
  const submitBankTransfer = trpc.bankTransfer.submitRequest.useMutation();

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat(language === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      case "withdrawal":
      case "purchase":
      case "voucher_purchase":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "refund":
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <WalletIcon className="h-4 w-4" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      deposit: { ar: "إيداع", en: "Deposit" },
      withdrawal: { ar: "سحب", en: "Withdrawal" },
      purchase: { ar: "شراء", en: "Purchase" },
      voucher_purchase: { ar: "شراء كروت", en: "Voucher Purchase" },
      subscription_payment: { ar: "دفع اشتراك", en: "Subscription Payment" },
      refund: { ar: "استرداد", en: "Refund" },
      transfer_in: { ar: "تحويل وارد", en: "Transfer In" },
      transfer_out: { ar: "تحويل صادر", en: "Transfer Out" },
      admin_adjustment: { ar: "تعديل إداري", en: "Admin Adjustment" },
    };
    return labels[type]?.[language] || type;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) {
        toast.error(language === "ar" ? "حجم الصورة يجب أن يكون أقل من 16MB" : "Image size must be less than 16MB");
        return;
      }
      setReceiptImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeposit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!depositAmount || !paymentMethod) return;

    // If Bank Transfer, redirect to submission page with image upload
    if (paymentMethod === "bank_palestine") {
      if (!receiptImage) {
        toast.error(language === "ar" ? "يرجى رفع صورة الإشعار" : "Please upload receipt image");
        return;
      }
      
      // Convert image to base64 and submit via tRPC
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          await submitBankTransfer.mutateAsync({
            requestedAmount: parseFloat(depositAmount),
            requestedCurrency: transferCurrency,
            receiptImage: {
              data: base64Data,
              filename: receiptImage.name,
              mimeType: receiptImage.type,
            },
          });
          toast.success(language === "ar" ? "تم إرسال الطلب بنجاح" : "Request submitted successfully");
          setIsDepositDialogOpen(false);
          setDepositAmount("");
          setPaymentMethod("");
          setReceiptImage(null);
          setReceiptPreview("");
          refetchWallet();
        } catch (error: any) {
          toast.error(error.message || (language === "ar" ? "فشل إرسال الطلب" : "Failed to submit request"));
        }
      };
      reader.readAsDataURL(receiptImage);
      return;
    }

    // For other payment methods (PayPal, Stripe)
    toast.info(language === "ar" ? "سيتم توجيهك لبوابة الدفع" : "Redirecting to payment gateway...");
    setIsDepositDialogOpen(false);
  };

  const quickAmounts = [10, 25, 50, 100, 250, 500];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("wallet.title")}</h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة رصيدك ومعاملاتك المالية" : "Manage your balance and transactions"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchWallet(); refetchTransactions(); }}>
            <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
            {language === "ar" ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("wallet.balance")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-4xl font-bold">
                  {walletLoading ? "..." : formatCurrency(wallet?.balance || "0")}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === "ar" ? "الرصيد المتاح" : "Available balance"}
                </p>
              </div>
              <Dialog open={isDepositDialogOpen} onOpenChange={setIsDepositDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg">
                    <Plus className={`h-5 w-5 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
                    {t("wallet.add_funds")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("wallet.add_funds")}</DialogTitle>
                    <DialogDescription>
                      {language === "ar" ? "اختر المبلغ وطريقة الدفع" : "Choose amount and payment method"}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleDeposit}>
                    <div className="space-y-4 py-4">
                      {/* Quick Amounts */}
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "مبالغ سريعة" : "Quick Amounts"}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {quickAmounts.map((amount) => (
                            <Button
                              key={amount}
                              type="button"
                              variant={depositAmount === amount.toString() ? "default" : "outline"}
                              onClick={() => setDepositAmount(amount.toString())}
                            >
                              ${amount}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Custom Amount */}
                      <div className="space-y-2">
                        <Label htmlFor="amount">{t("common.amount")} ($)</Label>
                        <Input
                          id="amount"
                          type="number"
                          min="1"
                          step="0.01"
                          value={depositAmount}
                          onChange={(e) => setDepositAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>

                      {/* Payment Method */}
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                        <div className="grid grid-cols-1 gap-2">
                          <Button
                            type="button"
                            variant={paymentMethod === "paypal" ? "default" : "outline"}
                            className="justify-start h-auto py-3"
                            onClick={() => setPaymentMethod("paypal")}
                          >
                            <CreditCard className={`h-5 w-5 ${direction === "rtl" ? "ml-3" : "mr-3"}`} />
                            <div className="text-start">
                              <div className="font-medium">PayPal</div>
                              <div className="text-xs text-muted-foreground">
                                {language === "ar" ? "الدفع عبر PayPal" : "Pay with PayPal"}
                              </div>
                            </div>
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === "stripe" ? "default" : "outline"}
                            className="justify-start h-auto py-3"
                            onClick={() => setPaymentMethod("stripe")}
                          >
                            <CreditCard className={`h-5 w-5 ${direction === "rtl" ? "ml-3" : "mr-3"}`} />
                            <div className="text-start">
                              <div className="font-medium">Stripe</div>
                              <div className="text-xs text-muted-foreground">
                                {language === "ar" ? "بطاقة ائتمان/خصم" : "Credit/Debit Card"}
                              </div>
                            </div>
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === "bank_palestine" ? "default" : "outline"}
                            className="justify-start h-auto py-3"
                            onClick={() => setPaymentMethod("bank_palestine")}
                          >
                            <Building className={`h-5 w-5 ${direction === "rtl" ? "ml-3" : "mr-3"}`} />
                            <div className="text-start">
                              <div className="font-medium">{language === "ar" ? "بنك فلسطين" : "Bank of Palestine"}</div>
                              <div className="text-xs text-muted-foreground">
                                {language === "ar" ? "تحويل بنكي" : "Bank Transfer"}
                              </div>
                            </div>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Bank Transfer Receipt Upload */}
                      {paymentMethod === "bank_palestine" && (
                        <div className="space-y-4">
                          {/* Currency Selection */}
                          <div className="space-y-2">
                            <Label>{language === "ar" ? "العملة المحولة" : "Transfer Currency"}</Label>
                            <Select value={transferCurrency} onValueChange={(value: "USD" | "ILS") => setTransferCurrency(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">{language === "ar" ? "دولار أمريكي (USD)" : "US Dollar (USD)"}</SelectItem>
                                <SelectItem value="ILS">{language === "ar" ? "شيكل إسرائيلي (ILS)" : "Israeli Shekel (ILS)"}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Label htmlFor="receipt">{language === "ar" ? "صورة الإشعار البنكي" : "Bank Receipt Image"}</Label>
                          <Input
                            id="receipt"
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            required
                          />
                          {receiptPreview && (
                            <div className="mt-2">
                              <img
                                src={receiptPreview}
                                alt="Receipt preview"
                                className="max-w-full max-h-48 object-contain rounded border"
                              />
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {language === "ar" 
                              ? "الحد الأقصى للحجم: 16MB" 
                              : "Max size: 16MB"}
                          </p>
                        </div>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDepositDialogOpen(false)}>
                        {t("common.cancel")}
                      </Button>
                      <Button type="submit" disabled={deposit.isPending || !depositAmount || !paymentMethod}>
                        {deposit.isPending 
                          ? (language === "ar" ? "جاري المعالجة..." : "Processing...") 
                          : `${t("wallet.deposit")} ${depositAmount ? formatCurrency(depositAmount) : ""}`
                        }
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {language === "ar" ? "إحصائيات الشهر" : "This Month"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm">{language === "ar" ? "الإيداعات" : "Deposits"}</span>
              </div>
              <span className="font-medium text-green-500">
                {formatCurrency("0")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-sm">{language === "ar" ? "المصروفات" : "Expenses"}</span>
              </div>
              <span className="font-medium text-red-500">
                {formatCurrency("0")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wallet.transactions")}</CardTitle>
          <CardDescription>
            {language === "ar" ? "سجل جميع المعاملات المالية" : "History of all financial transactions"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                <TableHead>{t("common.amount")}</TableHead>
                <TableHead>{language === "ar" ? "الرصيد بعد" : "Balance After"}</TableHead>
                <TableHead>{t("common.description")}</TableHead>
                <TableHead>{t("common.date")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactionsLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {t("common.loading")}
                  </TableCell>
                </TableRow>
              ) : transactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {language === "ar" ? "لا توجد معاملات" : "No transactions found"}
                  </TableCell>
                </TableRow>
              ) : (
                transactions?.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(tx.type)}
                        <span>{getTransactionLabel(tx.type)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={
                        tx.type === "subscription" || tx.type === "withdrawal" || tx.type === "card_purchase" || tx.type === "commission"
                          ? "text-red-500"
                          : "text-green-500"
                      }>
                        {tx.type === "subscription" || tx.type === "withdrawal" || tx.type === "card_purchase" || tx.type === "commission" ? "-" : "+"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>{formatCurrency(tx.balanceAfter)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {tx.description || "-"}
                    </TableCell>
                    <TableCell>{formatDate(tx.createdAt)}</TableCell>
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
