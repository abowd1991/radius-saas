import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Shield, Check, X } from "lucide-react";


export default function UserPermissionOverride() {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);


  // Fetch all users
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery({});

  // Fetch user's effective permissions
  const { data: effectivePermissions, isLoading: permissionsLoading, refetch: refetchPermissions } = 
    trpc.userEffectivePermissions.get.useQuery(
      { userId: selectedUserId || undefined },
      { enabled: !!selectedUserId }
    );

  // Fetch all permission groups
  const { data: allGroups } = trpc.permissionGroups.list.useQuery();

  // Add override mutation
  const addOverride = trpc.userPermissionOverrides.upsert.useMutation({
    onSuccess: () => {
      alert("تم إضافة الاستثناء بنجاح");
      refetchPermissions();
    },
    onError: (error: any) => {
      alert(`فشل إضافة الاستثناء: ${error.message}`);
    },
  });

  // Remove override mutation
  const removeOverride = trpc.userPermissionOverrides.delete.useMutation({
    onSuccess: () => {
      alert("تم إزالة الاستثناء بنجاح");
      refetchPermissions();
    },
    onError: (error: any) => {
      alert(`فشل إزالة الاستثناء: ${error.message}`);
    },
  });

  const handleToggleOverride = (groupId: number, currentlyGranted: boolean | null, isInPlan: boolean) => {
    if (!selectedUserId) return;

    // If no override exists
    if (currentlyGranted === null) {
      // Grant if not in plan, Deny if in plan
      addOverride.mutate({
        userId: selectedUserId,
        groupId,
        isGranted: !isInPlan,
      });
    } else {
      // Remove override (revert to plan)
      removeOverride.mutate({
        userId: selectedUserId,
        groupId,
      });
    }
  };

  const selectedUser = users?.find((u: any) => u.id === selectedUserId);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">استثناءات الصلاحيات</h1>
          <p className="text-muted-foreground mt-2">
            إدارة الاستثناءات الفردية للمستخدمين بدون تغيير الخطة الأساسية
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اختر المستخدم</CardTitle>
          <CardDescription>
            اختر المستخدم لعرض وتعديل استثناءات الصلاحيات الخاصة به
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedUserId?.toString() || ""}
            onValueChange={(value) => setSelectedUserId(Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر مستخدم..." />
            </SelectTrigger>
            <SelectContent>
              {usersLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                users?.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.name} ({user.email}) - {user.role}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedUserId && (
        <>
          {/* User Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                معلومات المستخدم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الاسم:</span>
                <span className="font-medium">{selectedUser?.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">البريد الإلكتروني:</span>
                <span className="font-medium">{selectedUser?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الدور:</span>
                <Badge>{selectedUser?.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الخطة الحالية:</span>
                <Badge variant="outline">
                  {effectivePermissions?.planName || "لا توجد خطة"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Permission Groups Card */}
          <Card>
            <CardHeader>
              <CardTitle>مجموعات الصلاحيات</CardTitle>
              <CardDescription>
                الأخضر = ممنوح من الخطة | الأحمر = محظور من الخطة | الأزرق = استثناء مخصص
              </CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {allGroups?.map((group: any) => {
                    const permission = (effectivePermissions as any)?.groups?.find(
                      (p: any) => p.groupId === group.id
                    );
                    const isGranted = permission?.isGranted || false;
                    const isInPlan = permission?.isInPlan || false;
                    const hasOverride = permission?.hasOverride || false;

                    return (
                      <div
                        key={group.id}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          hasOverride
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                            : isGranted
                            ? "border-green-500 bg-green-50 dark:bg-green-950"
                            : "border-red-500 bg-red-50 dark:bg-red-950"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{group.name}</h4>
                            {hasOverride && (
                              <Badge variant="default" className="text-xs">
                                استثناء
                              </Badge>
                            )}
                            {isInPlan && !hasOverride && (
                              <Badge variant="outline" className="text-xs">
                                من الخطة
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {group.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {isGranted ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <X className="h-5 w-5 text-red-600" />
                            )}
                            <span className="text-sm font-medium">
                              {isGranted ? "ممنوح" : "محظور"}
                            </span>
                          </div>

                          <Button
                            variant={hasOverride ? "destructive" : "outline"}
                            size="sm"
                            onClick={() =>
                              handleToggleOverride(
                                group.id,
                                hasOverride ? isGranted : null,
                                isInPlan
                              )
                            }
                            disabled={addOverride.isPending || removeOverride.isPending}
                          >
                            {addOverride.isPending || removeOverride.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : hasOverride ? (
                              "إزالة الاستثناء"
                            ) : isInPlan ? (
                              "حظر"
                            ) : (
                              "منح"
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
