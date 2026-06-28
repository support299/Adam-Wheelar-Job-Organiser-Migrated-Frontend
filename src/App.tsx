import { Routes, Route, Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Toaster } from "@/components/ui/sonner";
import { AccessGate } from "@/components/auth/AccessGate";
import { selectIsAdmin } from "@/store/authSlice";
import { IndexPage } from "@/pages/IndexPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { PlansPage } from "@/pages/PlansPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { ConnectPage } from "@/pages/ConnectPage";
import { ContactsListPage } from "@/pages/ContactsListPage";
import { ContactDetailPage } from "@/pages/ContactDetailPage";
import { ContactJobsPage } from "@/pages/ContactJobsPage";
import { AdminMapsKeyPage } from "@/pages/AdminMapsKeyPage";

function HomeRoute() {
  const isAdmin = useSelector(selectIsAdmin);
  if (isAdmin === false) return <Navigate to="/plans" replace />;
  return <AccessGate><IndexPage /></AccessGate>;
}

export default function App() {
  return (
    <>
      <Toaster richColors position="top-right" />
      <Routes>
        {/* GHL iframe route — no auth gate needed, AccessGate handles iframe detection */}
        <Route path="/contact/jobs/:ghlContactId" element={<AccessGate><ContactJobsPage /></AccessGate>} />

        {/* Main app routes */}
        <Route path="/" element={<HomeRoute />} />
        <Route path="/settings" element={<AccessGate><SettingsPage /></AccessGate>} />
        <Route path="/plans" element={<AccessGate><PlansPage /></AccessGate>} />
        <Route path="/reports" element={<AccessGate><ReportsPage /></AccessGate>} />
        <Route path="/connect" element={<AccessGate><ConnectPage /></AccessGate>} />
        <Route path="/contacts" element={<AccessGate><ContactsListPage /></AccessGate>} />
        <Route path="/contacts/:contactId" element={<AccessGate><ContactDetailPage /></AccessGate>} />
        <Route path="/admin/maps-key" element={<AdminMapsKeyPage />} />
      </Routes>
    </>
  );
}
