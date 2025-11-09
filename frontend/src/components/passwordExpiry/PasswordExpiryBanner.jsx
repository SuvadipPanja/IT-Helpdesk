// ============================================
// PASSWORD EXPIRY BANNER COMPONENT
// Shows warning banner when password is expiring
// Developer: Suvadip Panja
// Date: November 09, 2025
// FILE: components/passwordExpiry/PasswordExpiryBanner.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Clock, ShieldAlert } from 'lucide-react';
import api from '../../services/api';
import '../../styles/PasswordExpiry.css';

const PasswordExpiryBanner = () => {
  const [expiryStatus, setExpiryStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPasswordExpiryStatus();
  }, []);

  const fetchPasswordExpiryStatus = async () => {
    try {
      const response = await api.get('/password-expiry/status');

      if (response.data.success) {
        const status = response.data.data;
        
        if (status.expiryDisabled) {
          setIsLoading(false);
          return;
        }

        if (status.expired || status.isWarning) {
          setExpiryStatus(status);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch password expiry status:', error);
      setIsLoading(false);
    }
  };

  const handleChangePassword = () => {
    navigate('/profile/change-password');
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (isLoading || !expiryStatus || !isVisible) {
    return null;
  }

  const getBannerConfig = () => {
    if (expiryStatus.expired) {
      return {
        className: 'password-expiry-banner expired',
        icon: <ShieldAlert size={20} />,
        title: 'Password Expired',
        message: 'Your password has expired. Please change it immediately to continue using the system.',
        buttonText: 'Change Password Now',
        showDismiss: false,
        urgent: true
      };
    } else if (expiryStatus.daysRemaining <= 3) {
      return {
        className: 'password-expiry-banner critical',
        icon: <AlertTriangle size={20} />,
        title: 'Urgent: Password Expiring Soon',
        message: `Your password will expire in ${expiryStatus.daysRemaining} day${expiryStatus.daysRemaining !== 1 ? 's' : ''}. Change it now to avoid disruption.`,
        buttonText: 'Change Password',
        showDismiss: false,
        urgent: true
      };
    } else if (expiryStatus.daysRemaining <= 7) {
      return {
        className: 'password-expiry-banner warning',
        icon: <Clock size={20} />,
        title: 'Password Expiring Soon',
        message: `Your password will expire in ${expiryStatus.daysRemaining} days. Please change it at your earliest convenience.`,
        buttonText: 'Change Password',
        showDismiss: true,
        urgent: false
      };
    } else {
      return {
        className: 'password-expiry-banner info',
        icon: <Clock size={20} />,
        title: 'Password Expiry Reminder',
        message: `Your password will expire in ${expiryStatus.daysRemaining} days. Consider changing it soon.`,
        buttonText: 'Change Password',
        showDismiss: true,
        urgent: false
      };
    }
  };

  const config = getBannerConfig();

  return (
    <div className={config.className}>
      <div className="password-expiry-banner-content">
        <div className="banner-icon">
          {config.icon}
        </div>
        
        <div className="banner-text">
          <h4>{config.title}</h4>
          <p>{config.message}</p>
        </div>

        <div className="banner-actions">
          <button
            onClick={handleChangePassword}
            className="banner-btn banner-btn-primary"
          >
            {config.buttonText}
          </button>

          {config.showDismiss && (
            <button
              onClick={handleDismiss}
              className="banner-btn-close"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordExpiryBanner;