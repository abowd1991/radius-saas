import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Users, Building2, UserCog, Settings } from "lucide-react";

// Import existing page components
import StaffManagement from "./StaffManagement";
import Clients from "./Clients";
import Resellers from "./Resellers";
import PermissionPlans from "./PermissionPlans";
import UserPermissionOverride from "./UserPermissionOverride";

export default function AdminConsole() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState("users");

  // Only owner/super_admin can access
  if (user?.role !== "owner" && user?.role !== "super_admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="p-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {language === "ar" ? "غير مصرح" : "Unauthorized"}
            </h2>
            <p className="text-muted-foreground">
              {language === "ar" 
                ? "ليس لديك صلاحية للوصول إلى لوحة الإدارة" 
                : "You don't have permission to access the admin console"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {language === "ar" ? "لوحة الإدارة" : "Admin Console"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar" 
            ? "إدارة المستخدمين والصلاحيات من مكان واحد" 
            : "Manage users and permissions from one place"}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === "ar" ? "الموظفين" : "Users"}
            </span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === "ar" ? "العملاء" : "Clients"}
            </span>
          </TabsTrigger>
          <TabsTrigger value="resellers" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === "ar" ? "الموزعين" : "Resellers"}
            </span>
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === "ar" ? "خطط الصلاحيات" : "Plans"}
            </span>
          </TabsTrigger>
          <TabsTrigger value="overrides" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">
              {language === "ar" ? "الاستثناءات" : "Overrides"}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <StaffManagement />
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Clients />
        </TabsContent>

        <TabsContent value="resellers" className="space-y-4">
          <Resellers />
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <PermissionPlans />
        </TabsContent>

        <TabsContent value="overrides" className="space-y-4">
          <UserPermissionOverride />
        </TabsContent>
      </Tabs>
    </div>
  );
}
