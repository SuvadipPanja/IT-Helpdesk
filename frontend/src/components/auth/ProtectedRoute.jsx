import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, requiredPermission, requiredAnyPermission }) => {
  const { user, loading, passwordExpired } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // ============================================
  // SECURITY: Force password change when expired
  // Only allow access to /profile/change-password
  // All other routes are blocked
  // ============================================
  if (passwordExpired && location.pathname !== '/profile/change-password') {
    return <Navigate to="/profile/change-password" replace />;
  }

  // P1 #50 FIX: Guard against undefined permissions (e.g. during hydration)
  if (requiredPermission || requiredAnyPermission) {
    if (!user.permissions) {
      // Permissions not loaded yet — show loading instead of "Access Denied"
      return (
        <div className="loading-container">
          <div className="spinner"></div>
        </div>
      );
    }
    const allowed = requiredAnyPermission
      ? requiredAnyPermission.some(p => user.permissions[p])
      : Boolean(user.permissions[requiredPermission]);
    if (!allowed) {
      return (
        <div className="loading-container">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '48px', color: '#e74c3c', marginBottom: '16px' }}>
              Access Denied
            </h1>
            <p style={{ color: '#666' }}>
              You don't have permission to view this page.
            </p>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;