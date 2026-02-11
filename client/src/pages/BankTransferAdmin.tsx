import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, RefreshCw, DollarSign, Edit } from "lucide-react";
import { useState } from "react";

export default function BankTransferAdmin() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  
  // Form fields for manual input
  const [transferredAmount, setTransferredAmount] = useState("");
  const [transferredCurrency, setTransferredCurrency] = useState<"USD" | "ILS">("USD");
  const [referenceNumber, setReferenceNumber] = useState("");

  const { data: requests, isLoading, refetch } = trpc.bankTransfer.getAll.useQuery({});
  const approveMutation = trpc.bankTransfer.approve.useMutation();
  const rejectMutation = trpc.bankTransfer.reject.useMutation();

  const openEditDialog = (request: any) => {
    setSelectedRequest(request);
    setTransferredAmount("");
    setTransferredCurrency("USD");
    setReferenceNumber("");
    setIsEditDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    if (!transferredAmount || !referenceNumber.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال جميع البيانات المطلوبة" : "Please enter all required fields");
      return;
    }

    const amount = parseFloat(transferredAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error(language === "ar" ? "المبلغ غير صحيح" : "Invalid amount");
      return;
    }

    try {
      await approveMutation.mutateAsync({ 
        requestId: selectedRequest.id,
        transferredAmount: amount,
        transferredCurrency,
        referenceNumber: referenceNumber.trim(),
      });
      toast.success(language === "ar" ? "تمت الموافقة على الطلب بنجاح" : "Request approved successfully");
      setIsEditDialogOpen(false);
      setSelectedRequest(null);
      setTransferredAmount("");
      setTransferredCurrency("USD");
      setReferenceNumber("");
      refetch();
    } catch (error: any) {
      toast.error(error.message || (language === "ar" ? "فشلت الموافقة" : "Approval failed"));
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectReason.trim()) {
      toast.error(language === "ar" ? "يرجى إدخال سبب الرفض" : "Please enter rejection reason");
      return;
    }

    try {
      await rejectMutation.mutateAsync({
        requestId: selectedRequest.id,
        reason: rejectReason,
      });
      toast.success(language === "ar" ? "تم رفض الطلب" : "Request rejected");
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason("");
      refetch();
    } catch (error: any) {
      toast.error(error.message || (language === "ar" ? "فشل الرفض" : "Rejection failed"));
    }
  };

  const openImageModal = (url: string) => {
    setImageUrl(url);
    setIsImageModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: "bg-yellow-500",
      approved: "bg-green-500",
      rejected: "bg-red-500",
    };

    const statusLabels = {
      pending: language === "ar" ? "قيد المراجعة" : "Pending",
      approved: language === "ar" ? "موافق عليه" : "Approved",
      rejected: language === "ar" ? "مرفوض" : "Rejected",
    };

    return (
      <Badge className={`${statusColors[status as keyof typeof statusColors]} text-white`}>
        {statusLabels[status as keyof typeof statusLabels]}
      </Badge>
    );
  };

  if (user?.role !== "owner" && user?.role !== "super_admin") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "غير مصرح" : "Unauthorized"}</CardTitle>
            <CardDescription>
              {language === "ar" ? "هذه الصفحة متاحة للمدراء فقط" : "This page is only available for admins"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">
              {language === "ar" ? "طلبات التحويل البنكي" : "Bank Transfer Requests"}
            </h1>
            <p className="text-muted-foreground">
              {language === "ar" ? "مراجعة والموافقة على طلبات الشحن" : "Review and approve recharge requests"}
            </p>
          </div>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 ml-2" />
          {language === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "جميع الطلبات" : "All Requests"}</CardTitle>
          <CardDescription>
            {language === "ar" ? "قائمة بجميع طلبات الشحن عبر التحويل البنكي" : "List of all bank transfer recharge requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{language === "ar" ? "جاري التحميل..." : "Loading..."}</p>
            </div>
          ) : !requests || requests.requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>{language === "ar" ? "لا توجد طلبات" : "No requests found"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "المعرف" : "ID"}</TableHead>
                  <TableHead>{language === "ar" ? "العميل" : "User"}</TableHead>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الإشعار" : "Receipt"}</TableHead>
                  <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.requests.map((request: any) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">#{request.id}</TableCell>
                    <TableCell>{request.userName || `User ${request.userId}`}</TableCell>
                    <TableCell>
                      {new Date(request.submittedAt).toLocaleString(language === "ar" ? "ar-EG" : "en-US")}
                    </TableCell>
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openImageModal(request.receiptImageUrl)}
                      >
                        <Eye className="w-4 h-4 ml-1" />
                        {language === "ar" ? "عرض" : "View"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {request.status === "pending" && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => openEditDialog(request)}
                            >
                              <Edit className="w-4 h-4 ml-1" />
                              {language === "ar" ? "مراجعة" : "Review"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setIsRejectDialogOpen(true);
                              }}
                            >
                              <XCircle className="w-4 h-4 ml-1" />
                              {language === "ar" ? "رفض" : "Reject"}
                            </Button>
                          </>
                        )}
                        {request.status !== "pending" && (
                          <span className="text-sm text-muted-foreground">
                            {language === "ar" ? "تمت المعالجة" : "Processed"}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "صورة الإشعار" : "Receipt Image"}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img src={imageUrl} alt="Receipt" className="max-w-full max-h-[70vh] object-contain" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit/Review Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "مراجعة الطلب" : "Review Request"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "أدخل بيانات التحويل يدوياً من الإشعار" : "Enter transfer details manually from the receipt"}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Show receipt image */}
            <div className="border rounded-lg p-4">
              <Label className="mb-2 block">{language === "ar" ? "صورة الإشعار" : "Receipt Image"}</Label>
              <img 
                src={selectedRequest?.receiptImageUrl} 
                alt="Receipt" 
                className="max-w-full max-h-64 object-contain mx-auto cursor-pointer"
                onClick={() => openImageModal(selectedRequest?.receiptImageUrl)}
              />
              <p className="text-xs text-center text-muted-foreground mt-2">
                {language === "ar" ? "اضغط للتكبير" : "Click to enlarge"}
              </p>
            </div>

            {/* Manual input form */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">{language === "ar" ? "المبلغ المحول" : "Transferred Amount"} *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder={language === "ar" ? "مثال: 120" : "e.g., 120"}
                  value={transferredAmount}
                  onChange={(e) => setTransferredAmount(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="currency">{language === "ar" ? "العملة" : "Currency"} *</Label>
                <Select value={transferredCurrency} onValueChange={(v) => setTransferredCurrency(v as "USD" | "ILS")}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - {language === "ar" ? "دولار أمريكي" : "US Dollar"}</SelectItem>
                    <SelectItem value="ILS">ILS - {language === "ar" ? "شيكل إسرائيلي" : "Israeli Shekel"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="refNumber">{language === "ar" ? "الرقم المرجعي" : "Reference Number"} *</Label>
              <Input
                id="refNumber"
                placeholder={language === "ar" ? "مثال: 1234567890" : "e.g., 1234567890"}
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            {/* Calculated USD amount preview */}
            {transferredAmount && parseFloat(transferredAmount) > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-600">
                  {language === "ar" ? "المبلغ المتوقع بالدولار:" : "Expected USD Amount:"}
                </p>
                <p className="text-2xl font-bold text-blue-700">
                  ${transferredCurrency === "USD" 
                    ? parseFloat(transferredAmount).toFixed(2)
                    : (parseFloat(transferredAmount) * 0.27).toFixed(2)
                  }
                </p>
                {transferredCurrency === "ILS" && (
                  <p className="text-xs text-blue-600/70 mt-1">
                    {language === "ar" ? "سعر الصرف: 1 ILS = 0.27 USD" : "Exchange rate: 1 ILS = 0.27 USD"}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              <CheckCircle className="w-4 h-4 ml-2" />
              {approveMutation.isPending 
                ? (language === "ar" ? "جاري الموافقة..." : "Approving...") 
                : (language === "ar" ? "موافقة وإضافة الرصيد" : "Approve & Add Balance")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "رفض الطلب" : "Reject Request"}</DialogTitle>
            <DialogDescription>
              {language === "ar" ? "يرجى إدخال سبب الرفض" : "Please enter the reason for rejection"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={language === "ar" ? "سبب الرفض..." : "Rejection reason..."}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectMutation.isPending}>
              <XCircle className="w-4 h-4 ml-2" />
              {rejectMutation.isPending 
                ? (language === "ar" ? "جاري الرفض..." : "Rejecting...") 
                : (language === "ar" ? "تأكيد الرفض" : "Confirm Rejection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
