// ============================================
// TEMPLATE PREVIEW MODAL — uses live brand fields from API
// ============================================

import React from 'react';
import DOMPurify from 'dompurify';
import { X, Mail, Eye } from 'lucide-react';

const TemplatePreview = ({ isOpen, onClose, template, previewData }) => {
  if (!isOpen) return null;

  const subject = previewData?.subject ?? template?.subject ?? 'Email Subject';
  const bodyHtml = previewData?.body ?? template?.body ?? '<p>Email body will appear here...</p>';
  const fromLine =
    previewData?.from_preview ??
    (previewData?.sample_data
      ? `"${previewData.sample_data.system_name || 'App'}" <${previewData.sample_data.support_email || 'noreply@example.com'}>`
      : 'Your App <noreply@example.com>');
  const footerCopy =
    previewData?.brand_footer ||
    (previewData?.sample_data?.email_footer_disclaimer
      ? previewData.sample_data.email_footer_disclaimer
      : null);
  const copyrightLine =
    previewData?.footer_preview ||
    (previewData?.sample_data
      ? `© ${previewData.sample_data.current_year || ''} ${previewData.sample_data.company_name || previewData.sample_data.system_name || ''}`.trim()
      : '');

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
        padding: '1rem',
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
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                backgroundColor: '#eff6ff',
                borderRadius: '0.5rem',
              }}
            >
              <Eye style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6' }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#111827',
                  margin: 0,
                }}
              >
                Template Preview
              </h2>
              <p
                style={{
                  fontSize: '0.875rem',
                  color: '#6b7280',
                  margin: '0.25rem 0 0 0',
                }}
              >
                {template?.template_name || previewData?.template_name || 'Email Template'}
              </p>
            </div>
          </div>
          <button
            type="button"
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
            }}
          >
            <X style={{ width: '1.5rem', height: '1.5rem' }} />
          </button>
        </div>

        <div
          style={{
            padding: '1rem 1.5rem',
            backgroundColor: '#ecfdf5',
            borderBottom: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Mail style={{ width: '1.25rem', height: '1.25rem', color: '#047857' }} />
          <span style={{ fontSize: '0.875rem', color: '#065f46' }}>
            Preview uses <strong>live Settings</strong> for brand fields (system name, company, support email) plus sample ticket/user data.
          </span>
        </div>

        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            backgroundColor: '#f9fafb',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.5rem',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '2px solid #e5e7eb',
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  From:
                </span>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#111827',
                    marginTop: '0.25rem',
                  }}
                >
                  {fromLine}
                </div>
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  To:
                </span>
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: '#111827',
                    marginTop: '0.25rem',
                  }}
                >
                  {previewData?.sample_data?.user_email || 'user@example.com'}
                </div>
              </div>

              <div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Subject:
                </span>
                <div
                  style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#111827',
                    marginTop: '0.25rem',
                  }}
                >
                  {subject}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '2rem 1.5rem',
                backgroundColor: '#ffffff',
              }}
            >
              <div
                style={{
                  fontSize: '0.875rem',
                  lineHeight: '1.5',
                  color: '#374151',
                }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }}
              />
            </div>

            <div
              style={{
                padding: '1.5rem',
                backgroundColor: '#f9fafb',
                borderTop: '1px solid #e5e7eb',
                fontSize: '0.75rem',
                color: '#6b7280',
                textAlign: 'center',
              }}
            >
              {footerCopy && <p style={{ margin: '0 0 0.5rem 0' }}>{footerCopy}</p>}
              <p style={{ margin: 0 }}>{copyrightLine || '© Your organization'}</p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            padding: '1.5rem',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              color: '#ffffff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;
