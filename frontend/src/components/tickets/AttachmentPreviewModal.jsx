// ============================================
// ATTACHMENT PREVIEW MODAL
// Previews file attachments in a modal window.
// Supports: images, PDFs, plain text (editable on CreateTicket)
// No external services/URLs used — 100% browser-native
// ============================================

import { useEffect, useState, useRef, useCallback } from 'react';
import {
    X, Download, ZoomIn, ZoomOut, RotateCw,
    FileText, File as FileIcon, FileSpreadsheet, Archive,
    Loader, AlertCircle, Edit3, Save, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../../utils/constants';
import '../../styles/AttachmentPreviewModal.css';

// ============================================
// File type classification
// ============================================
const getFileType = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['txt', 'csv', 'log', 'md', 'json', 'xml', 'html', 'css', 'js'].includes(ext)) return 'text';
    if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'word';
    if (['xls', 'xlsx', 'ods'].includes(ext)) return 'excel';
    if (['ppt', 'pptx'].includes(ext)) return 'powerpoint';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'other';
};

const getExtension = (fileName) => (fileName || '').split('.').pop().toLowerCase();

// ============================================
// File type icon mapping
// ============================================
const FileTypeIcon = ({ fileName, size = 48 }) => {
    const type = getFileType(fileName);
    const icons = {
        image: { icon: '🖼️', color: '#ea580c', label: 'IMAGE' },
        pdf: { icon: '📄', color: '#dc2626', label: 'PDF' },
        text: { icon: '📝', color: '#64748b', label: getExtension(fileName).toUpperCase() },
        word: { icon: '📘', color: '#2563eb', label: 'WORD' },
        excel: { icon: '📗', color: '#059669', label: 'EXCEL' },
        powerpoint: { icon: '📙', color: '#d97706', label: 'PPT' },
        archive: { icon: '🗜️', color: '#7c3aed', label: 'ZIP' },
        other: { icon: '📁', color: '#64748b', label: getExtension(fileName).toUpperCase() },
    };
    const cfg = icons[type] || icons.other;
    return (
        <div className="apm-filetype-icon" style={{ '--icon-color': cfg.color }}>
            <span className="apm-filetype-emoji" style={{ fontSize: size }}>{cfg.icon}</span>
            <span className="apm-filetype-label">{cfg.label}</span>
        </div>
    );
};

