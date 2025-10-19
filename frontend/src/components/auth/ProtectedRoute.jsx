import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user, loading } = useAuth();

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

  if (requiredPermission && !user.permissions[requiredPermission]) {
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

  return children;
};

export default ProtectedRoute;