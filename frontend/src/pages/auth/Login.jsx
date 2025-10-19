import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const systemName = getSetting('system_name', 'Nexus Support');
  const systemTitle = getSetting('system_title', 'IT Service Desk');
  const companyName = getSetting('company_name', 'Your Company');
  const maintenanceModeValue = getSetting('maintenance_mode', 'false');
  const maintenanceMode = maintenanceModeValue === 'true' || maintenanceModeValue === true || maintenanceModeValue === 1;
  const maintenanceMessage = getSetting('maintenance_message', 'System is under maintenance. Please check back later.');

  console.log('🔧 Maintenance Check:', { raw: maintenanceModeValue, parsed: maintenanceMode });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (error && !maintenanceMode) {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (maintenanceMode) {
      setError(maintenanceMessage);
      return;
    }
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Please enter both username and password');
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const response = await login(formData.username, formData.password);
      
      if (response && response.success) {
        navigate('/dashboard');
      } else {
        setError(response?.message || 'Invalid username or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      
      if (err.response) {
        setError(err.response.data?.message || 'Invalid username or password');
      } else if (err.request) {
        setError('Cannot connect to server. Please try again.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = formData.username.trim() !== '' && formData.password.trim() !== '';

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">
            <Shield size={32} />
          </div>
          <h1 className="login-title">{systemName}</h1>
          <p className="login-subtitle">{systemTitle}</p>
        </div>

        {maintenanceMode && (
          <div className="maintenance-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Maintenance Mode</strong>
              <p>System login is currently disabled</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {error && (
            <div className={`error-message ${maintenanceMode ? 'maintenance-error' : ''}`}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoComplete="username"
                disabled={loading || maintenanceMode}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading || maintenanceMode}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isFormValid && !loading && !maintenanceMode) {
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading || maintenanceMode}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={!isFormValid || loading || maintenanceMode}
          >
            {loading ? (
              <>
                <span>Signing in</span>
                <span className="loading-dots">...</span>
              </>
            ) : maintenanceMode ? (
              'LOGIN DISABLED'
            ) : (
              'SIGN IN'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>© 2025 {companyName}. All Rights Reserved</p>
          <p>Developed by <strong>Suvadip</strong></p>
        </div>
      </div>
    </div>
  );
};

export default Login;