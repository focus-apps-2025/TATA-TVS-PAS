// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/AdminDashboard";
import UserManagement from "./pages/UserManagement";
import TeamManagement from "./pages/TeamManagement";
import MasterDescription from "./pages/MasterDescription";
import FinalReport from "./pages/FinalReport"; 
import TataFinalReport from "./pages/TataFinalReport"; 
import ReportSelector from "./pages/ReportSelector"; // Selection page
import LoginPage from "./pages/LoginPage";

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

function App() {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="teams" element={<TeamManagement />} />
            <Route path="teams/:teamId" element={<TeamManagement />} />
            <Route path="master-desc" element={<MasterDescription />} />
            <Route path="reports" element={<ReportSelector />} /> {/* New selection page */}
            <Route path="reports/tvs" element={<FinalReport />} /> {/* TVS report */}
            <Route path="reports/tata" element={<TataFinalReport />} /> {/* TATA report */}
          </Route>
          <Route path="/" element={<Navigate to="/admin" />} />
          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;