// ============================================
// Format file size
// ============================================
const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatSizeKB = (kb) => {
    if (!kb) return '';
    if (kb < 1024) return `${kb.toFixed ? kb.toFixed(1) : kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
};

// ============================================
// MAIN COMPONENT
// Props:
//   file         - File object (local, for CreateTicket) OR
//                  { file_name, attachment_id, ticket_id, file_size_kb, uploaded_by_name } (saved, for TicketDetail)
//   onClose      - function to close modal
//   onDownload   - function(attachmentId, fileName) for saved files
//   onFileEdit   - function(newFile) called when user edits a text file (CreateTicket only)
// ============================================
const AttachmentPreviewModal = ({ file, onClose, onDownload, onFileEdit }) => {
    const [blobUrl, setBlobUrl] = useState(null);
    const [textContent, setTextContent] = useState('');
    const [editedText, setEditedText] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [imgZoom, setImgZoom] = useState(1);
    const [imgRotate, setImgRotate] = useState(0);
    const overlayRef = useRef(null);

    // Detect local File vs saved attachment — use duck-typing to avoid
    // shadowing issues with the lucide-react 'File' icon import
    const isLocalFile = !!(file && typeof file.name === 'string' && typeof file.size === 'number' && typeof file.arrayBuffer === 'function');
    const fileName = isLocalFile ? file.name : file.file_name;
    const fileType = getFileType(fileName);
    const fileSize = isLocalFile ? formatSize(file.size) : formatSizeKB(file.file_size_kb);

    // ============================================
    // Load / prepare the preview
    // ============================================
    useEffect(() => {
        let objectUrl = null;

        const loadLocalFile = async () => {
            setLoading(true);
            setError('');
            try {
                if (fileType === 'image' || fileType === 'pdf') {
                    objectUrl = URL.createObjectURL(file);
                    setBlobUrl(objectUrl);
                } else if (fileType === 'text') {
                    const text = await file.text();
                    setTextContent(text);
                    setEditedText(text);
                }
            } catch (e) {
                setError('Could not read file.');
            } finally {
                setLoading(false);
            }
        };

        const loadSavedFile = async () => {
            setLoading(true);
            setError('');
            try {
                if (fileType === 'image' || fileType === 'pdf' || fileType === 'text') {
                    // Fetch blob via authenticated API — cookie sent automatically
                    const url = `${API_BASE_URL}/tickets/${file.ticket_id}/attachments/${file.attachment_id}/download`;
                    const res = await fetch(url, {
                        credentials: 'include'
                    });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);

                    const blob = await res.blob();

                    if (fileType === 'text') {
                        const text = await blob.text();
                        setTextContent(text);
                        setEditedText(text);
                    } else {
                        objectUrl = URL.createObjectURL(blob);
                        setBlobUrl(objectUrl);
                    }
                }
            } catch (e) {
                setError('Could not load file preview.');
            } finally {
                setLoading(false);
            }
        };

        if (fileType === 'word' || fileType === 'excel' || fileType === 'powerpoint' || fileType === 'archive' || fileType === 'other') {
            // No content preview available
            setLoading(false);
        } else {
            if (isLocalFile) {
                loadLocalFile();
            } else {
                loadSavedFile();
            }
        }

        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    // ============================================
    // Close on Escape key
    // ============================================
    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // ============================================
    // Save edited text as new File (CreateTicket only)
    // ============================================
    const handleSaveEdit = useCallback(() => {
        if (!onFileEdit || !isLocalFile) return;
        const newBlob = new Blob([editedText], { type: 'text/plain' });
        // Use window.File explicitly to guarantee the native constructor
        const NativeFile = window.File;
        const newFile = new NativeFile([newBlob], fileName, { type: (file.type || 'text/plain'), lastModified: Date.now() });
        onFileEdit(newFile);
        setTextContent(editedText);
        setIsEditing(false);
    }, [editedText, fileName, file, isLocalFile, onFileEdit]);

    // ============================================
    // Download local file
    // ============================================
    const handleDownloadLocal = () => {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // ============================================
    // Overlay click to close
    // ============================================
    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) onClose();
    };

    // ============================================
    // RENDER PREVIEW BODY
    // ============================================
    const renderPreviewBody = () => {
        if (loading) {
            return (
                <div className="apm-center-state">
                    <Loader size={40} className="apm-spinner" />
                    <p>Loading preview...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="apm-center-state apm-error-state">
                    <AlertCircle size={40} />
                    <p>{error}</p>
                </div>
            );
        }

        // ---- IMAGE ----
        if (fileType === 'image') {
            return (
                <div className="apm-img-container">
                    <img
                        src={blobUrl}
                        alt={fileName}
                        className="apm-img"
                        style={{
                            transform: `scale(${imgZoom}) rotate(${imgRotate}deg)`,
                            transition: 'transform 0.2s ease'
                        }}
                        draggable={false}
                    />
                </div>
            );
        }

        // ---- PDF ----
        if (fileType === 'pdf') {
            return (
                <div className="apm-pdf-container">
                    <iframe
                        src={blobUrl}
                        title={fileName}
                        className="apm-pdf-iframe"
                    />
                </div>
            );
        }

        // ---- TEXT ----
        if (fileType === 'text') {
            return (
                <div className="apm-text-container">
                    {isEditing ? (
                        <textarea
                            className="apm-text-editor"
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            spellCheck={false}
                        />
                    ) : (
                        <pre className="apm-text-viewer">{textContent || '(empty file)'}</pre>
                    )}
                </div>
            );
        }

        // ---- OFFICE / ARCHIVE / OTHER — No preview available ----
        const downloadOnlyMessages = {
            word: { emoji: '📘', title: 'Word Document', hint: 'Word documents cannot be previewed in the browser.' },
            excel: { emoji: '📗', title: 'Excel Spreadsheet', hint: 'Excel files cannot be previewed in the browser.' },
            powerpoint: { emoji: '📙', title: 'PowerPoint Presentation', hint: 'PowerPoint files cannot be previewed in the browser.' },
            archive: { emoji: '🗜️', title: 'Archive File', hint: 'Archive files cannot be previewed in the browser.' },
            other: { emoji: '📁', title: 'File', hint: 'This file type cannot be previewed in the browser.' },
        };
        const msg = downloadOnlyMessages[fileType] || downloadOnlyMessages.other;

        return (
            <div className="apm-center-state apm-no-preview">
                <div className="apm-no-preview-icon">{msg.emoji}</div>
                <h3>{msg.title}</h3>
                <p className="apm-no-preview-hint">{msg.hint}</p>
                <p className="apm-no-preview-hint">Download the file to open it with the appropriate application.</p>
                <button
                    className="apm-btn apm-btn-primary apm-download-main-btn"
                    onClick={isLocalFile ? handleDownloadLocal : () => onDownload?.(file.attachment_id, fileName)}
                >
                    <Download size={18} />
                    Download File
                </button>
            </div>
        );
    };

    // ============================================
    // RENDER TOOLBAR ACTIONS
    // ============================================
    const renderToolbar = () => {
        const actions = [];

        // Image controls
        if (fileType === 'image' && !loading && !error && blobUrl) {
            actions.push(
                <button key="zoom-in" className="apm-tool-btn" onClick={() => setImgZoom(z => Math.min(z + 0.25, 4))} title="Zoom In">
                    <ZoomIn size={18} />
                </button>,
                <button key="zoom-out" className="apm-tool-btn" onClick={() => setImgZoom(z => Math.max(z - 0.25, 0.25))} title="Zoom Out">
                    <ZoomOut size={18} />
                </button>,
                <button key="zoom-reset" className="apm-tool-btn" onClick={() => { setImgZoom(1); setImgRotate(0); }} title="Reset">
                    <RefreshCw size={16} />
                </button>,
                <button key="rotate" className="apm-tool-btn" onClick={() => setImgRotate(r => (r + 90) % 360)} title="Rotate">
                    <RotateCw size={18} />
                </button>
            );
        }

        // Text edit controls (CreateTicket only)
        if (fileType === 'text' && !loading && !error && isLocalFile && onFileEdit) {
            if (isEditing) {
                actions.push(
                    <button key="save-edit" className="apm-tool-btn apm-tool-btn-save" onClick={handleSaveEdit} title="Save changes">
                        <Save size={16} /> Save
                    </button>,
                    <button key="cancel-edit" className="apm-tool-btn" onClick={() => { setEditedText(textContent); setIsEditing(false); }} title="Cancel">
                        <X size={16} /> Cancel
                    </button>
                );
            } else {
                actions.push(
                    <button key="edit" className="apm-tool-btn" onClick={() => setIsEditing(true)} title="Edit file">
                        <Edit3 size={16} /> Edit
                    </button>
                );
            }
        }

        // Download button (all types that have preview, plus general access)
        const noDownloadTypes = ['word', 'excel', 'powerpoint', 'archive', 'other'];
        if (!noDownloadTypes.includes(fileType)) {
            if (isLocalFile) {
                actions.push(
                    <button key="download" className="apm-tool-btn" onClick={handleDownloadLocal} title="Download">
                        <Download size={18} />
                    </button>
                );
            } else if (onDownload) {
                actions.push(
                    <button key="download" className="apm-tool-btn" onClick={() => onDownload(file.attachment_id, fileName)} title="Download">
                        <Download size={18} />
                    </button>
                );
            }
        }

        return actions;
    };

    // ============================================
    // MAIN RENDER
    // ============================================
    return (
        <div className="apm-overlay" ref={overlayRef} onClick={handleOverlayClick} role="dialog" aria-modal="true" aria-label={`Preview: ${fileName}`}>
            <div className="apm-modal">

                {/* ---- HEADER ---- */}
                <div className="apm-header">
                    <div className="apm-header-file-info">
                        <div className="apm-header-icon-wrap">
                            <FileTypeIcon fileName={fileName} size={22} />
                        </div>
                        <div className="apm-header-text">
                            <span className="apm-header-filename" title={fileName}>{fileName}</span>
                            {fileSize && <span className="apm-header-size">{fileSize}</span>}
                            {!isLocalFile && file.uploaded_by_name && (
                                <span className="apm-header-uploader">by {file.uploaded_by_name}</span>
                            )}
                        </div>
                    </div>
                    <div className="apm-header-actions">
                        {renderToolbar()}
                        <div className="apm-header-divider" />
                        <button className="apm-close-btn" onClick={onClose} title="Close (Esc)">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ---- BODY ---- */}
                <div className="apm-body">
                    {renderPreviewBody()}
                </div>

                {/* ---- FOOTER (image zoom indicator) ---- */}
                {fileType === 'image' && !loading && !error && blobUrl && (
                    <div className="apm-footer">
                        <span className="apm-zoom-label">{Math.round(imgZoom * 100)}%</span>
                        <span className="apm-footer-hint">Scroll to zoom · Drag to pan</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttachmentPreviewModal;
