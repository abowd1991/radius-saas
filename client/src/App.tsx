import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Plans from "./pages/Plans";
import Vouchers from "./pages/Vouchers";
import Wallet from "./pages/Wallet";
import Support from "./pages/Support";
import Clients from "./pages/Clients";
import Resellers from "./pages/Resellers";
import Invoices from "./pages/Invoices";
import NasDevices from "./pages/NasDevices";
import Settings from "./pages/Settings";
import Sessions from "./pages/Sessions";
import MikrotikSetup from "./pages/MikrotikSetup";
import PrintCards from "./pages/PrintCards";
import TenantSubscriptions from "./pages/TenantSubscriptions";
import Auth from "./pages/Auth";
import Reports from "./pages/Reports";
import Backups from "./pages/Backups";
import Landing from "./pages/Landing";
import Subscribers from "./pages/Subscribers";
import OnlineUsers from "./pages/OnlineUsers";
import VpnConnections from "./pages/VpnConnections";
import VpnLogs from "./pages/VpnLogs";
import AuditLog from "./pages/AuditLog";
import IpPoolManagement from "./pages/IpPoolManagement";
import RadiusLogs from "./pages/RadiusLogs";
import NasHealthMonitor from "./pages/NasHealthMonitor";
import BandwidthReports from "./pages/BandwidthReports";
import SaasPlansManagement from "./pages/SaasPlansManagement";
import ClientManagement from "./pages/ClientManagement";
import UsersManagement from "./pages/UsersManagement";
import SmsManagement from "./pages/SmsManagement";
import RadiusControlPanel from "./pages/RadiusControlPanel";
import SystemAdmin from "./pages/SystemAdmin";
import FeatureAccessControl from "./pages/FeatureAccessControl";
import PermissionPlans from "./pages/PermissionPlans";
import UserPermissionOverride from "./pages/UserPermissionOverride";
import BackupManagement from "./pages/BackupManagement";
import AdminControl from "./pages/AdminControl";
import StaffManagement from "./pages/StaffManagement";
import SiteSettings from "./pages/SiteSettings";
import SubscriptionPlansManagement from "./pages/SubscriptionPlansManagement";
import WalletLedger from "./pages/WalletLedger";
import OwnerBillingDashboard from "./pages/OwnerBillingDashboard";
import { Redirect } from "wouter";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/home" component={Home} />
      <Route path="/auth" component={Auth} />
      <Route path="/login" component={Auth} />
      <Route path="/register" component={Auth} />
      <Route path="/dashboard">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/plans">
        <DashboardLayout>
          <Plans />
        </DashboardLayout>
      </Route>
      <Route path="/vouchers">
        <DashboardLayout>
          <Vouchers />
        </DashboardLayout>
      </Route>
      <Route path="/subscribers">
        <DashboardLayout>
          <Subscribers />
        </DashboardLayout>
      </Route>
      <Route path="/wallet">
        <DashboardLayout>
          <Wallet />
        </DashboardLayout>
      </Route>
      <Route path="/wallet-ledger">
        <DashboardLayout>
          <WalletLedger />
        </DashboardLayout>
      </Route>
      <Route path="/owner-billing">
        <DashboardLayout>
          <OwnerBillingDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/support">
        <DashboardLayout>
          <Support />
        </DashboardLayout>
      </Route>
      <Route path="/clients">
        <DashboardLayout>
          <Clients />
        </DashboardLayout>
      </Route>
      <Route path="/users-management" component={UsersManagement} />
      <Route path="/admin-control">
        <DashboardLayout>
          <AdminControl />
        </DashboardLayout>
      </Route>
      <Route path="/staff-management">
        <DashboardLayout>
          <StaffManagement />
        </DashboardLayout>
      </Route>
      <Route path="/resellers">
        <DashboardLayout>
          <Resellers />
        </DashboardLayout>
      </Route>
      <Route path="/invoices">
        <DashboardLayout>
          <Invoices />
        </DashboardLayout>
      </Route>
      <Route path="/nas">
        <DashboardLayout>
          <NasDevices />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      <Route path="/sessions">
        <DashboardLayout>
          <Sessions />
        </DashboardLayout>
      </Route>
      <Route path="/online-users">
        <Redirect to="/sessions" />
      </Route>
      <Route path="/vpn">
        <DashboardLayout>
          <VpnConnections />
        </DashboardLayout>
      </Route>
      <Route path="/vpn-logs">
        <DashboardLayout>
          <VpnLogs />
        </DashboardLayout>
      </Route>
      <Route path="/audit-log">
        <DashboardLayout>
          <AuditLog />
        </DashboardLayout>
      </Route>
      <Route path="/ip-pool">
        <IpPoolManagement />
      </Route>
      <Route path="/radius-logs">
        <RadiusLogs />
      </Route>
      <Route path="/nas-health">
        <NasHealthMonitor />
      </Route>
      <Route path="/bandwidth">
        <BandwidthReports />
      </Route>
      <Route path="/saas-plans">
        <SaasPlansManagement />
      </Route>
      <Route path="/sms">
        <DashboardLayout>
          <SmsManagement />
        </DashboardLayout>
      </Route>
      <Route path="/radius-control">
        <DashboardLayout>
          <RadiusControlPanel />
        </DashboardLayout>
      </Route>
      <Route path="/system-admin">
        <DashboardLayout>
          <SystemAdmin />
        </DashboardLayout>
      </Route>
      <Route path="/feature-access">
        <DashboardLayout>
          <FeatureAccessControl />
        </DashboardLayout>
      </Route>
      <Route path="/permission-plans">
        <DashboardLayout>
          <PermissionPlans />
        </DashboardLayout>
      </Route>
      <Route path="/user-permission-override">
        <DashboardLayout>
          <UserPermissionOverride />
        </DashboardLayout>
      </Route>
      <Route path="/client-management">
        <ClientManagement />
      </Route>
      <Route path="/reports">
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path="/backups">
        <DashboardLayout>
          <Backups />
        </DashboardLayout>
      </Route>
      <Route path="/backup-management">
        <DashboardLayout>
          <BackupManagement />
        </DashboardLayout>
      </Route>
      <Route path="/site-settings">
        <DashboardLayout>
          <SiteSettings />
        </DashboardLayout>
      </Route>
      <Route path="/subscription-plans">
        <DashboardLayout>
          <SubscriptionPlansManagement />
        </DashboardLayout>
      </Route>
      <Route path="/tenant-subscriptions">
        <TenantSubscriptions />
      </Route>
      <Route path="/card-templates">
        <Redirect to="/print-cards" />
      </Route>
      <Route path="/print-cards">
        <PrintCards />
      </Route>
      <Route path="/mikrotik-setup" component={MikrotikSetup} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
