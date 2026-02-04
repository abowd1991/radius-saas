import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Calendar, DollarSign, Server } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BillingInfoProps {
  data: {
    activeNasCount: number;
    monthlyCost: number;
    billingStatus: string;
    billingStartAt: Date | null;
    lastBillingAt: Date | null;
    nextBillingAt: Date | null;
    daysUntilNextBilling: number | null;
    currentBalance: number;
  } | null;
  isLoading: boolean;
}

export function BillingInfo({ data, isLoading }: BillingInfoProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>معلومات الفوترة</CardTitle>
          <CardDescription>لم يتم تفعيل نظام الفوترة بعد</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              سيتم تفعيل نظام الفوترة من قبل المسؤول
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    past_due: "bg-red-500",
    suspended: "bg-gray-500",
  };

  const statusLabels: Record<string, string> = {
    active: "نشط",
    past_due: "متأخر",
    suspended: "معلق",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>معلومات الفوترة</CardTitle>
            <CardDescription>نظام الفوترة الشهري حسب عدد NAS الفعّالة</CardDescription>
          </div>
          <Badge className={statusColors[data.billingStatus]}>
            {statusLabels[data.billingStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Past Due Alert */}
        {data.billingStatus === "past_due" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              رصيدك غير كافٍ. يرجى إضافة رصيد لمحفظتك لتجنب تعليق الخدمات.
            </AlertDescription>
          </Alert>
        )}

        {/* Active NAS & Monthly Cost */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">عدد NAS الفعّالة</p>
              <p className="text-2xl font-bold">{data.activeNasCount}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">التكلفة الشهرية</p>
              <p className="text-2xl font-bold">${data.monthlyCost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ${(data.monthlyCost / (data.activeNasCount || 1)).toFixed(2)} لكل NAS
              </p>
            </div>
          </div>
        </div>

        {/* Next Billing Date */}
        {data.nextBillingAt && (
          <div className="flex items-start gap-3 p-4 border rounded-lg">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">الخصم القادم</p>
              <p className="text-lg font-semibold">
                {new Date(data.nextBillingAt).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              {data.daysUntilNextBilling !== null && (
                <p className="text-sm text-muted-foreground mt-1">
                  {data.daysUntilNextBilling > 0
                    ? `بعد ${data.daysUntilNextBilling} يوم`
                    : "اليوم"}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Billing History */}
        {data.billingStartAt && (
          <div className="text-sm text-muted-foreground space-y-1 pt-2 border-t">
            <p>
              <span className="font-medium">تاريخ التفعيل:</span>{" "}
              {new Date(data.billingStartAt).toLocaleDateString("ar-EG")}
            </p>
            {data.lastBillingAt && (
              <p>
                <span className="font-medium">آخر خصم:</span>{" "}
                {new Date(data.lastBillingAt).toLocaleDateString("ar-EG")}
              </p>
            )}
            <p>
              <span className="font-medium">الرصيد الحالي:</span> $
              {data.currentBalance.toFixed(2)}
            </p>
          </div>
        )}

        {/* Info Note */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <p className="font-medium mb-1">ملاحظة:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>يتم الخصم تلقائياً كل 30 يوم من تاريخ التفعيل</li>
            <li>التكلفة: $10 شهرياً لكل NAS فعّال</li>
            <li>NAS المعطّلة لا تُحسب في الفوترة</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
