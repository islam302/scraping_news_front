import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import MissionDetail from './pages/MissionDetail';
import Sites from './pages/Sites';
import Login from './pages/Login';

function ProtectedLayout() {
  const { authed } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  if (!authed) return <Navigate to="/login" replace />;

  // Close sidebar on route change (mobile)
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-dark-bg">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile overlay sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeSidebar} />
          <div className="relative z-10 h-full">
            <Sidebar onNavigate={closeSidebar} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with hamburger */}
        <div className="lg:hidden">
          <MobileHeader onMenuClick={() => setSidebarOpen(true)} />
        </div>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/tasks/:missionId" element={<MissionDetail />} />
          <Route path="/sites" element={<Sites />} />
        </Routes>
      </div>
    </div>
  );
}

function LoginGuard() {
  const { authed } = useAuth();
  if (authed) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginGuard />} />
                <Route path="/*" element={<ProtectedLayout />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
