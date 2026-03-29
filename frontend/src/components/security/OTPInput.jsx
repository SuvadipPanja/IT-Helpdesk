// ============================================
// OTP INPUT COMPONENT
// Reusable 6-digit OTP input with auto-focus
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE: frontend/src/components/security/OTPInput.jsx
// ============================================

import React, { useRef, useEffect } from 'react';

const OTPInput = ({ 
  length = 6, 
  value, 
  onChange, 
  disabled = false, 
  autoFocus = false 
}) => {
  const inputRefs = useRef([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  // Handle input change
  const handleChange = (index, e) => {
    const val = e.target.value;
    
    // Only allow digits
    if (val && !/^\d$/.test(val)) {
      return;
    }

    // Update value at index
    const newValue = value.split('');
    newValue[index] = val;
    onChange(newValue.join(''));

    // Auto-focus next input if value entered
    if (val && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle key down (backspace, arrows)
  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace') {
      if (!value[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1].focus();
      } else {
        // Clear current input
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      }
    }
    
    // Handle left arrow
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    
    // Handle right arrow
    if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    
    // Only allow digits
    if (!/^\d+$/.test(pastedData)) {
      return;
    }

    onChange(pastedData);

    // Focus the next empty input or last input
    const nextIndex = Math.min(pastedData.length, length - 1);
    inputRefs.current[nextIndex].focus();
  };

  // Handle focus - select all text
  const handleFocus = (index) => {
    inputRefs.current[index].select();
  };

  return (
    <div className="otp-input-container">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(ref) => (inputRefs.current[index] = ref)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ''}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className="otp-input"
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default OTPInput;