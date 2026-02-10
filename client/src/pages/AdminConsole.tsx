import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, UserCog, Building2, Shield, Settings } from "lucide-react";

// Import existing page components
import StaffManagement from "./StaffManagement";
import Clients from "./Clients";
import Resellers from "./Resellers";
import PermissionPlans from "./PermissionPlans";
import UserPermissionOverride from "./UserPermissionOverride";

export default function AdminConsole() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("staff");

  // Only owner/super_admin can access
  if (user?.role !== "owner" && user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {language === "ar" ? "غير مصرح" : "Unauthorized"}
          </h2>
          <p className="text-muted-foreground">
            {language === "ar" 
              ? "ليس لديك صلاحية للوصول إلى لوحة الإدارة" 
              : "You don't have permission to access the admin console"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === "ar" ? "لوحة الإدارة" : "Admin Console"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {language === "ar" 
            ? "إدارة المستخدمين والصلاحيات من مكان واحد" 
            : "Manage users and permissions from one place"}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto">
          <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-background">
            <Users className="h-4 w-4" />
            {language === "ar" ? "الموظفين" : "Staff"}
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2 data-[state=active]:bg-background">
            <UserCog className="h-4 w-4" />
            {language === "ar" ? "العملاء" : "Clients"}
          </TabsTrigger>
          <TabsTrigger value="resellers" className="gap-2 data-[state=active]:bg-background">
            <Building2 className="h-4 w-4" />
            {language === "ar" ? "الموزعين" : "Resellers"}
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 data-[state=active]:bg-background">
            <Shield className="h-4 w-4" />
            {language === "ar" ? "خطط الصلاحيات" : "Permission Plans"}
          </TabsTrigger>
          <TabsTrigger value="overrides" className="gap-2 data-[state=active]:bg-background">
            <Settings className="h-4 w-4" />
            {language === "ar" ? "الاستثناءات" : "Overrides"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-4 mt-0">
          <StaffManagement />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4 mt-0">
          <Clients />
        </TabsContent>

        <TabsContent value="resellers" className="space-y-4 mt-0">
          <Resellers />
        </TabsContent>

        <TabsContent value="plans" className="space-y-4 mt-0">
          <PermissionPlans />
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4 mt-0">
          <UserPermissionOverride />
        </TabsContent>
      </Tabs>
    </div>
  );
}
