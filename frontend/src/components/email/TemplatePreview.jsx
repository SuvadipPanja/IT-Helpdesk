// ============================================
// TEMPLATE PREVIEW MODAL COMPONENT
// Preview email template with sample data
// FILE: frontend/src/components/email/TemplatePreview.jsx
// ============================================

import React from 'react';
import { X, Mail, Eye } from 'lucide-react';

const TemplatePreview = ({ isOpen, onClose, template, previewData }) => {
  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxWidth: '56rem',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.5rem',
              height: '2.5rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem'
            }}>
              <Eye style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#111827',
                margin: 0
              }}>
                Template Preview
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                margin: '0.25rem 0 0 0'
              }}>
                {template?.template_name || 'Email Template'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '0.375rem',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              e.currentTarget.style.color = '#111827';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            <X style={{ width: '1.5rem', height: '1.5rem' }} />
          </button>
        </div>

        {/* Preview Notice */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#fef3c7',
          borderBottom: '1px solid #fde68a',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <Mail style={{ width: '1.25rem', height: '1.25rem', color: '#92400e' }} />
          <span style={{
            fontSize: '0.875rem',
            color: '#92400e'
          }}>
            This is a preview with sample data. Actual emails will use real data.
          </span>
        </div>

        {/* Email Preview Content */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: '#f9fafb'
        }}>
          {/* Email Container */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* Email Header */}
            <div style={{
              padding: '1.5rem',
              borderBottom: '2px solid #e5e7eb'
            }}>
              {/* From */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  From:
                </span>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#111827',
                  marginTop: '0.25rem'
                }}>
                  Nexus Support &lt;support@company.com&gt;
                </div>
              </div>

              {/* To */}
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  To:
                </span>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#111827',
                  marginTop: '0.25rem'
                }}>
                  {previewData?.user_email || 'user@example.com'}
                </div>
              </div>

              {/* Subject */}
              <div>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Subject:
                </span>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#111827',
                  marginTop: '0.25rem'
                }}>
                  {previewData?.subject || template?.subject || 'Email Subject'}
                </div>
              </div>
            </div>

            {/* Email Body */}
            <div style={{
              padding: '2rem 1.5rem',
              backgroundColor: '#ffffff'
            }}>
              <div 
                style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  color: '#374151'
                }}
                dangerouslySetInnerHTML={{ 
                  __html: previewData?.body || template?.body || '<p>Email body will appear here...</p>' 
                }}
              />
            </div>

            {/* Email Footer */}
            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              fontSize: '0.75rem',
              color: '#6b7280',
              textAlign: 'center'
            }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                This email was sent by Nexus Support
              </p>
              <p style={{ margin: 0 }}>
                © 2025 Your Company. All rights reserved.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: '#ffffff'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              color: '#ffffff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              fontSize: '0.875rem'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Close Preview
          </button>
        </div>
      </div>

      {/* Custom scrollbar styling */}
      <style>{`
        .email-preview-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .email-preview-content::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        
        .email-preview-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        
        .email-preview-content::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
};

export default TemplatePreview;
