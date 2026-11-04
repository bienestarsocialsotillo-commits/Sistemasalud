import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { AppLayout } from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import WorkerList from './components/WorkerList';

import Medications from './components/Medications';
import HistoryList from './components/HistoryList';
import EvaluationList from './components/EvaluationList';
import UnifiedAnalytics from './components/UnifiedAnalytics';
import UserManagement from './components/UserManagement';
import WhatsAppBroadcast from './components/WhatsAppBroadcast';
import ChronicAlertsModule from './components/ChronicAlertsModule';

function AppContent() {
  const { user, loading, isAdmin, isEditor } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DataProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to="/workers" replace />} />
          <Route path="/workers" element={<WorkerList />} />
          <Route path="/history" element={<HistoryList />} />
          <Route path="/evaluations" element={<EvaluationList />} />
          <Route path="/medications" element={isEditor ? <Medications /> : <Navigate to="/workers" replace />} />
          <Route path="/chronic-alerts" element={isEditor ? <ChronicAlertsModule /> : <Navigate to="/workers" replace />} />
          <Route path="/whatsapp-broadcast" element={isEditor ? <WhatsAppBroadcast /> : <Navigate to="/workers" replace />} />
          {isAdmin && (
            <>
              <Route path="/stats" element={<UnifiedAnalytics defaultTab="metrics" />} />
              <Route path="/territories" element={<UnifiedAnalytics defaultTab="territories" />} />
              <Route path="/users" element={<UserManagement />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/workers" replace />} />
        </Routes>
      </AppLayout>
    </DataProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
