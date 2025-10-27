// ============================================
// MAIN APP COMPONENT
// Root component with all providers and routes
// UPDATED: Loads settings on app start + Email Queue + Email Templates routes
// ============================================

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/notifications/NotificationContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import Dashboard from './pages/dashboard/Dashboard';
import TicketsList from './pages/tickets/TicketsList';
import CreateTicket from './pages/tickets/CreateTicket';
import NotFound from './pages/NotFound';
import TicketDetail from './pages/tickets/TicketDetail';
import EditTicket from './pages/tickets/EditTicket';
import MyTickets from './pages/tickets/MyTickets';
import UsersList from './pages/users/UsersList';
import DepartmentsList from './pages/departments/DepartmentsList';
import RolesList from './pages/roles/RolesList';
import Analytics from './pages/analytics/Analytics';
import AllNotifications from './pages/notifications/AllNotifications';
import Profile from './pages/profile/Profile';
import ChangePassword from './pages/profile/ChangePassword';
import Settings from './pages/settings/Settings';
import EmailQueue from './pages/email/EmailQueue';
import EmailTemplates from './pages/email/EmailTemplates'; // ← NEW
import settingsLoader from './utils/settingsLoader';
import { Shield } from 'lucide-react';

// ============================================
// MAIN APP FUNCTION
// ============================================
function App() {
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ============================================
  // LOAD SETTINGS ON APP START - ONCE
  // ============================================
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        console.log('🚀 App starting - Loading settings...');
        await settingsLoader.loadSettings();
        console.log('✅ Settings loaded successfully');
        setSettingsLoaded(true);
      } catch (error) {
        console.error('❌ Failed to load settings:', error);
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
    // 1. AuthProvider (authentication state)
    // 2. NotificationProvider (notification state with polling)
    // 3. BrowserRouter (routing)
    // Settings loaded BEFORE providers, available globally
    // ============================================
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            {/* ============================================
                PUBLIC ROUTES
                Accessible without authentication
                ============================================ */}
            <Route path="/login" element={<Login />} />

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
                    <Analytics />
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
                Coming Soon
                ============================================ */}
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <Layout>
                    <div className="dashboard-content">
                      <h1>Help Center</h1>
                      <p>Coming soon...</p>
                    </div>
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
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

// ============================================
// EXPORT APP
// ============================================
export default App;