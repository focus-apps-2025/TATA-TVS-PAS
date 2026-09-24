// src/App.tsx
import React from "react";
import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import TeamManagement from "./pages/TeamManagement";
import MasterDescription from "./pages/MasterDescription";
import FinalReport from "./pages/FinalReport"; 
import TataFinalReport from "./pages/TataFinalReport"; 
import ThreeWReconciliation from "./pages/ThreeWReconciliation";
import ReportSelector from "./pages/ReportSelector"; // Selection page
import LoginPage from "./pages/LoginPage";
import DMSComparison from "./pages/DMSComparison";
import TeamReport from "./pages/TeamReport";
import AuditEntryPage from "./pages/AuditEntryPage";
import AuditFollowUps from "./pages/AuditFollowUps";
import AuditCompletion from "./pages/AuditCompletion";
import AuditFileUploads from "./pages/AuditFileUploads";
import AccountantPage from "./pages/AccountantPage";
import AccountantDashboard from "./pages/AccountantDashboard";
import StockCoordinatorDashboard from "./pages/StockCoordinatorDashboard";
import AuditTypeDashboard from "./pages/AuditTypeDashboard";
import authManager from "./services/authSession";

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: { main: '#004F98' },
    secondary: { main: '#10B981' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
});

const RoleProtectedRoute = ({ children, allowedRoles }: { children: React.ReactElement, allowedRoles: string[] }) => {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    authManager.getCurrentUser().then((user) => setRole(user?.role || ''));
  }, []);

  if (role === null) return null;
  // Stock Coordinators have the same operational permissions as administrators.
  // Keep their distinct role so their dedicated dashboard and identity still work.
  const hasAccess = allowedRoles.includes(role)
    || (role === 'stock_coordinator' && allowedRoles.includes('admin'));

  return !hasAccess
    ? <Navigate to={role === 'accountant' ? '/admin/accountant/dashboard' : role === 'stock_coordinator' ? '/admin/stock-coordinator/dashboard' : role === 'audit_type_manager' ? '/admin/audit-manager/dashboard' : '/admin/teams'} replace />
    : children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager'/*, 'team_assistant'*/]}><AdminDashboard /></RoleProtectedRoute>} />
            <Route path="accountant" element={<RoleProtectedRoute allowedRoles={['accountant']}><Navigate to="/admin/accountant/dashboard" replace /></RoleProtectedRoute>} />
            <Route path="accountant/dashboard" element={<RoleProtectedRoute allowedRoles={['accountant']}><AccountantDashboard /></RoleProtectedRoute>} />
            <Route path="stock-coordinator/dashboard" element={<RoleProtectedRoute allowedRoles={['stock_coordinator']}><StockCoordinatorDashboard /></RoleProtectedRoute>} />
            <Route path="audit-manager/dashboard" element={<RoleProtectedRoute allowedRoles={['audit_type_manager']}><AuditTypeDashboard /></RoleProtectedRoute>} />
            <Route path="audit-manager/teams" element={<RoleProtectedRoute allowedRoles={['audit_type_manager']}><TeamManagement /></RoleProtectedRoute>} />
            <Route path="accountant/calculator" element={<RoleProtectedRoute allowedRoles={['accountant']}><AccountantPage /></RoleProtectedRoute>} />
            <Route path="users" element={<RoleProtectedRoute allowedRoles={['admin']}><UserManagement /></RoleProtectedRoute>} />
            <Route path="teams" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator', 'team_leader', 'site_manager', 'team_member']}><TeamManagement /></RoleProtectedRoute>} />
            <Route path="teams/:teamId" element={<RoleProtectedRoute allowedRoles={['admin', 'audit_type_manager', 'team_leader', 'site_manager', 'team_member']}><TeamManagement /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/dms-comparison" element={<RoleProtectedRoute allowedRoles={['admin', 'audit_type_manager', 'team_leader', 'site_manager']}><DMSComparison /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/report" element={<RoleProtectedRoute allowedRoles={['admin', 'audit_type_manager', 'team_leader', 'site_manager']}><TeamReport /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/before-entry" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><AuditEntryPage auditType="before" /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/after-entry" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><AuditEntryPage auditType="after" /></RoleProtectedRoute>} />
            <Route path="master-desc" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator']}><MasterDescription /></RoleProtectedRoute>} />
            <Route path="reports" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator', 'team_leader']}><ReportSelector /></RoleProtectedRoute>} />
            <Route path="reports/tvs" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><FinalReport /></RoleProtectedRoute>} />
            <Route path="reports/tata" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><TataFinalReport /></RoleProtectedRoute>} />
            <Route path="reports/3w-tvs" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><ThreeWReconciliation /></RoleProtectedRoute>} />
            <Route path="audit-follow-ups" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator']}><AuditFollowUps /></RoleProtectedRoute>} />
            <Route path="audit-completion" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator']}><AuditCompletion /></RoleProtectedRoute>} />
            <Route path="audit-files" element={<RoleProtectedRoute allowedRoles={['admin', 'stock_coordinator']}><AuditFileUploads /></RoleProtectedRoute>} />
          </Route>
          <Route path="/" element={<Navigate to="/admin" />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
