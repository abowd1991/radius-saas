import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, TrendingUp, TrendingDown, Wallet, DollarSign, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

export default function WalletLedger() {
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);
  const [isDeductOpen, setIsDeductOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit">("all");

  // Form states
  const [creditForm, setCreditForm] = useState({
    userId: "",
    amount: "",
    reason: "",
    reasonAr: "",
  });

  const [deductForm, setDeductForm] = useState({
    userId: "",
    amount: "",
    reason: "",
    reasonAr: "",
  });

  // Queries
  const { data: summary, isLoading: summaryLoading } = trpc.wallet.getWalletSummary.useQuery();
  const { data: history, isLoading: historyLoading, refetch } = trpc.wallet.getTransactionHistory.useQuery({
    type: filterType === "all" ? undefined : filterType,
    limit: 100,
  });

  // Mutations
  const addCreditMutation = trpc.wallet.addCredit.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة الرصيد بنجاح");
      setIsAddCreditOpen(false);
      setCreditForm({ userId: "", amount: "", reason: "", reasonAr: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deductMutation = trpc.wallet.deductBalance.useMutation({
    onSuccess: () => {
      toast.success("تم خصم الرصيد بنجاح");
      setIsDeductOpen(false);
      setDeductForm({ userId: "", amount: "", reason: "", reasonAr: "" });
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleAddCredit = () => {
    if (!creditForm.userId || !creditForm.amount || !creditForm.reason) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    addCreditMutation.mutate({
      userId: parseInt(creditForm.userId),
      amount: parseFloat(creditForm.amount),
      reason: creditForm.reason,
      reasonAr: creditForm.reasonAr || undefined,
    });
  };

  const handleDeduct = () => {
    if (!deductForm.userId || !deductForm.amount || !deductForm.reason) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    deductMutation.mutate({
      userId: parseInt(deductForm.userId),
      amount: parseFloat(deductForm.amount),
      reason: deductForm.reason,
      reasonAr: deductForm.reasonAr || undefined,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-SA", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">سجل المحفظة</h1>
          <p className="text-muted-foreground">إدارة المعاملات المالية وسجل المحفظة</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isAddCreditOpen} onOpenChange={setIsAddCreditOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة رصيد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة رصيد</DialogTitle>
                <DialogDescription>إضافة رصيد إلى محفظة المستخدم</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>رقم المستخدم *</Label>
                  <Input
                    type="number"
                    value={creditForm.userId}
                    onChange={(e) => setCreditForm({ ...creditForm, userId: e.target.value })}
                    placeholder="مثال: 3"
                  />
                </div>
                <div>
                  <Label>المبلغ (USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={creditForm.amount}
                    onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                    placeholder="مثال: 100.00"
                  />
                </div>
                <div>
                  <Label>السبب (English) *</Label>
                  <Textarea
                    value={creditForm.reason}
                    onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                    placeholder="Manual deposit by admin"
                  />
                </div>
                <div>
                  <Label>السبب (العربية)</Label>
                  <Textarea
                    value={creditForm.reasonAr}
                    onChange={(e) => setCreditForm({ ...creditForm, reasonAr: e.target.value })}
                    placeholder="إيداع يدوي من المشرف"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddCreditOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleAddCredit} disabled={addCreditMutation.isPending}>
                  {addCreditMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  إضافة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeductOpen} onOpenChange={setIsDeductOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                خصم رصيد
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>خصم رصيد</DialogTitle>
                <DialogDescription>خصم رصيد من محفظة المستخدم</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>رقم المستخدم *</Label>
                  <Input
                    type="number"
                    value={deductForm.userId}
                    onChange={(e) => setDeductForm({ ...deductForm, userId: e.target.value })}
                    placeholder="مثال: 3"
                  />
                </div>
                <div>
                  <Label>المبلغ (USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={deductForm.amount}
                    onChange={(e) => setDeductForm({ ...deductForm, amount: e.target.value })}
                    placeholder="مثال: 50.00"
                  />
                </div>
                <div>
                  <Label>السبب (English) *</Label>
                  <Textarea
                    value={deductForm.reason}
                    onChange={(e) => setDeductForm({ ...deductForm, reason: e.target.value })}
                    placeholder="Card purchase deduction"
                  />
                </div>
                <div>
                  <Label>السبب (العربية)</Label>
                  <Textarea
                    value={deductForm.reasonAr}
                    onChange={(e) => setDeductForm({ ...deductForm, reasonAr: e.target.value })}
                    placeholder="خصم شراء كروت"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeductOpen(false)}>
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={handleDeduct} disabled={deductMutation.isPending}>
                  {deductMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  خصم
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الرصيد الحالي</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.currentBalance)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيداعات</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalCredits)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي السحوبات</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalDebits)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">صافي الحركة</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(summary.totalCredits - summary.totalDebits)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>سجل المعاملات</CardTitle>
              <CardDescription>جميع المعاملات المالية</CardDescription>
            </div>
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المعاملات</SelectItem>
                <SelectItem value="credit">الإيداعات فقط</SelectItem>
                <SelectItem value="debit">السحوبات فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : history && history.transactions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>التاريخ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المبلغ</TableHead>
                  <TableHead>الرصيد قبل</TableHead>
                  <TableHead>الرصيد بعد</TableHead>
                  <TableHead>السبب</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.transactions.map((transaction: any) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {formatDate(transaction.createdAt)}
                    </TableCell>
                    <TableCell>
                      {transaction.type === "credit" ? (
                        <Badge className="bg-green-500">
                          <ArrowUpCircle className="mr-1 h-3 w-3" />
                          إيداع
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <ArrowDownCircle className="mr-1 h-3 w-3" />
                          سحب
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={transaction.type === "credit" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                      {transaction.type === "credit" ? "+" : "-"}
                      {formatCurrency(parseFloat(transaction.amount))}
                    </TableCell>
                    <TableCell>{formatCurrency(parseFloat(transaction.balanceBefore))}</TableCell>
                    <TableCell>{formatCurrency(parseFloat(transaction.balanceAfter))}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.reasonAr || transaction.reason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد معاملات
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
