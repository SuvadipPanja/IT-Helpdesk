// ============================================
// TEMPLATE VARIABLES COMPONENT
// Helper component to insert template variables
// FILE: frontend/src/components/email/TemplateVariables.jsx
// ============================================

import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const TemplateVariables = ({ onInsert }) => {
  const [copiedVariable, setCopiedVariable] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(['ticket']);

  // All available template variables organized by category
  const variableCategories = {
    ticket: {
      label: 'Ticket Variables',
      color: '#3b82f6',
      variables: [
        { key: 'ticket_id', label: 'Ticket ID', example: '123' },
        { key: 'ticket_number', label: 'Ticket Number', example: 'TKT-2025-001' },
        { key: 'ticket_title', label: 'Ticket Title', example: 'Cannot access email' },
        { key: 'ticket_description', label: 'Description', example: 'I cannot log into my email...' },
        { key: 'ticket_priority', label: 'Priority', example: 'High' },
        { key: 'ticket_status', label: 'Status', example: 'Open' },
        { key: 'ticket_category', label: 'Category', example: 'Email Issues' },
        { key: 'ticket_url', label: 'Ticket URL', example: 'https://helpdesk.com/tickets/123' }
      ]
    },
    user: {
      label: 'User Variables',
      color: '#8b5cf6',
      variables: [
        { key: 'user_name', label: 'User Name', example: 'John Doe' },
        { key: 'user_email', label: 'User Email', example: 'john@example.com' },
        { key: 'assigned_to_name', label: 'Assigned Engineer', example: 'Jane Smith' },
        { key: 'assigned_to_email', label: 'Engineer Email', example: 'jane@company.com' },
        { key: 'created_by_name', label: 'Created By', example: 'Admin User' }
      ]
    },
    system: {
      label: 'System Variables',
      color: '#10b981',
      variables: [
        { key: 'system_name', label: 'System Name', example: 'Nexus Support' },
        { key: 'system_url', label: 'System URL', example: 'https://helpdesk.com' },
        { key: 'company_name', label: 'Company Name', example: 'Your Company' }
      ]
    },
    dates: {
      label: 'Date Variables',
      color: '#f59e0b',
      variables: [
        { key: 'created_date', label: 'Created Date', example: '2025-10-19 10:30 AM' },
        { key: 'updated_date', label: 'Updated Date', example: '2025-10-19 02:45 PM' },
        { key: 'current_date', label: 'Current Date', example: '2025-10-20' }
      ]
    }
  };

  // Toggle category expansion
  const toggleCategory = (category) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Copy variable to clipboard and insert
  const handleVariableClick = (variableKey) => {
    const variableText = `{{${variableKey}}}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(variableText).then(() => {
      setCopiedVariable(variableKey);
      setTimeout(() => setCopiedVariable(null), 2000);
    });

    // Call onInsert callback if provided
    if (onInsert) {
      onInsert(variableText);
    }
  };

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1rem'
    }}>
      <h4 style={{
        fontSize: '0.875rem',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '0.75rem',
        marginTop: 0
      }}>
        Available Template Variables
      </h4>
      <p style={{
        fontSize: '0.75rem',
        color: '#6b7280',
        marginBottom: '1rem',
        marginTop: 0
      }}>
        Click any variable to copy it to clipboard
      </p>

      {Object.entries(variableCategories).map(([categoryKey, category]) => (
        <div key={categoryKey} style={{ marginBottom: '0.75rem' }}>
          {/* Category Header */}
          <button
            onClick={() => toggleCategory(categoryKey)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f9fafb';
              e.currentTarget.style.borderColor = category.color;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#e5e7eb';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '0.75rem',
                height: '0.75rem',
                backgroundColor: category.color,
                borderRadius: '50%'
              }}></div>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#111827'
              }}>
                {category.label}
              </span>
              <span style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '0.125rem 0.5rem',
                borderRadius: '9999px'
              }}>
                {category.variables.length}
              </span>
            </div>
            {expandedCategories.includes(categoryKey) ? (
              <ChevronUp style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
            ) : (
              <ChevronDown style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
            )}
          </button>

          {/* Variables List */}
          {expandedCategories.includes(categoryKey) && (
            <div style={{
              marginTop: '0.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.5rem'
            }}>
              {category.variables.map((variable) => (
                <button
                  key={variable.key}
                  onClick={() => handleVariableClick(variable.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#eff6ff';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#e5e7eb';
                  }}
                  title={`Click to copy {{${variable.key}}}\nExample: ${variable.example}`}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: '#111827',
                      marginBottom: '0.125rem'
                    }}>
                      {variable.label}
                    </div>
                    <div style={{
                      fontSize: '0.625rem',
                      color: '#6b7280',
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {`{{${variable.key}}}`}
                    </div>
                  </div>
                  {copiedVariable === variable.key ? (
                    <Check style={{ 
                      width: '1rem', 
                      height: '1rem', 
                      color: '#10b981',
                      flexShrink: 0 
                    }} />
                  ) : (
                    <Copy style={{ 
                      width: '1rem', 
                      height: '1rem', 
                      color: '#9ca3af',
                      flexShrink: 0 
                    }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default TemplateVariables;
