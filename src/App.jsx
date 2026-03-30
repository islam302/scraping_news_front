import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import MissionDetail from './pages/MissionDetail';
import Sites from './pages/Sites';
import Login from './pages/Login';

function ProtectedLayout() {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen bg-dark-bg">
      <Sidebar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:missionId" element={<MissionDetail />} />
        <Route path="/sites" element={<Sites />} />
      </Routes>
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
