import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * Default password policy used as a fallback when the API call fails
 * or returns invalid/missing data.
 */
const DEFAULT_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  historyCount: 5,
};

const usePasswordPolicy = () => {
  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  });

  useEffect(() => {
    const fetchPasswordPolicy = async () => {
      try {
        setLoadingPolicy(true);
        const response = await api.get('/security/settings');

        if (response.data.success && response.data.data) {
          const settings = response.data.data;

          const policy = {
            minLength: parseInt(settings.password_min_length) || 8,
            requireUppercase: settings.password_require_uppercase === 'true' || settings.password_require_uppercase === true,
            requireLowercase: settings.password_require_lowercase === 'true' || settings.password_require_lowercase === true,
            requireNumber: settings.password_require_number === 'true' || settings.password_require_number === true,
            requireSpecial: settings.password_require_special === 'true' || settings.password_require_special === true,
            historyCount: parseInt(settings.password_history_count) || 5,
          };

          setPasswordPolicy(policy);
        }
      } catch (err) {
        console.error('❌ Error fetching password policy:', err);
        setPasswordPolicy(DEFAULT_POLICY);
      } finally {
        setLoadingPolicy(false);
      }
    };

    fetchPasswordPolicy();
  }, []);

  const checkPasswordStrength = (password) => {
    if (!passwordPolicy) return { score: 0, feedback: [] };

    let score = 0;
    const feedback = [];

    if (password.length >= passwordPolicy.minLength) {
      score++;
      feedback.push(`✓ At least ${passwordPolicy.minLength} characters`);
    } else {
      feedback.push(`✗ Needs at least ${passwordPolicy.minLength} characters`);
    }

    if (passwordPolicy.requireUppercase && passwordPolicy.requireLowercase) {
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        score++;
        feedback.push('✓ Contains uppercase and lowercase');
      } else {
        feedback.push('✗ Needs uppercase and lowercase letters');
      }
    }

    if (passwordPolicy.requireNumber) {
      if (/\d/.test(password)) {
        score++;
        feedback.push('✓ Contains numbers');
      } else {
        feedback.push('✗ Needs numbers');
      }
    }

    if (passwordPolicy.requireSpecial) {
      if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        score++;
        feedback.push('✓ Contains special characters');
      } else {
        feedback.push('✗ Needs special characters');
      }
    }

    return { score, feedback };
  };

  const getStrengthColor = () => {
    const { score } = passwordStrength;
    if (score === 0) return '#e5e7eb';
    if (score === 1) return '#ef4444';
    if (score === 2) return '#f59e0b';
    if (score === 3) return '#3b82f6';
    return '#22c55e';
  };

  const getStrengthLabel = () => {
    const { score } = passwordStrength;
    if (score === 0) return '';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    return 'Strong';
  };

  return {
    passwordPolicy,
    loadingPolicy,
    passwordStrength,
    setPasswordStrength,
    checkPasswordStrength,
    getStrengthColor,
    getStrengthLabel,
  };
};

export default usePasswordPolicy;
