import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Save,
  X,
  Upload,
  File,
  AlertCircle,
  CheckCircle,
  Loader,
  Paperclip,
  Trash2
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/CreateTicket.css';

const CreateTicket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category_id: '',
    priority_id: '',
    department_id: ''
  });

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [departments, setDepartments] = useState([]);

  // File upload state
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch dropdown data
  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    try {
      const [categoriesRes, prioritiesRes, departmentsRes] = await Promise.all([
        api.get('/system/categories'),
        api.get('/system/priorities'),
        api.get('/system/departments')
      ]);

      if (categoriesRes.data.success) {
        setCategories(categoriesRes.data.data);
      }
      if (prioritiesRes.data.success) {
        setPriorities(prioritiesRes.data.data);
      }
      if (departmentsRes.data.success) {
        setDepartments(departmentsRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const maxSize = 10 * 1024 * 1024; // 10MB
    const maxFiles = 5;

    // Check if adding these files exceeds limit
    if (attachments.length + files.length > maxFiles) {
      alert(`You can only upload a maximum of ${maxFiles} files`);
      return;
    }

    // Validate files
    const validFiles = [];
    const invalidFiles = [];

    files.forEach(file => {
      if (file.size > maxSize) {
        invalidFiles.push(`${file.name} (exceeds 10MB)`);
      } else {
        validFiles.push(file);
      }
    });

    if (invalidFiles.length > 0) {
      alert(`The following files are too large:\n${invalidFiles.join('\n')}`);
    }

    // Add valid files
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }

    // Reset input
    e.target.value = '';
  };

  // Remove file
  const handleRemoveFile = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get file icon color
  const getFileIconColor = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    const colors = {
      pdf: '#dc2626',
      doc: '#2563eb',
      docx: '#2563eb',
      xls: '#059669',
      xlsx: '#059669',
      jpg: '#ea580c',
      jpeg: '#ea580c',
      png: '#ea580c',
      gif: '#ea580c',
      txt: '#64748b',
      zip: '#7c3aed',
      rar: '#7c3aed'
    };
    return colors[ext] || '#64748b';
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.length < 5) {
      newErrors.subject = 'Subject must be at least 5 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 10) {
      newErrors.description = 'Description must be at least 10 characters';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (!formData.priority_id) {
      newErrors.priority_id = 'Priority is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload attachments
  const uploadAttachments = async (ticketId) => {
    const formData = new FormData();
    
    // Append all files
    attachments.forEach(file => {
      formData.append('files', file);
    });

    try {
      if (process.env.NODE_ENV === 'development') console.log(`📎 Uploading ${attachments.length} file(s) to ticket ${ticketId}...`);
      
      const response = await api.post(
        `/tickets/${ticketId}/attachments`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress({ percent: percentCompleted });
            if (process.env.NODE_ENV === 'development') console.log(`📊 Upload progress: ${percentCompleted}%`);
          }
        }
      );

      if (process.env.NODE_ENV === 'development') console.log('✅ Attachments uploaded successfully:', response.data);
      return response.data;
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Error uploading attachments:', err);
      if (process.env.NODE_ENV === 'development') console.error('❌ Error response:', err.response?.data);
      throw err;
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      if (process.env.NODE_ENV === 'development') console.log('📤 Creating ticket with data:', formData);

      // Create ticket
      const ticketResponse = await api.post('/tickets', formData);

      if (process.env.NODE_ENV === 'development') console.log('📥 Ticket created response:', ticketResponse.data);

      if (ticketResponse.data.success) {
        const ticketId = ticketResponse.data.data.ticket_id;
        if (process.env.NODE_ENV === 'development') console.log('✅ Ticket created with ID:', ticketId);

        // Upload attachments if any
        if (attachments.length > 0) {
          if (process.env.NODE_ENV === 'development') console.log(`📎 Uploading ${attachments.length} attachment(s)...`);
          
          try {
            await uploadAttachments(ticketId);
            if (process.env.NODE_ENV === 'development') console.log('✅ All attachments uploaded successfully');
          } catch (uploadErr) {
            if (process.env.NODE_ENV === 'development') console.error('⚠️ Attachment upload failed:', uploadErr);
            // Continue anyway - ticket is created
          }
        } else {
          if (process.env.NODE_ENV === 'development') console.log('ℹ️ No attachments to upload');
        }

        // Show success message
        setSuccessMessage('Ticket created successfully!');
        setShowSuccess(true);

        // Redirect after 2 seconds
        setTimeout(() => {
          navigate(`/tickets/${ticketId}`);
        }, 2000);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Error creating ticket:', err);
      if (process.env.NODE_ENV === 'development') console.error('❌ Error response:', err.response);
      
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      } else {
        setErrors({
          submit: err.response?.data?.message || 'Failed to create ticket. Please try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Get priority badge class
  const getPriorityBadgeClass = (priorityId) => {
    const priority = priorities.find(p => p.priority_id === parseInt(priorityId));
    if (!priority) return '';

    const classes = {
      'CRITICAL': 'priority-preview-critical',
      'HIGH': 'priority-preview-high',
      'MEDIUM': 'priority-preview-medium',
      'LOW': 'priority-preview-low',
      'PLANNING': 'priority-preview-planning'
    };
    return classes[priority.priority_code] || '';
  };

  return (
    <div className="create-ticket-page">
      {/* Success Modal */}
      {showSuccess && (
        <div className="success-modal-overlay">
          <div className="success-modal">
            <div className="success-icon">
              <CheckCircle size={64} />
            </div>
            <h2>Ticket Created Successfully!</h2>
            <p>Your ticket has been submitted and assigned a ticket number.</p>
            <p className="redirect-message">Redirecting to ticket details...</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header-create">
        <div className="header-content">
          <button 
            className="btn-back"
            onClick={() => navigate('/tickets')}
            disabled={loading}
          >
            <ArrowLeft size={20} />
            <span>Back to Tickets</span>
          </button>
          <div className="header-title-section">
            <h1 className="page-title-create">Create New Ticket</h1>
            <p className="page-subtitle-create">
              Submit a new support request to our IT helpdesk team
            </p>
          </div>
        </div>
      </div>

      <div className="create-ticket-container">
        <div className="create-ticket-content">
          {/* Main Form */}
          <div className="form-section">
            <form onSubmit={handleSubmit} className="ticket-form">
              {/* Global Error */}
              {errors.submit && (
                <div className="alert alert-error">
                  <AlertCircle size={20} />
                  <span>{errors.submit}</span>
                </div>
              )}

              {/* Subject */}
              <div className="form-group">
                <label htmlFor="subject" className="form-label required">
                  Ticket Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  className={`form-input ${errors.subject ? 'error' : ''}`}
                  placeholder="Brief summary of your issue (e.g., Laptop not turning on)"
                  value={formData.subject}
                  onChange={handleChange}
                  disabled={loading}
                  maxLength={200}
                />
                {errors.subject && (
                  <span className="error-message">{errors.subject}</span>
                )}
                <span className="field-hint">
                  {formData.subject.length}/200 characters
                </span>
              </div>

              {/* Category & Priority */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="category_id" className="form-label required">
                    Category
                  </label>
                  <select
                    id="category_id"
                    name="category_id"
                    className={`form-select ${errors.category_id ? 'error' : ''}`}
                    value={formData.category_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select a category</option>
                    {categories.map(category => (
                      <option key={category.category_id} value={category.category_id}>
                        {category.category_name}
                      </option>
                    ))}
                  </select>
                  {errors.category_id && (
                    <span className="error-message">{errors.category_id}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="priority_id" className="form-label required">
                    Priority
                  </label>
                  <select
                    id="priority_id"
                    name="priority_id"
                    className={`form-select ${errors.priority_id ? 'error' : ''}`}
                    value={formData.priority_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select priority</option>
                    {priorities.map(priority => (
                      <option key={priority.priority_id} value={priority.priority_id}>
                        {priority.priority_name}
                      </option>
                    ))}
                  </select>
                  {errors.priority_id && (
                    <span className="error-message">{errors.priority_id}</span>
                  )}
                </div>
              </div>

              {/* Department (Optional) */}
              <div className="form-group">
                <label htmlFor="department_id" className="form-label">
                  Department <span className="optional-label">(Optional)</span>
                </label>
                <select
                  id="department_id"
                  name="department_id"
                  className="form-select"
                  value={formData.department_id}
                  onChange={handleChange}
                  disabled={loading}
                >
                  <option value="">Select department</option>
                  {departments.map(dept => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
                <span className="field-hint">
                  Select the department related to this issue
                </span>
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="description" className="form-label required">
                  Detailed Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  className={`form-textarea ${errors.description ? 'error' : ''}`}
                  placeholder="Please provide a detailed description of your issue. Include:&#10;• What happened?&#10;• When did it occur?&#10;• What were you trying to do?&#10;• Any error messages?"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={loading}
                  rows={8}
                  maxLength={2000}
                />
                {errors.description && (
                  <span className="error-message">{errors.description}</span>
                )}
                <span className="field-hint">
                  {formData.description.length}/2000 characters
                </span>
              </div>

              {/* File Attachments */}
              <div className="form-group">
                <label className="form-label">
                  Attachments <span className="optional-label">(Optional)</span>
                </label>
                
                <div className="file-upload-area">
                  <input
                    type="file"
                    id="file-input"
                    className="file-input-hidden"
                    onChange={handleFileSelect}
                    multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.zip,.rar"
                    disabled={loading || attachments.length >= 5}
                  />
                  
                  <label 
                    htmlFor="file-input" 
                    className={`file-upload-label ${attachments.length >= 5 ? 'disabled' : ''}`}
                  >
                    <Upload size={24} />
                    <span className="upload-text">
                      Click to upload or drag and drop
                    </span>
                    <span className="upload-hint">
                      Maximum 5 files, 10MB each (PDF, DOC, XLS, Images, ZIP)
                    </span>
                  </label>
                </div>

                {/* Attached Files List */}
                {attachments.length > 0 && (
                  <div className="attached-files-list">
                    <div className="attached-files-header">
                      <Paperclip size={16} />
                      <span>{attachments.length} file{attachments.length !== 1 ? 's' : ''} attached</span>
                    </div>
                    {attachments.map((file, index) => (
                      <div key={index} className="attached-file-item">
                        <div className="file-icon" style={{ color: getFileIconColor(file.name) }}>
                          <File size={20} />
                        </div>
                        <div className="file-info">
                          <span className="file-name" title={file.name}>
                            {file.name}
                          </span>
                          <span className="file-size">
                            {formatFileSize(file.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-remove-file"
                          onClick={() => handleRemoveFile(index)}
                          disabled={loading}
                          title="Remove file"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Progress */}
                {uploadProgress.percent > 0 && uploadProgress.percent < 100 && (
                  <div className="upload-progress-bar">
                    <div 
                      className="upload-progress-fill" 
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                    <span className="upload-progress-text">
                      Uploading... {uploadProgress.percent}%
                    </span>
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigate('/tickets')}
                  disabled={loading}
                >
                  <X size={18} />
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader size={18} className="spinning" />
                      <span>Creating Ticket...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>Create Ticket</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Ticket Preview & Help */}
          <div className="sidebar-section">
            {/* Preview Card */}
            <div className="preview-card">
              <h3 className="preview-title">Ticket Preview</h3>
              <div className="preview-content">
                {formData.subject ? (
                  <>
                    <div className="preview-item">
                      <span className="preview-label">Subject:</span>
                      <span className="preview-value">{formData.subject}</span>
                    </div>
                    {formData.category_id && (
                      <div className="preview-item">
                        <span className="preview-label">Category:</span>
                        <span className="preview-badge category-badge">
                          {categories.find(c => c.category_id === parseInt(formData.category_id))?.category_name}
                        </span>
                      </div>
                    )}
                    {formData.priority_id && (
                      <div className="preview-item">
                        <span className="preview-label">Priority:</span>
                        <span className={`preview-badge priority-badge ${getPriorityBadgeClass(formData.priority_id)}`}>
                          {priorities.find(p => p.priority_id === parseInt(formData.priority_id))?.priority_name}
                        </span>
                      </div>
                    )}
                    {formData.department_id && (
                      <div className="preview-item">
                        <span className="preview-label">Department:</span>
                        <span className="preview-value">
                          {departments.find(d => d.department_id === parseInt(formData.department_id))?.department_name}
                        </span>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="preview-item">
                        <span className="preview-label">Attachments:</span>
                        <span className="preview-value">{attachments.length} file(s)</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="preview-empty">Fill in the form to see preview</p>
                )}
              </div>
            </div>

            {/* Help Card */}
            <div className="help-card">
              <h3 className="help-title">Need Help?</h3>
              <div className="help-content">
                <div className="help-item">
                  <h4>Priority Levels:</h4>
                  <ul>
                    <li><strong>Critical:</strong> System down, blocking work</li>
                    <li><strong>High:</strong> Major impact, urgent</li>
                    <li><strong>Medium:</strong> Moderate impact</li>
                    <li><strong>Low:</strong> Minor issue</li>
                  </ul>
                </div>
                <div className="help-item">
                  <h4>Tips for faster resolution:</h4>
                  <ul>
                    <li>Be specific and detailed</li>
                    <li>Include error messages</li>
                    <li>Attach screenshots if applicable</li>
                    <li>Mention steps to reproduce</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTicket;