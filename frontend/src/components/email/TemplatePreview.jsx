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
    <div className="template-preview-modal-overlay" onClick={onClose}>
      <div className="template-preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="template-preview-modal__header">
          <div className="template-preview-modal__title-group">
            <div className="template-preview-modal__title-icon">
              <Eye style={{ width: '1.25rem', height: '1.25rem' }} />
            </div>
            <div className="template-preview-modal__title-copy">
              <h2>Template Preview</h2>
              <p>{template?.template_name || previewData?.template_name || 'Email Template'}</p>
            </div>
          </div>

          <button type="button" onClick={onClose} className="template-preview-modal__close">
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        <div className="template-preview-modal__notice">
          <Mail style={{ width: '1.1rem', height: '1.1rem' }} />
          <span>
            Preview uses <strong>live Settings</strong> for brand fields plus sample ticket and user data.
          </span>
        </div>

        <div className="template-preview-modal__body">
          <div className="template-preview-modal__frame">
            <div className="template-preview-modal__meta">
              <div className="template-preview-modal__meta-item">
                <span className="template-preview-modal__meta-label">From</span>
                <div className="template-preview-modal__meta-value">{fromLine}</div>
              </div>

              <div className="template-preview-modal__meta-item">
                <span className="template-preview-modal__meta-label">To</span>
                <div className="template-preview-modal__meta-value">
                  {previewData?.sample_data?.user_email || 'user@example.com'}
                </div>
              </div>

              <div className="template-preview-modal__meta-item">
                <span className="template-preview-modal__meta-label">Subject</span>
                <div className="template-preview-modal__meta-value template-preview-modal__meta-value--subject">
                  {subject}
                </div>
              </div>
            </div>

            <div className="template-preview-modal__content">
              <div
                className="template-preview-modal__html"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml) }}
              />
            </div>

            <div className="template-preview-modal__footer-copy">
              {footerCopy && <p>{footerCopy}</p>}
              <p>{copyrightLine || '© Your organization'}</p>
            </div>
          </div>
        </div>

        <div className="template-preview-modal__actions">
          <button type="button" onClick={onClose} className="nx-btn nx-btn--primary">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplatePreview;
