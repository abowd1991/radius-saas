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
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle, XCircle, Eye, RefreshCw, DollarSign } from "lucide-react";
import { useState } from "react";

export default function BankTransferAdmin() {
  const { user } = useAuth();
  const { language, direction } = useLanguage();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const { data: requests, isLoading, refetch } = trpc.bankTransfer.getAll.useQuery({});
  const approveMutation = trpc.bankTransfer.approve.useMutation();
  const rejectMutation = trpc.bankTransfer.reject.useMutation();

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      await approveMutation.mutateAsync({ requestId: selectedRequest.id });
      toast.success(language === "ar" ? "تمت الموافقة على الطلب بنجاح" : "Request approved successfully");
      setIsApproveDialogOpen(false);
      setSelectedRequest(null);
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
      <Badge className={statusColors[status as keyof typeof statusColors]}>
        {statusLabels[status as keyof typeof statusLabels]}
      </Badge>
    );
  };

  if (!user || (user.role !== "owner" && user.role !== "super_admin")) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "غير مصرح" : "Unauthorized"}</CardTitle>
            <CardDescription>
              {language === "ar"
                ? "ليس لديك صلاحية الوصول إلى هذه الصفحة"
                : "You don't have permission to access this page"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8" dir={direction}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "طلبات التحويل البنكي" : "Bank Transfer Requests"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar"
              ? "مراجعة والموافقة على طلبات شحن الرصيد"
              : "Review and approve balance recharge requests"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${direction === "rtl" ? "ml-2" : "mr-2"}`} />
          {language === "ar" ? "تحديث" : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "جميع الطلبات" : "All Requests"}</CardTitle>
          <CardDescription>
            {language === "ar"
              ? "قائمة بجميع طلبات التحويل البنكي"
              : "List of all bank transfer requests"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : !requests || !requests.requests || requests.requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا توجد طلبات" : "No requests found"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "رقم الطلب" : "Request #"}</TableHead>
                    <TableHead>{language === "ar" ? "العميل" : "Client"}</TableHead>
                    <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                    <TableHead>{language === "ar" ? "العملة" : "Currency"}</TableHead>
                    <TableHead>{language === "ar" ? "المبلغ بالدولار" : "USD Amount"}</TableHead>
                    <TableHead>{language === "ar" ? "الرقم المرجعي" : "Reference"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                    <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.requests.map((request: any) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">#{request.id}</TableCell>
                      <TableCell>{request.user?.name || "N/A"}</TableCell>
                      <TableCell>{request.amount.toFixed(2)}</TableCell>
                      <TableCell>{request.currency}</TableCell>
                      <TableCell>
                        {request.currency === "USD"
                          ? request.amount.toFixed(2)
                          : request.usdAmount?.toFixed(2) || "N/A"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {request.referenceNumber || "N/A"}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {new Date(request.createdAt).toLocaleDateString(
                          language === "ar" ? "ar-EG" : "en-US"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openImageModal(request.receiptImageUrl)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {request.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setIsApproveDialogOpen(true);
                                }}
                              >
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setIsRejectDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 text-red-500" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "صورة الإشعار البنكي" : "Bank Receipt Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <img src={imageUrl} alt="Receipt" className="max-w-full max-h-[70vh] object-contain" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تأكيد الموافقة" : "Confirm Approval"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "هل أنت متأكد من الموافقة على هذا الطلب؟ سيتم إضافة الرصيد إلى محفظة العميل تلقائياً."
                : "Are you sure you want to approve this request? The balance will be added to the client's wallet automatically."}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between">
                <span className="font-medium">
                  {language === "ar" ? "العميل:" : "Client:"}
                </span>
                <span>{selectedRequest.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">
                  {language === "ar" ? "المبلغ:" : "Amount:"}
                </span>
                <span>
                  {selectedRequest.amount} {selectedRequest.currency}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">
                  {language === "ar" ? "المبلغ بالدولار:" : "USD Amount:"}
                </span>
                <span>
                  ${selectedRequest.currency === "USD"
                    ? selectedRequest.amount.toFixed(2)
                    : selectedRequest.usdAmount?.toFixed(2) || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">
                  {language === "ar" ? "الرقم المرجعي:" : "Reference:"}
                </span>
                <span className="font-mono text-xs">{selectedRequest.referenceNumber || "N/A"}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending
                ? language === "ar"
                  ? "جاري الموافقة..."
                  : "Approving..."
                : language === "ar"
                ? "موافقة"
                : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "رفض الطلب" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "يرجى إدخال سبب رفض الطلب"
                : "Please enter the reason for rejecting this request"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder={
                language === "ar"
                  ? "سبب الرفض (مثال: الصورة غير واضحة، المبلغ غير مطابق، إلخ)"
                  : "Rejection reason (e.g., unclear image, amount mismatch, etc.)"
              }
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
            >
              {rejectMutation.isPending
                ? language === "ar"
                  ? "جاري الرفض..."
                  : "Rejecting..."
                : language === "ar"
                ? "رفض"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
