import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/auth';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProctorsPage from './pages/ProctorsPage';
import InterviewSelectsPage from './pages/InterviewSelectsPage';
import OnboardingPage from './pages/OnboardingPage';
import OffboardedPage from './pages/OffboardedPage';
import AddProctorPage from './pages/AddProctorPage';
import EvaluationsPage from './pages/EvaluationsPage';
import CertificationsPage from './pages/CertificationsPage';
import CustomersPage from './pages/CustomersPage';
import VendorsPage from './pages/VendorsPage';
import AuditLogPage from './pages/AuditLogPage';
import WorkspacePage from './pages/WorkspacePage';
import IncompletePage from './pages/IncompletePage';
import OnboardingFormPage from './pages/OnboardingFormPage';

// Layout
import MainLayout from './components/layout/MainLayout';

const FormLinksPage = () => (
  <div className="bg-surface border border-border rounded-lg p-8 text-center">
    <div className="text-4xl mb-3">🔗</div>
    <h3 className="text-lg font-semibold text-text mb-1">Form Links</h3>
    <p className="text-text3 text-sm">Public form links for proctor onboarding will appear here.</p>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          {/* Public route - no authentication required */}
          <Route path="/onboarding-form" element={<OnboardingFormPage />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="proctors" element={<ProctorsPage />} />
            <Route path="interview-selects" element={<InterviewSelectsPage />} />
            <Route path="onboarding" element={<OnboardingPage />} />
            <Route path="active" element={<Navigate to="/proctors" replace />} />
            <Route path="offboarded" element={<OffboardedPage />} />
            <Route path="add-proctor" element={<AddProctorPage />} />
            <Route path="evaluations" element={<EvaluationsPage />} />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="incomplete" element={<IncompletePage />} />
            <Route path="my-proctors" element={<ProctorsPage />} />
            <Route path="certifications" element={<CertificationsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="vendors" element={<VendorsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="form-links" element={<FormLinksPage />} />
            <Route path="*" element={
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="text-5xl mb-3">404</div>
                  <h3 className="text-lg font-semibold text-text mb-1">Page not found</h3>
                  <p className="text-text3 text-sm">The page you are looking for does not exist.</p>
                </div>
              </div>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
