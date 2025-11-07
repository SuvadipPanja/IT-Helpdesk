// ============================================
// PASSWORD STRENGTH METER COMPONENT
// Displays real-time password strength and requirements
// ============================================
// Developer: Suvadip Panja
// Created: November 06, 2025
// File: frontend/src/components/security/PasswordStrengthMeter.jsx
// ============================================
// SECURITY FEATURES:
// - Real-time strength calculation
// - Policy validation
// - Visual feedback
// - Accessibility compliant
// ============================================

import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Shield, 
  AlertTriangle,
  CheckCircle 
} from 'lucide-react';

/**
 * Password Strength Meter Component
 * Validates password against security policy and shows strength
 * 
 * @param {Object} props
 * @param {string} props.password - Password to validate
 * @param {Function} props.onStrengthChange - Callback when strength changes
 * @param {Object} props.requirements - Password policy requirements (optional)
 */
const PasswordStrengthMeter = ({ 
  password = '', 
  onStrengthChange,
  requirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumber: true,
    requireSpecial: true,
  }
}) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [strength, setStrength] = useState({
    score: 0,        // 0-4 (0=very weak, 4=very strong)
    percentage: 0,   // 0-100 for progress bar
    label: 'None',   // Weak/Medium/Strong/Very Strong
    color: 'gray',   // Color indicator
    isValid: false,  // Meets all requirements
  });

  const [checks, setChecks] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  // ============================================
  // PASSWORD VALIDATION LOGIC
  // ============================================
  
  /**
   * Calculate password strength based on multiple criteria
   * Uses industry-standard strength calculation algorithm
   * 
   * @param {string} pwd - Password to evaluate
   * @returns {Object} Strength metrics
   */
  const calculateStrength = (pwd) => {
    // Empty password check
    if (!pwd || pwd.length === 0) {
      return {
        score: 0,
        percentage: 0,
        label: 'None',
        color: 'gray',
        isValid: false,
      };
    }

    // Initialize score
    let score = 0;
    let percentage = 0;

    // Check 1: Length (most important)
    if (pwd.length >= requirements.minLength) {
      score += 1;
      percentage += 20;
    }
    if (pwd.length >= 12) {
      score += 0.5;
      percentage += 10;
    }

    // Check 2: Uppercase letters
    if (requirements.requireUppercase && /[A-Z]/.test(pwd)) {
      score += 1;
      percentage += 20;
    }

    // Check 3: Lowercase letters
    if (requirements.requireLowercase && /[a-z]/.test(pwd)) {
      score += 1;
      percentage += 20;
    }

    // Check 4: Numbers
    if (requirements.requireNumber && /[0-9]/.test(pwd)) {
      score += 1;
      percentage += 20;
    }

    // Check 5: Special characters
    if (requirements.requireSpecial && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) {
      score += 1;
      percentage += 20;
    }

    // Bonus: Extra length (15+ characters)
    if (pwd.length >= 15) {
      score += 0.5;
      percentage = Math.min(100, percentage + 10);
    }

    // Determine strength label and color
    let label = 'Weak';
    let color = 'red';

    if (score < 2) {
      label = 'Very Weak';
      color = 'red';
    } else if (score < 3) {
      label = 'Weak';
      color = 'orange';
    } else if (score < 4) {
      label = 'Medium';
      color = 'yellow';
    } else if (score < 5) {
      label = 'Strong';
      color = 'green';
    } else {
      label = 'Very Strong';
      color = 'green';
    }

    // Check if all requirements are met
    const isValid = checkAllRequirements(pwd);

    return {
      score: Math.min(5, score),
      percentage: Math.min(100, percentage),
      label,
      color,
      isValid,
    };
  };

  /**
   * Check if password meets all policy requirements
   * 
   * @param {string} pwd - Password to check
   * @returns {boolean} True if all requirements met
   */
  const checkAllRequirements = (pwd) => {
    const lengthCheck = pwd.length >= requirements.minLength;
    const uppercaseCheck = !requirements.requireUppercase || /[A-Z]/.test(pwd);
    const lowercaseCheck = !requirements.requireLowercase || /[a-z]/.test(pwd);
    const numberCheck = !requirements.requireNumber || /[0-9]/.test(pwd);
    const specialCheck = !requirements.requireSpecial || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd);

    return lengthCheck && uppercaseCheck && lowercaseCheck && numberCheck && specialCheck;
  };

  /**
   * Update individual requirement checks
   * 
   * @param {string} pwd - Password to check
   */
  const updateChecks = (pwd) => {
    setChecks({
      length: pwd.length >= requirements.minLength,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    });
  };

  // ============================================
  // EFFECTS
  // ============================================

  /**
   * Recalculate strength whenever password changes
   * Debounced for performance
   */
  useEffect(() => {
    const newStrength = calculateStrength(password);
    setStrength(newStrength);
    updateChecks(password);

    // Notify parent component of strength change
    if (onStrengthChange) {
      onStrengthChange(newStrength);
    }
  }, [password, requirements]);

  // ============================================
  // RENDER HELPERS
  // ============================================

  /**
   * Get color classes for progress bar
   * 
   * @returns {string} Tailwind color classes
   */
  const getColorClasses = () => {
    switch (strength.color) {
      case 'red':
        return 'bg-red-500';
      case 'orange':
        return 'bg-orange-500';
      case 'yellow':
        return 'bg-yellow-500';
      case 'green':
        return 'bg-green-500';
      default:
        return 'bg-gray-300';
    }
  };

  /**
   * Get text color classes for strength label
   * 
   * @returns {string} Tailwind text color classes
   */
  const getTextColorClasses = () => {
    switch (strength.color) {
      case 'red':
        return 'text-red-600 dark:text-red-400';
      case 'orange':
        return 'text-orange-600 dark:text-orange-400';
      case 'yellow':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'green':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  /**
   * Get icon for strength level
   * 
   * @returns {JSX.Element} Icon component
   */
  const getStrengthIcon = () => {
    if (strength.isValid) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (strength.score >= 3) {
      return <Shield className="w-5 h-5 text-yellow-500" />;
    } else {
      return <AlertTriangle className="w-5 h-5 text-red-500" />;
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-4">
      {/* Strength Indicator */}
      {password && (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStrengthIcon()}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Password Strength:
              </span>
              <span className={`text-sm font-semibold ${getTextColorClasses()}`}>
                {strength.label}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {strength.percentage}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ease-in-out ${getColorClasses()}`}
              style={{ width: `${strength.percentage}%` }}
              role="progressbar"
              aria-valuenow={strength.percentage}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label="Password strength indicator"
            />
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Password Requirements:
        </h4>
        
        <div className="space-y-1">
          {/* Length requirement */}
          <RequirementItem
            met={checks.length}
            label={`At least ${requirements.minLength} characters`}
          />

          {/* Uppercase requirement */}
          {requirements.requireUppercase && (
            <RequirementItem
              met={checks.uppercase}
              label="Contains uppercase letter (A-Z)"
            />
          )}

          {/* Lowercase requirement */}
          {requirements.requireLowercase && (
            <RequirementItem
              met={checks.lowercase}
              label="Contains lowercase letter (a-z)"
            />
          )}

          {/* Number requirement */}
          {requirements.requireNumber && (
            <RequirementItem
              met={checks.number}
              label="Contains number (0-9)"
            />
          )}

          {/* Special character requirement */}
          {requirements.requireSpecial && (
            <RequirementItem
              met={checks.special}
              label="Contains special character (!@#$%^&*)"
            />
          )}
        </div>
      </div>

      {/* Additional Security Tips */}
      {password && !strength.isValid && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-700 dark:text-yellow-300">
              <p className="font-medium mb-1">Security Tips:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Use a unique password you don't use elsewhere</li>
                <li>Avoid common words, names, or dates</li>
                <li>Mix uppercase, lowercase, numbers, and symbols</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Success Message */}
      {strength.isValid && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              Your password meets all security requirements!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Individual Requirement Item Component
 * Shows check or X icon with requirement text
 * 
 * @param {Object} props
 * @param {boolean} props.met - Whether requirement is met
 * @param {string} props.label - Requirement description
 */
const RequirementItem = ({ met, label }) => {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="w-4 h-4 text-green-500 flex-shrink-0" aria-label="Requirement met" />
      ) : (
        <X className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" aria-label="Requirement not met" />
      )}
      <span className={`text-sm ${met ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
};

// ============================================
// EXPORTS
// ============================================

export default PasswordStrengthMeter;

