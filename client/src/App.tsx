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
import { Redirect } from "wouter";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
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
      <Route path="/wallet">
        <DashboardLayout>
          <Wallet />
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
      <ThemeProvider defaultTheme="light">
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
