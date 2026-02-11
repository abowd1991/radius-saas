import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { History, TrendingUp, TrendingDown, Search, Calendar } from "lucide-react";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { usePagination } from "@/hooks/usePagination";
import { DataPagination } from "@/components/ui/data-pagination";

export default function DepositHistory() {
  const { language, direction } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Fetch deposit history
  const { data: deposits, isLoading } = trpc.wallet.getDepositHistory.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // Pagination
  const {
    paginatedData: paginatedDeposits,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
  } = usePagination(deposits || [], 15);

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">{language === "ar" ? "مكتمل" : "Completed"}</Badge>;
      case "pending":
        return <Badge variant="secondary">{language === "ar" ? "قيد المراجعة" : "Pending"}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{language === "ar" ? "مرفوض" : "Rejected"}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "bank_transfer":
        return (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span>{language === "ar" ? "تحويل بنكي" : "Bank Transfer"}</span>
          </div>
        );
      case "credit":
        return (
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span>{language === "ar" ? "إضافة رصيد" : "Credit"}</span>
          </div>
        );
      case "debit":
        return (
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <span>{language === "ar" ? "خصم" : "Debit"}</span>
          </div>
        );
      default:
        return <span>{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <History className="h-6 w-6" />
          {language === "ar" ? "سجل عمليات الشحن" : "Deposit History"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar" ? "عرض جميع عمليات الشحن والسحب" : "View all deposit and withdrawal transactions"}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{language === "ar" ? "تصفية النتائج" : "Filter Results"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "الحالة" : "Status"}</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="completed">{language === "ar" ? "مكتمل" : "Completed"}</SelectItem>
                  <SelectItem value="pending">{language === "ar" ? "قيد المراجعة" : "Pending"}</SelectItem>
                  <SelectItem value="rejected">{language === "ar" ? "مرفوض" : "Rejected"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "النوع" : "Type"}</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{language === "ar" ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="bank_transfer">{language === "ar" ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                  <SelectItem value="credit">{language === "ar" ? "إضافة رصيد" : "Credit"}</SelectItem>
                  <SelectItem value="debit">{language === "ar" ? "خصم" : "Debit"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "من تاريخ" : "From Date"}</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label>{language === "ar" ? "إلى تاريخ" : "To Date"}</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TableSkeleton rows={10} columns={6} />
          ) : !paginatedDeposits || paginatedDeposits.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {language === "ar" ? "لا توجد عمليات شحن" : "No deposit history found"}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                    <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "الرقم المرجعي" : "Reference"}</TableHead>
                    <TableHead>{language === "ar" ? "ملاحظات" : "Notes"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeposits.map((deposit: any) => (
                    <TableRow key={deposit.id}>
                      <TableCell className="font-medium">{formatDate(deposit.createdAt)}</TableCell>
                      <TableCell>{getTypeBadge(deposit.type)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(deposit.amount)}</TableCell>
                      <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                      <TableCell className="font-mono text-sm">{deposit.referenceNumber || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{deposit.notes || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="mt-4">
                <DataPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={itemsPerPage}
                  totalItems={deposits?.length || 0}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
