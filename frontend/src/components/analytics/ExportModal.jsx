import { useState } from 'react';
import { Download, X, FileText, File } from 'lucide-react';
import '../../styles/ExportModal.css';  // ✅ CORRECTED PATH

const ExportModal = ({ isOpen, onClose, onExport }) => {
  const [exportType, setExportType] = useState('pdf');

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(exportType);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <Download size={24} />
            Export Analytics Report
          </h2>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">
            Choose your preferred format to export the analytics report
          </p>

          <div className="export-options">
            <div
              className={`export-option ${exportType === 'pdf' ? 'active' : ''}`}
              onClick={() => setExportType('pdf')}
            >
              <div className="option-icon pdf">
                <FileText size={32} />
              </div>
              <div className="option-content">
                <h3>PDF Document</h3>
                <p>Professional formatted report with tables and charts</p>
              </div>
              <div className="option-radio">
                <input
                  type="radio"
                  name="exportType"
                  value="pdf"
                  checked={exportType === 'pdf'}
                  onChange={() => setExportType('pdf')}
                />
              </div>
            </div>

            <div
              className={`export-option ${exportType === 'csv' ? 'active' : ''}`}
              onClick={() => setExportType('csv')}
            >
              <div className="option-icon csv">
                <File size={32} />
              </div>
              <div className="option-content">
                <h3>CSV Spreadsheet</h3>
                <p>Raw data for Excel, Google Sheets, and analysis tools</p>
              </div>
              <div className="option-radio">
                <input
                  type="radio"
                  name="exportType"
                  value="csv"
                  checked={exportType === 'csv'}
                  onChange={() => setExportType('csv')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-export" onClick={handleExport}>
            <Download size={18} />
            Export {exportType.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;