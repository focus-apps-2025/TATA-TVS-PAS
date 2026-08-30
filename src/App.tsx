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
  return !allowedRoles.includes(role) ? <Navigate to="/admin/teams" replace /> : children;
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager'/*, 'team_assistant'*/]}><AdminDashboard /></RoleProtectedRoute>} />
            <Route path="users" element={<RoleProtectedRoute allowedRoles={['admin']}><UserManagement /></RoleProtectedRoute>} />
            <Route path="teams" element={<TeamManagement />} />
            <Route path="teams/:teamId" element={<TeamManagement />} />
            <Route path="teams/:teamId/dms-comparison" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><DMSComparison /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/report" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><TeamReport /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/before-entry" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><AuditEntryPage auditType="before" /></RoleProtectedRoute>} />
            <Route path="teams/:teamId/after-entry" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader', 'site_manager']}><AuditEntryPage auditType="after" /></RoleProtectedRoute>} />
            <Route path="master-desc" element={<RoleProtectedRoute allowedRoles={['admin']}><MasterDescription /></RoleProtectedRoute>} />
            <Route path="reports" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><ReportSelector /></RoleProtectedRoute>} />
            <Route path="reports/tvs" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><FinalReport /></RoleProtectedRoute>} />
            <Route path="reports/tata" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><TataFinalReport /></RoleProtectedRoute>} />
            <Route path="reports/3w-tvs" element={<RoleProtectedRoute allowedRoles={['admin', 'team_leader']}><ThreeWReconciliation /></RoleProtectedRoute>} />
          </Route>
          <Route path="/" element={<Navigate to="/admin" />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
