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
  Trash2,
  Eye
} from 'lucide-react';
import api from '../../services/api';
import AttachmentPreviewModal from '../../components/tickets/AttachmentPreviewModal';
import DynamicTicketFormSections from '../../components/tickets/DynamicTicketFormSections';
import KBDeflectionWidget from '../../components/helpdesk/KBDeflectionWidget';
import { getCategorySchema, getResolvedTemplateVariables, resolveGuidanceTemplate } from '../../data/ticketFormSchemas';
import '../../styles/CreateTicket.css';

const CreateTicket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state — pre-fill user's location & department from auth context
  const [formData, setFormData] = useState(() => ({
    subject: '',
    description: '',
    category_id: '',
    priority_id: '',
    department_id: user?.department?.department_id ? String(user.department.department_id) : '',
    sub_category_id: '',
    other_category_text: '',
    location_id: user?.location_id ? String(user.location_id) : '',
    process_id: '',
    team_id: '',
  }));

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [teams, setTeams] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [guidanceState, setGuidanceState] = useState({
    checklist: {},
    selectedTemplateId: '',
    selectedTemplateLabel: '',
    selectedTemplateText: '',
    subjectAutoFilled: false,
  });

  // File upload state
  const [attachments, setAttachments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});

  // Preview state
  const [previewFile, setPreviewFile] = useState(null); // File object being previewed
  const [previewIndex, setPreviewIndex] = useState(null); // Index in attachments array

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
    const fallback = { data: { success: false, data: [] } };
    try {
      const isAdminMgr = ['ADMIN', 'MANAGER'].includes(user?.role?.role_code);
      const [categoriesRes, prioritiesRes, departmentsRes, locationsRes, processesRes, teamsRes] = await Promise.all([
        api.get('/system/categories').catch(() => fallback),
        api.get('/system/priorities').catch(() => fallback),
        api.get('/system/departments').catch(() => fallback),
        api.get('/system/locations').catch(() => fallback),
        api.get('/system/processes').catch(() => fallback),
        isAdminMgr ? api.get('/system/teams').catch(() => fallback) : Promise.resolve(fallback),
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
      if (locationsRes.data.success) {
        setLocations(locationsRes.data.data);
      }
      if (processesRes.data.success) {
        setProcesses(processesRes.data.data);
      }
      if (teamsRes.data.success) {
        setTeams(teamsRes.data.data);
      }

      setFormData(prev => ({
        ...prev,
        location_id: prev.location_id || (user?.location_id ? String(user.location_id) : ''),
        department_id: prev.department_id || (user?.department?.department_id ? String(user.department.department_id) : ''),
      }));
    } catch (err) {
    }
  };

  const selectedCategory = categories.find(c => String(c.category_id) === String(formData.category_id));
  const selectedSubCategory = subCategories.find(sc => String(sc.sub_category_id) === String(formData.sub_category_id));
  const selectedLocation = locations.find(loc => String(loc.location_id) === String(formData.location_id));
  const selectedProcess = processes.find(proc => String(proc.process_id) === String(formData.process_id));
  const selectedDepartment = departments.find(dept => String(dept.department_id) === String(formData.department_id));

  const getCustomFieldMatchValue = (...patterns) => {
    const normalizedPatterns = patterns.map(pattern => String(pattern).toLowerCase());
    const match = customFields.find((field) => {
      const haystack = `${field.field_name || ''} ${field.field_label || ''}`.toLowerCase();
      return normalizedPatterns.some(pattern => haystack.includes(pattern));
    });

    if (!match) return '';
    return String(customFieldValues[match.field_id] || '').trim();
  };

  const buildTemplateContext = () => {
    const requesterName = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.username || 'Requester';
    const userEmail = user?.email || '';
    const emailDomain = userEmail.includes('@') ? userEmail.split('@')[1] : '';
    const categoryLabel = formData.other_category_text?.trim() || selectedSubCategory?.sub_category_name || selectedCategory?.category_name || 'Issue';
    const processLabel = selectedProcess?.process_name || 'Process';
    const departmentLabel = selectedDepartment?.department_name || user?.department?.department_name || 'Department';
    const locationLabel = selectedLocation?.location_name || 'Location';
    const customAssetTag = getCustomFieldMatchValue('asset tag', 'asset');
    const customPrinterName = getCustomFieldMatchValue('printer');
    const customDeviceType = getCustomFieldMatchValue('device type', 'device', 'hardware');
    const customAppName = getCustomFieldMatchValue('app name', 'application', 'software');
    const customSystemName = getCustomFieldMatchValue('system name', 'system', 'resource');
    const topicLabel = formData.other_category_text?.trim() || selectedSubCategory?.sub_category_name || selectedCategory?.category_name || 'Topic';

    return {
      requester_name: requesterName,
      username: user?.username || requesterName,
      location_name: locationLabel,
      department_name: departmentLabel,
      process_name: processLabel,
      client_name: processLabel,
      printer_name: customPrinterName || categoryLabel,
      device_type: customDeviceType || categoryLabel,
      app_name: customAppName || categoryLabel,
      software_name: customAppName || categoryLabel,
      system_name: customSystemName || categoryLabel,
      resource_name: customSystemName || categoryLabel,
      topic_name: topicLabel,
      feature_name: topicLabel,
      application_name: customAppName || categoryLabel,
      task_name: topicLabel,
      drive_path: processLabel,
      recipient_address: userEmail || 'recipient@example.com',
      sender_domain: emailDomain || 'example.com',
      new_employee_name: requesterName,
      asset_tag: customAssetTag || 'Asset Tag',
    };
  };

  // Fetch sub-categories when category changes + auto-populate priority
  useEffect(() => {
    if (formData.category_id) {
      fetchSubCategories(formData.category_id);
      // Auto-populate priority from category's default_priority_id (if user hasn't manually set one)
      const selectedCat = categories.find(c => String(c.category_id) === String(formData.category_id));
      if (selectedCat?.default_priority_id) {
        setFormData(prev => ({
          ...prev,
          priority_id: prev.priority_id || String(selectedCat.default_priority_id),
        }));
      }
    } else {
      setSubCategories([]);
      setFormData(prev => ({ ...prev, sub_category_id: '', other_category_text: '' }));
      setCustomFields([]);
      setCustomFieldValues({});
      setGuidanceState({
        checklist: {},
        selectedTemplateId: '',
        selectedTemplateLabel: '',
        selectedTemplateText: '',
        subjectAutoFilled: false,
      });
    }
  }, [formData.category_id, categories]);

  // Fetch custom fields when sub-category changes
  useEffect(() => {
    if (formData.sub_category_id) {
      fetchCustomFields(formData.sub_category_id);
    } else {
      setCustomFields([]);
      setCustomFieldValues({});
    }
  }, [formData.sub_category_id]);

  const fetchSubCategories = async (categoryId) => {
    try {
      const res = await api.get(`/system/sub-categories/${categoryId}`);
      if (res.data.success) {
        setSubCategories(res.data.data);
      }
    } catch (err) {
      setSubCategories([]);
    }
  };

  const fetchCustomFields = async (subCategoryId) => {
    try {
      const res = await api.get(`/system/sub-category-fields/${subCategoryId}`);
      if (res.data.success) {
        setCustomFields(res.data.data);
        // Reset custom field values
        const defaults = {};
        res.data.data.forEach(f => { defaults[f.field_id] = ''; });
        setCustomFieldValues(defaults);
      }
    } catch (err) {
      setCustomFields([]);
    }
  };

  // Check if selected sub-category is an "Other" type
  const isOtherSubCategory = () => {
    const selectedSub = subCategories.find(sc => sc.sub_category_id === parseInt(formData.sub_category_id));
    return selectedSub?.sub_category_name?.toLowerCase().includes('other');
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Reset sub-category when category changes
      if (name === 'category_id') {
        updated.sub_category_id = '';
        updated.other_category_text = '';
      }
      // Reset other_category_text when sub-category changes
      if (name === 'sub_category_id') {
        updated.other_category_text = '';
      }
      return updated;
    });

    if (name === 'subject' && guidanceState.selectedTemplateId) {
      setGuidanceState(prev => ({ ...prev, subjectAutoFilled: false }));
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle custom field value change
  const handleCustomFieldChange = (fieldId, value) => {
    setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  useEffect(() => {
    if (!guidanceState.selectedTemplateId || !guidanceState.subjectAutoFilled || !selectedCategory) {
      return;
    }

    const schema = getCategorySchema(selectedCategory.category_code);
    const selectedTemplate = (schema.subjectTemplates || []).find(template => template.id === guidanceState.selectedTemplateId);
    if (!selectedTemplate) {
      return;
    }

    const resolvedSubject = resolveGuidanceTemplate(selectedTemplate.template, buildTemplateContext());
    setFormData(prev => ({ ...prev, subject: resolvedSubject }));
    setGuidanceState(prev => ({ ...prev, selectedTemplateText: resolvedSubject }));
  }, [
    guidanceState.selectedTemplateId,
    guidanceState.subjectAutoFilled,
    formData.sub_category_id,
    formData.other_category_text,
    formData.location_id,
    formData.process_id,
    formData.department_id,
    selectedCategory,
    selectedSubCategory,
    selectedLocation,
    selectedProcess,
    selectedDepartment,
    customFieldValues,
    customFields,
    user,
  ]);

  const handleGuidanceTemplateSelect = (template) => {
    const resolvedSubject = resolveGuidanceTemplate(template.template, buildTemplateContext());
    setFormData(prev => ({ ...prev, subject: resolvedSubject }));
    setGuidanceState(prev => ({
      ...prev,
      selectedTemplateId: template.id,
      selectedTemplateLabel: template.label,
      selectedTemplateText: resolvedSubject,
      subjectAutoFilled: true,
    }));
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

  // Check if file is image
  const isImageFile = (fileName) => {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
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

  // Get extension label for non-image files
  const getExtLabel = (fileName) => (fileName || '').split('.').pop().toUpperCase().slice(0, 5);

  // Handle file edit from preview modal (replaces file at index)
  const handleFileEdit = (newFile) => {
    if (previewIndex === null) return;
    setAttachments(prev => prev.map((f, i) => i === previewIndex ? newFile : f));
    setPreviewFile(newFile);
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

    if (!formData.location_id) {
      newErrors.location_id = 'Location is required';
    }

    // Validate "Other" text if other sub-category chosen
    if (isOtherSubCategory() && !formData.other_category_text.trim()) {
      newErrors.other_category_text = 'Please specify the issue type';
    }

    // Validate required custom fields
    customFields.forEach(field => {
      if (field.is_required && !customFieldValues[field.field_id]?.toString().trim()) {
        newErrors[`cf_${field.field_id}`] = `${field.field_label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Upload attachments
  const uploadAttachments = async (ticketId) => {
    const fileFormData = new FormData();

    // Append all files
    attachments.forEach(file => {
      fileFormData.append('files', file);
    });

    try {
      if (process.env.NODE_ENV === 'development') console.log(`📎 Uploading ${attachments.length} file(s) to ticket ${ticketId}...`);

      const response = await api.post(
        `/tickets/${ticketId}/attachments`,
        fileFormData,
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

      // Build custom fields array
      const custom_fields_arr = Object.entries(customFieldValues)
        .filter(([, val]) => val !== '' && val !== null && val !== undefined)
        .map(([fieldId, value]) => ({ field_id: parseInt(fieldId), value }));

      const schema = selectedCategory ? getCategorySchema(selectedCategory.category_code) : null;
      const selectedTemplate = schema?.subjectTemplates?.find(template => template.id === guidanceState.selectedTemplateId);
      const templateContext = buildTemplateContext();
      const guidancePayload = selectedCategory ? {
        category_code: selectedCategory.category_code,
        category_name: selectedCategory.category_name,
        icon: schema?.icon || '',
        tips: schema?.hints || [],
        checklist: (schema?.checklist || []).map((item, index) => ({
          id: `check_${index + 1}`,
          text: item,
          checked: Boolean(guidanceState.checklist[`check_${index + 1}`]),
        })),
        selected_template: selectedTemplate ? {
          id: selectedTemplate.id,
          label: selectedTemplate.label,
          template: selectedTemplate.template,
          resolved_text: resolveGuidanceTemplate(selectedTemplate.template, templateContext),
        } : null,
        resolved_variables: selectedTemplate ? getResolvedTemplateVariables(selectedTemplate.template, templateContext) : {},
      } : undefined;

      // Create ticket
      const ticketPayload = {
        ...formData,
        custom_fields: custom_fields_arr.length > 0 ? custom_fields_arr : undefined,
        guidance_payload: guidancePayload,
      };
      const ticketResponse = await api.post('/tickets', ticketPayload);

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

              {/* KB Deflection — suggest articles before ticket is submitted */}
              <KBDeflectionWidget subject={formData.subject} />

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

              {/* Guided intake: category-specific hints, subject templates, checklist */}
              {formData.category_id && (() => {
                const cat = categories.find(c => String(c.category_id) === String(formData.category_id));
                return cat ? (
                  <DynamicTicketFormSections
                    categoryCode={cat.category_code}
                    categoryName={cat.category_name}
                    subject={formData.subject}
                    templateContext={buildTemplateContext()}
                    value={guidanceState}
                    onChange={setGuidanceState}
                    onSubjectTemplate={handleGuidanceTemplateSelect}
                  />
                ) : null;
              })()}

              {/* Sub-Category (dynamic based on category) */}
              {formData.category_id && subCategories.length > 0 && (
                <div className="form-group">
                  <label htmlFor="sub_category_id" className="form-label">
                    Sub-Category <span className="optional-label">(Recommended)</span>
                  </label>
                  <select
                    id="sub_category_id"
                    name="sub_category_id"
                    className="form-select"
                    value={formData.sub_category_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select sub-category</option>
                    {subCategories.map(sc => (
                      <option key={sc.sub_category_id} value={sc.sub_category_id}>
                        {sc.sub_category_name}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Helps us route your ticket to the right team
                  </span>
                </div>
              )}

              {/* "Other" free text (when Other sub-category selected) */}
              {isOtherSubCategory() && (
                <div className="form-group">
                  <label htmlFor="other_category_text" className="form-label required">
                    Please Specify Issue Type
                  </label>
                  <input
                    type="text"
                    id="other_category_text"
                    name="other_category_text"
                    className={`form-input ${errors.other_category_text ? 'error' : ''}`}
                    placeholder="Describe the type of issue not listed above"
                    value={formData.other_category_text}
                    onChange={handleChange}
                    disabled={loading}
                    maxLength={500}
                  />
                  {errors.other_category_text && (
                    <span className="error-message">{errors.other_category_text}</span>
                  )}
                </div>
              )}

              {/* Dynamic Custom Fields (based on sub-category) */}
              {customFields.length > 0 && (
                <div className="custom-fields-section">
                  <div className="custom-fields-header">
                    <span className="custom-fields-label">Additional Information</span>
                  </div>
                  <div className="custom-fields-grid">
                    {customFields.map(field => (
                      <div key={field.field_id} className="form-group">
                        <label className={`form-label ${field.is_required ? 'required' : ''}`}>
                          {field.field_label}
                          {!field.is_required && <span className="optional-label"> (Optional)</span>}
                        </label>
                        {field.field_type === 'select' ? (
                          <select
                            className={`form-select ${errors[`cf_${field.field_id}`] ? 'error' : ''}`}
                            value={customFieldValues[field.field_id] || ''}
                            onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                            disabled={loading}
                          >
                            <option value="">{field.placeholder || 'Select...'}</option>
                            {(field.options || []).map((opt, idx) => (
                              <option key={idx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.field_type === 'textarea' ? (
                          <textarea
                            className={`form-textarea ${errors[`cf_${field.field_id}`] ? 'error' : ''}`}
                            value={customFieldValues[field.field_id] || ''}
                            onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                            placeholder={field.placeholder || ''}
                            disabled={loading}
                            rows={3}
                          />
                        ) : field.field_type === 'checkbox' ? (
                          <label className="form-checkbox-inline">
                            <input
                              type="checkbox"
                              checked={customFieldValues[field.field_id] === 'true'}
                              onChange={e => handleCustomFieldChange(field.field_id, e.target.checked ? 'true' : 'false')}
                              disabled={loading}
                            />
                            <span>{field.placeholder || 'Yes'}</span>
                          </label>
                        ) : (
                          <input
                            type={field.field_type || 'text'}
                            className={`form-input ${errors[`cf_${field.field_id}`] ? 'error' : ''}`}
                            value={customFieldValues[field.field_id] || ''}
                            onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                            placeholder={field.placeholder || ''}
                            disabled={loading}
                          />
                        )}
                        {errors[`cf_${field.field_id}`] && (
                          <span className="error-message">{errors[`cf_${field.field_id}`]}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Location & Process */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="location_id" className="form-label required">
                    Location
                  </label>
                  <select
                    id="location_id"
                    name="location_id"
                    className={`form-select ${errors.location_id ? 'error' : ''}`}
                    value={formData.location_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select your location</option>
                    {locations.map(loc => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.location_name}
                      </option>
                    ))}
                  </select>
                  {errors.location_id && (
                    <span className="error-message">{errors.location_id}</span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="process_id" className="form-label">
                    Process / Client <span className="optional-label">(Optional)</span>
                  </label>
                  <select
                    id="process_id"
                    name="process_id"
                    className="form-select"
                    value={formData.process_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Select process / client</option>
                    {processes.map(proc => (
                      <option key={proc.process_id} value={proc.process_id}>
                        {proc.process_name}
                      </option>
                    ))}
                  </select>
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

              {/* Team Bucket (Admin/Manager only) */}
              {teams.length > 0 && ['ADMIN', 'MANAGER'].includes(user?.role?.role_code) && (
                <div className="form-group">
                  <label htmlFor="team_id" className="form-label">
                    Team Bucket <span className="optional-label">(Optional)</span>
                  </label>
                  <select
                    id="team_id"
                    name="team_id"
                    className="form-select"
                    value={formData.team_id}
                    onChange={handleChange}
                    disabled={loading}
                  >
                    <option value="">Auto (use routing rules)</option>
                    {teams.map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.team_name}{team.is_central ? ' \u2605' : ''}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Override automatic team routing by selecting a specific team
                  </span>
                </div>
              )}

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

                {/* Attached Files List — with preview thumbnails */}
                {attachments.length > 0 && (
                  <div className="attached-files-list">
                    <div className="attached-files-header">
                      <Paperclip size={16} />
                      <span>{attachments.length} file{attachments.length !== 1 ? 's' : ''} attached</span>
                    </div>
                    <div className="attached-files-grid">
                      {attachments.map((file, index) => (
                        <div key={index} className="attached-file-card">
                          {/* Thumbnail area */}
                          <div
                            className="file-card-thumb"
                            style={{ borderColor: getFileIconColor(file.name) + '44' }}
                            onClick={() => { setPreviewFile(file); setPreviewIndex(index); }}
                            title="Click to preview"
                          >
                            {isImageFile(file.name) ? (
                              <img
                                src={URL.createObjectURL(file)}
                                alt={file.name}
                                className="file-card-img-thumb"
                              />
                            ) : (
                              <div className="file-card-icon-wrap" style={{ color: getFileIconColor(file.name) }}>
                                <File size={28} />
                                <span className="file-card-ext">{getExtLabel(file.name)}</span>
                              </div>
                            )}
                            <div className="file-card-preview-hover">
                              <Eye size={18} />
                              <span>Preview</span>
                            </div>
                          </div>
                          {/* File info row */}
                          <div className="file-card-info">
                            <span className="file-card-name" title={file.name}>{file.name}</span>
                            <span className="file-card-size">{formatFileSize(file.size)}</span>
                          </div>
                          {/* Actions */}
                          <div className="file-card-actions">
                            <button
                              type="button"
                              className="file-card-action-btn file-card-preview-btn"
                              onClick={() => { setPreviewFile(file); setPreviewIndex(index); }}
                              disabled={loading}
                              title="Preview"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              className="file-card-action-btn file-card-remove-btn"
                              onClick={() => handleRemoveFile(index)}
                              disabled={loading}
                              title="Remove"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachment Preview Modal */}
                {previewFile && (
                  <AttachmentPreviewModal
                    file={previewFile}
                    onClose={() => { setPreviewFile(null); setPreviewIndex(null); }}
                    onFileEdit={handleFileEdit}
                  />
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
                    {formData.sub_category_id && (
                      <div className="preview-item">
                        <span className="preview-label">Sub-Category:</span>
                        <span className="preview-value">
                          {subCategories.find(sc => sc.sub_category_id === parseInt(formData.sub_category_id))?.sub_category_name}
                        </span>
                      </div>
                    )}
                    {formData.location_id && (
                      <div className="preview-item">
                        <span className="preview-label">Location:</span>
                        <span className="preview-value">
                          {locations.find(l => l.location_id === parseInt(formData.location_id))?.location_name}
                        </span>
                      </div>
                    )}
                    {formData.process_id && (
                      <div className="preview-item">
                        <span className="preview-label">Process:</span>
                        <span className="preview-value">
                          {processes.find(p => p.process_id === parseInt(formData.process_id))?.process_name}
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