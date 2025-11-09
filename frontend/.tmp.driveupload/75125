// ============================================
// PASSWORD EXPIRY CARD COMPONENT
// Shows password status on profile page
// Developer: Suvadip Panja
// Date: November 09, 2025
// FILE: components/passwordExpiry/PasswordExpiryCard.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, ShieldAlert, CheckCircle, Loader } from 'lucide-react';
import api from '../../services/api';

const PasswordExpiryCard = () => {
  const [expiryStatus, setExpiryStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPasswordExpiryStatus();
  }, []);

  const fetchPasswordExpiryStatus = async () => {
    try {
      const response = await api.get('/password-expiry/status');

      if (response.data.success) {
        setExpiryStatus(response.data.data);
      }

      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch password expiry status:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusConfig = () => {
    if (!expiryStatus) return null;

    if (expiryStatus.expiryDisabled) {
      return {
        icon: <CheckCircle size={24} />,
        iconClass: 'pwd-expiry-icon-success',
        title: 'Password Policy',
        subtitle: 'Password expiry is disabled',
        statusClass: 'pwd-expiry-status-success',
        statusText: 'No Expiry',
        showDetails: false
      };
    }

    if (expiryStatus.expired) {
      return {
        icon: <ShieldAlert size={24} />,
        iconClass: 'pwd-expiry-icon-danger',
        title: 'Password Expired',
        subtitle: 'Your password has expired',
        statusClass: 'pwd-expiry-status-danger',
        statusText: 'Expired',
        showDetails: true,
        urgent: true
      };
    }

    if (expiryStatus.daysRemaining <= 7) {
      return {
        icon: <AlertTriangle size={24} />,
        iconClass: 'pwd-expiry-icon-danger',
        title: 'Password Expiring Soon',
        subtitle: `Expires in ${expiryStatus.daysRemaining} days`,
        statusClass: 'pwd-expiry-status-danger',
        statusText: `${expiryStatus.daysRemaining} days left`,
        showDetails: true,
        urgent: true
      };
    }

    if (expiryStatus.daysRemaining <= 14) {
      return {
        icon: <Clock size={24} />,
        iconClass: 'pwd-expiry-icon-warning',
        title: 'Password Status',
        subtitle: `Expires in ${expiryStatus.daysRemaining} days`,
        statusClass: 'pwd-expiry-status-warning',
        statusText: `${expiryStatus.daysRemaining} days left`,
        showDetails: true,
        urgent: false
      };
    }

    return {
      icon: <CheckCircle size={24} />,
      iconClass: 'pwd-expiry-icon-success',
      title: 'Password Status',
      subtitle: 'Your password is secure',
      statusClass: 'pwd-expiry-status-success',
      statusText: `${expiryStatus.daysRemaining} days left`,
      showDetails: true,
      urgent: false
    };
  };

  if (loading) {
    return (
      <div className="profile-card">
        <h3>Password Status</h3>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Loader className="spinner" size={32} />
        </div>
      </div>
    );
  }

  if (!expiryStatus) {
    return null;
  }

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div className="profile-card">
      <h3>Password Status</h3>
      
      <div className="pwd-expiry-card-content">
        {/* Status Header */}
        <div className="pwd-expiry-header">
          <div className={`pwd-expiry-icon ${config.iconClass}`}>
            {config.icon}
          </div>
          <div className="pwd-expiry-title">
            <h4>{config.title}</h4>
            <p>{config.subtitle}</p>
          </div>
          <div className={`pwd-expiry-badge ${config.statusClass}`}>
            {config.statusText}
          </div>
        </div>

        {/* Password Details */}
        {config.showDetails && !expiryStatus.expiryDisabled && (
          <div className="pwd-expiry-details-grid">
            <div className="pwd-expiry-detail">
              <span className="pwd-expiry-detail-label">Last Changed</span>
              <span className="pwd-expiry-detail-value">
                {formatDate(expiryStatus.passwordLastChanged)}
              </span>
            </div>
            <div className="pwd-expiry-detail">
              <span className="pwd-expiry-detail-label">Expires On</span>
              <span className="pwd-expiry-detail-value">
                {formatDate(expiryStatus.passwordExpiresAt)}
              </span>
            </div>
            <div className="pwd-expiry-detail">
              <span className="pwd-expiry-detail-label">Policy Period</span>
              <span className="pwd-expiry-detail-value">
                {expiryStatus.expiryPolicy} days
              </span>
            </div>
            <div className="pwd-expiry-detail">
              <span className="pwd-expiry-detail-label">Warning Threshold</span>
              <span className="pwd-expiry-detail-value">
                {expiryStatus.warningThreshold} days
              </span>
            </div>
          </div>
        )}

        {/* Change Password Button */}
        {!expiryStatus.expiryDisabled && (
          <button
            className={`pwd-expiry-change-btn ${config.urgent ? 'pwd-expiry-btn-urgent' : ''}`}
            onClick={() => navigate('/profile/change-password')}
          >
            Change Password {config.urgent && 'Now'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PasswordExpiryCard;