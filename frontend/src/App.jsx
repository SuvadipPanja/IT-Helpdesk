// ============================================
// MAIN APP COMPONENT
// Root component with all providers and routes
// UPDATED: Loads settings on app start + Email Queue + Email Templates routes + Security (2FA) route + Password Reset routes + Help Center
// ============================================

import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/notifications/NotificationContext';
import { ToastProvider } from './context/ToastContext'; // ⭐ NEW - Toast Notifications
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import ErrorBoundary from './components/layout/ErrorBoundary';
import settingsLoader from './utils/settingsLoader';
import { Shield } from 'lucide-react';

// ============================================
// P1 #48 FIX: LAZY-LOADED ROUTE COMPONENTS
// Reduces initial bundle size by code-splitting
// ============================================
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const TicketsList = lazy(() => import('./pages/tickets/TicketsList'));
const CreateTicket = lazy(() => import('./pages/tickets/CreateTicket'));
const TicketDetail = lazy(() => import('./pages/tickets/TicketDetail'));
const EditTicket = lazy(() => import('./pages/tickets/EditTicket'));
const MyTickets = lazy(() => import('./pages/tickets/MyTickets'));
const UsersList = lazy(() => import('./pages/users/UsersList'));
const DepartmentsList = lazy(() => import('./pages/departments/DepartmentsList'));
const RolesList = lazy(() => import('./pages/roles/RolesList'));
const AnalyticsEnhanced = lazy(() => import('./pages/analytics/AnalyticsEnhanced'));
const AllNotifications = lazy(() => import('./pages/notifications/AllNotifications'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const ChangePassword = lazy(() => import('./pages/profile/ChangePassword'));
const Settings = lazy(() => import('./pages/settings/Settings'));
const EmailQueue = lazy(() => import('./pages/email/EmailQueue'));
const EmailTemplates = lazy(() => import('./pages/email/EmailTemplates'));
const SecuritySettings = lazy(() => import('./pages/security/SecuritySettings'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const NotFound = lazy(() => import('./pages/NotFound'));

// ============================================
// MAIN APP FUNCTION
// ============================================
function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ============================================
  // SUPPRESS REACT ROUTER WARNINGS FOR NOW
  // These are for v7 compatibility, can be addressed in future upgrades
  // ============================================
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // By having the future flags in BrowserRouter, this is already handled
      // The warnings should now resolve
    }
  }, []);

  // ============================================
  // LOAD SETTINGS ON APP START - ONCE
  // ============================================
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        if (process.env.NODE_ENV === 'development') console.log('🚀 App starting - Loading settings...');
        await settingsLoader.loadSettings();
        if (process.env.NODE_ENV === 'development') console.log('✅ Settings loaded successfully');
        setSettingsLoaded(true);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') console.error('❌ Failed to load settings:', error);
        // Continue anyway with default settings
        setSettingsLoaded(true);
      }
    };

    loadAppSettings();
  }, []); // Empty array = run once on mount

  // ============================================
  // SHOW LOADING SCREEN WHILE SETTINGS LOAD
  // ============================================
  if (!settingsLoaded) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0f172a',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <Shield 
          size={64} 
          style={{ 
            marginBottom: '20px', 
            color: '#6366f1',
            animation: 'pulse 2s ease-in-out infinite'
          }} 
        />
        <h2 style={{ 
          margin: '0 0 10px 0',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Loading Application...
        </h2>
        <p style={{ 
          margin: 0, 
          color: '#94a3b8',
          fontSize: '14px'
        }}>
          Please wait while we prepare everything
        </p>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  // ============================================
  // MAIN APP RENDER
  // ============================================
  return (
    // ============================================
    // PROVIDER HIERARCHY:
    // 1. ToastProvider (toast notifications - outermost)
    // 2. AuthProvider (authentication state)
    // 3. NotificationProvider (notification state with polling)
    // 4. BrowserRouter (routing)
    // Settings loaded BEFORE providers, available globally
    // ============================================
    <ErrorBoundary>
    <ToastProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplitPath: true }}>
            <Suspense fallback={
              <div className="loading-container">
                <div className="spinner"></div>
              </div>
            }>
            <Routes>
            {/* ============================================
                PUBLIC ROUTES
                Accessible without authentication
                ============================================ */}
            <Route path="/login" element={<Login />} />
            
            {/* ⭐ NEW: Password Reset Routes */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ============================================
                PROTECTED ROUTES - DASHBOARD
                ============================================ */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - TICKETS MANAGEMENT
                ============================================ */}
            
            {/* All Tickets List */}
            <Route
              path="/tickets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TicketsList />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Create New Ticket */}
            <Route
              path="/tickets/create"
              element={
                <ProtectedRoute>
                  <Layout>
                    <CreateTicket />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* View Ticket Detail */}
            <Route
              path="/tickets/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TicketDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Edit Ticket */}
            <Route
              path="/tickets/edit/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <EditTicket />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* My Tickets (User's Own Tickets) */}
            <Route
              path="/my-tickets"
              element={
                <ProtectedRoute>
                  <Layout>
                    <MyTickets />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - USER MANAGEMENT
                Requires: can_manage_users permission
                ============================================ */}
            <Route
              path="/users"
              element={
                <ProtectedRoute requiredPermission="can_manage_users">
                  <Layout>
                    <UsersList />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - DEPARTMENT MANAGEMENT
                Requires: can_manage_departments permission
                ============================================ */}
            <Route
              path="/departments"
              element={
                <ProtectedRoute requiredPermission="can_manage_departments">
                  <Layout>
                    <DepartmentsList />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - ROLE MANAGEMENT
                Requires: can_manage_roles permission
                ============================================ */}
            <Route
              path="/roles"
              element={
                <ProtectedRoute requiredPermission="can_manage_roles">
                  <Layout>
                    <RolesList />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - ANALYTICS
                Requires: can_view_analytics permission
                ============================================ */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute requiredPermission="can_view_analytics">
                  <Layout>
                    <AnalyticsEnhanced />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - NOTIFICATIONS
                Accessible to all authenticated users
                ============================================ */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Layout>
                    <AllNotifications />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - USER PROFILE
                Accessible to all authenticated users
                ============================================ */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Profile />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Change Password */}
            <Route
              path="/profile/change-password"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ChangePassword />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - SYSTEM SETTINGS
                Requires: can_manage_system permission
                ============================================ */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredPermission="can_manage_system">
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - SECURITY SETTINGS (2FA)
                Accessible to all authenticated users
                ⭐ NEW ROUTE - Two-Factor Authentication Management
                ============================================ */}
            <Route
              path="/security"
              element={
                <ProtectedRoute>
                  <Layout>
                    <SecuritySettings />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - EMAIL QUEUE
                Requires: can_manage_system permission
                ============================================ */}
            <Route
              path="/email-queue"
              element={
                <ProtectedRoute requiredPermission="can_manage_system">
                  <Layout>
                    <EmailQueue />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - EMAIL TEMPLATES
                Requires: can_manage_system permission
                ============================================ */}
            <Route
              path="/email-templates"
              element={
                <ProtectedRoute requiredPermission="can_manage_system">
                  <Layout>
                    <EmailTemplates />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                PROTECTED ROUTES - HELP CENTER
                Accessible to all authenticated users
                ⭐ UPDATED - Interactive Help Center with Smart Search
                ============================================ */}
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <Layout>
                    <HelpCenter />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* ============================================
                REDIRECTS & 404
                ============================================ */}
            
            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404 - Not Found */}
            <Route path="*" element={<NotFound />} />
          </Routes>
            </Suspense>
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  </ToastProvider>
  </ErrorBoundary>
  );
}

// ============================================
// EXPORT APP
// ============================================
export default App;