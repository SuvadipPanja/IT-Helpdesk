import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Save,
  X,
  AlertCircle,
  Loader,
  Ticket,
  Tag,
  AlertTriangle,
  User,
  FileText,
  CheckCircle,
  Clock,
  Building2,
  Info,
  Pencil,
  MapPin,
  Briefcase,
  Layers,
  Users
} from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/dateUtils';
import '../../styles/EditTicket.css';

const EditTicket = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category_id: '',
    priority_id: '',
    status_id: '',
    assigned_to: '',
    department_id: '',
    resolution_notes: '',
    sub_category_id: '',
    other_category_text: '',
    location_id: '',
    process_id: '',
    team_id: ''
  });

  // Original ticket data for comparison
  const [originalTicket, setOriginalTicket] = useState(null);

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [teams, setTeams] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customFieldValues, setCustomFieldValues] = useState({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Refs for unmount safety and race-condition prevention
  const isMountedRef = useRef(true);
  const categoryIdRef = useRef('');
  const subCategoryIdRef = useRef('');

  // Fetch ticket and dropdown data
  useEffect(() => {
    isMountedRef.current = true;
    if (id) {
      fetchTicketData();
      fetchDropdownData();
    }
    return () => {
      isMountedRef.current = false;
    };
  }, [id]);

  // Check for changes
  useEffect(() => {
    if (originalTicket) {
      const changed = 
        formData.subject !== originalTicket.subject ||
        formData.description !== originalTicket.description ||
        formData.category_id !== originalTicket.category_id ||
        formData.priority_id !== originalTicket.priority_id ||
        formData.status_id !== originalTicket.status_id ||
        formData.assigned_to !== (originalTicket.assigned_to_id || '') ||
        formData.department_id !== (originalTicket.department_id || '') ||
        formData.resolution_notes !== (originalTicket.resolution_notes || '') ||
        formData.sub_category_id !== (originalTicket.sub_category_id || '') ||
        formData.other_category_text !== (originalTicket.other_category_text || '') ||
        formData.location_id !== (originalTicket.location_id || '') ||
        formData.process_id !== (originalTicket.process_id || '') ||
        formData.team_id !== (originalTicket.team_id || '') ||
        JSON.stringify(customFieldValues) !== JSON.stringify(originalTicket._originalCustomFieldValues || {});
      
      setHasChanges(changed);
    }
  }, [formData, originalTicket, customFieldValues]);

  // Compute which fields changed
  const changedFields = useMemo(() => {
    if (!originalTicket) return {};
    return {
      subject: formData.subject !== originalTicket.subject,
      description: formData.description !== originalTicket.description,
      category_id: formData.category_id !== originalTicket.category_id,
      priority_id: formData.priority_id !== originalTicket.priority_id,
      status_id: formData.status_id !== originalTicket.status_id,
      assigned_to: formData.assigned_to !== (originalTicket.assigned_to_id || ''),
      department_id: formData.department_id !== (originalTicket.department_id || ''),
      resolution_notes: formData.resolution_notes !== (originalTicket.resolution_notes || ''),
      sub_category_id: formData.sub_category_id !== (originalTicket.sub_category_id || ''),
      location_id: formData.location_id !== (originalTicket.location_id || ''),
      process_id: formData.process_id !== (originalTicket.process_id || ''),
      team_id: formData.team_id !== (originalTicket.team_id || '')
    };
  }, [formData, originalTicket]);

  const changedCount = Object.values(changedFields).filter(Boolean).length;

  // Fetch ticket data
  const fetchTicketData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/tickets/${id}`);

      if (response.data.success) {
        const ticket = response.data.data;
        
        // Check permission - only creator or admin can edit
        const roleCode = user?.role?.role_code;
        const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER';
        const isOwner = ticket.requester_id === user?.user_id;
        const isAssigned = ticket.assigned_to_id === user?.user_id;
        const isFinalStatus = ticket.is_final_status;

        // For closed/resolved tickets, only owner or admin/manager can edit
        let canEdit;
        if (isFinalStatus) {
          canEdit = isOwner || isAdmin;
        } else {
          canEdit = isOwner || isAdmin || isAssigned;
        }

        if (!canEdit) {
          if (isMountedRef.current) {
            setError(isFinalStatus
              ? 'Only the ticket creator or admin can edit closed/resolved tickets'
              : 'You do not have permission to edit this ticket');
          }
          return;
        }

        // Normalize all IDs to strings for consistent comparison with <select> values
        const normalizedFormData = {
          subject: ticket.subject || '',
          description: ticket.description || '',
          category_id: ticket.category_id != null ? String(ticket.category_id) : '',
          priority_id: ticket.priority_id != null ? String(ticket.priority_id) : '',
          status_id: ticket.status_id != null ? String(ticket.status_id) : '',
          assigned_to: ticket.assigned_to_id != null ? String(ticket.assigned_to_id) : '',
          department_id: ticket.department_id != null ? String(ticket.department_id) : '',
          resolution_notes: ticket.resolution_notes || '',
          sub_category_id: ticket.sub_category_id != null ? String(ticket.sub_category_id) : '',
          other_category_text: ticket.other_category_text || '',
          location_id: ticket.location_id != null ? String(ticket.location_id) : '',
          process_id: ticket.process_id != null ? String(ticket.process_id) : '',
          team_id: ticket.team_id != null ? String(ticket.team_id) : ''
        };

        // Build original custom field values for change detection
        let originalCFValues = {};
        if (ticket.custom_fields && ticket.custom_fields.length > 0) {
          ticket.custom_fields.forEach(cf => {
            originalCFValues[cf.field_id] = cf.field_value || '';
          });
          if (isMountedRef.current) setCustomFieldValues({ ...originalCFValues });
        }

        // Store normalized original ticket (avoid mutating ticket object)
        if (isMountedRef.current) {
          setOriginalTicket({
            ...ticket,
            subject: normalizedFormData.subject,
            category_id: normalizedFormData.category_id,
            priority_id: normalizedFormData.priority_id,
            status_id: normalizedFormData.status_id,
            assigned_to_id: normalizedFormData.assigned_to,
            department_id: normalizedFormData.department_id,
            resolution_notes: normalizedFormData.resolution_notes,
            sub_category_id: normalizedFormData.sub_category_id,
            other_category_text: normalizedFormData.other_category_text,
            location_id: normalizedFormData.location_id,
            process_id: normalizedFormData.process_id,
            team_id: normalizedFormData.team_id,
            _originalCustomFieldValues: { ...originalCFValues }
          });
          setFormData(normalizedFormData);
        }

        // Load sub-categories for current category
        if (ticket.category_id) {
          try {
            const scRes = await api.get(`/system/sub-categories/${ticket.category_id}`);
            if (isMountedRef.current && scRes.data.success) setSubCategories(scRes.data.data);
          } catch {}
        }

        // Load custom fields for current sub-category
        if (ticket.sub_category_id) {
          try {
            const cfRes = await api.get(`/system/sub-category-fields/${ticket.sub_category_id}`);
            if (isMountedRef.current && cfRes.data.success) setCustomFields(cfRes.data.data);
          } catch {}
        }
      }
    } catch (err) {
      if (isMountedRef.current) setError(err.response?.data?.message || 'Failed to load ticket');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    const fallback = { data: { success: false, data: [] } };
    try {
      const [categoriesRes, prioritiesRes, statusesRes, engineersRes, departmentsRes, locationsRes, processesRes, teamsRes] = await Promise.all([
        api.get('/system/categories').catch(() => fallback),
        api.get('/system/priorities').catch(() => fallback),
        api.get('/system/statuses').catch(() => fallback),
        api.get('/system/engineers').catch(() => fallback),
        api.get('/system/departments').catch(() => fallback),
        api.get('/system/locations').catch(() => fallback),
        api.get('/system/processes').catch(() => fallback),
        api.get('/system/teams').catch(() => fallback)
      ]);

      if (isMountedRef.current) {
        if (categoriesRes.data.success) setCategories(categoriesRes.data.data);
        if (prioritiesRes.data.success) setPriorities(prioritiesRes.data.data);
        if (statusesRes.data.success) setStatuses(statusesRes.data.data);
        if (engineersRes.data.success) setEngineers(engineersRes.data.data);
        if (departmentsRes.data.success) setDepartments(departmentsRes.data.data);
        if (locationsRes.data.success) setLocations(locationsRes.data.data);
        if (processesRes.data.success) setProcesses(processesRes.data.data);
        if (teamsRes.data.success) setTeams(teamsRes.data.data);
      }
    } catch (err) {
    }
  };

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Category change — reload sub-categories (prevent race: only apply if still the selected category)
    if (name === 'category_id') {
      categoryIdRef.current = value;
      setFormData(prev => ({ ...prev, sub_category_id: '', other_category_text: '' }));
      setSubCategories([]);
      setCustomFields([]);
      setCustomFieldValues({});
      if (value) {
        const requestedCat = value;
        api.get(`/system/sub-categories/${value}`).then(res => {
          if (isMountedRef.current && res.data.success && categoryIdRef.current === requestedCat) {
            setSubCategories(res.data.data);
          }
        }).catch(() => {});
      }
    }

    // Sub-category change — reload custom fields (prevent race: only apply if still the selected sub-category)
    if (name === 'sub_category_id') {
      subCategoryIdRef.current = value;
      setFormData(prev => ({ ...prev, other_category_text: '' }));
      setCustomFields([]);
      setCustomFieldValues({});
      if (value) {
        const requestedSub = value;
        api.get(`/system/sub-category-fields/${value}`).then(res => {
          if (isMountedRef.current && res.data.success && subCategoryIdRef.current === requestedSub) {
            setCustomFields(res.data.data);
          }
        }).catch(() => {});
      }
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

  // Check if selected sub-category is "Other"
  const isOtherSubCategory = () => {
    const subId = formData.sub_category_id;
    if (!subId) return false;
    const parsed = parseInt(subId, 10);
    if (isNaN(parsed)) return false;
    const sc = subCategories.find(s => s.sub_category_id === parsed);
    return sc && sc.sub_category_name.toLowerCase().includes('other');
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.subject || !formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.description || !formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.category_id) {
      newErrors.category_id = 'Category is required';
    }

    if (!formData.priority_id) {
      newErrors.priority_id = 'Priority is required';
    }

    if (!formData.status_id) {
      newErrors.status_id = 'Status is required';
    }

    if (!formData.location_id) {
      newErrors.location_id = 'Location is required';
    }

    if (isOtherSubCategory() && (!formData.other_category_text || !formData.other_category_text.trim())) {
      newErrors.other_category_text = 'Please specify the issue type';
    }

    // Check if status is RESOLVED or CLOSED, resolution notes should be required
    const selectedStatus = statuses.find(s => s.status_id === parseInt(formData.status_id));
    if (selectedStatus && (selectedStatus.status_code === 'RESOLVED' || selectedStatus.status_code === 'CLOSED')) {
      if (!formData.resolution_notes || !formData.resolution_notes.trim()) {
        newErrors.resolution_notes = 'Resolution notes are required when closing a ticket';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!hasChanges) {
      showToast('No changes detected', 'info');
      return;
    }

    try {
      setSaving(true);

      // Build update payload with only changed fields
      const updatePayload = {};
      
      if (formData.subject !== originalTicket.subject) {
        updatePayload.subject = formData.subject;
      }
      if (formData.description !== originalTicket.description) {
        updatePayload.description = formData.description;
      }
      if (String(formData.category_id) !== String(originalTicket.category_id)) {
        updatePayload.category_id = parseInt(formData.category_id);
      }
      if (String(formData.priority_id) !== String(originalTicket.priority_id)) {
        updatePayload.priority_id = parseInt(formData.priority_id);
      }
      if (String(formData.status_id) !== String(originalTicket.status_id)) {
        updatePayload.status_id = parseInt(formData.status_id);
      }
      if (String(formData.assigned_to || '') !== String(originalTicket.assigned_to_id || '')) {
        updatePayload.assigned_to = formData.assigned_to ? parseInt(formData.assigned_to) : null;
      }
      if (String(formData.department_id || '') !== String(originalTicket.department_id || '')) {
        updatePayload.department_id = formData.department_id ? parseInt(formData.department_id) : null;
      }
      if (formData.resolution_notes !== (originalTicket.resolution_notes || '')) {
        updatePayload.resolution_notes = formData.resolution_notes;
      }
      if (String(formData.sub_category_id || '') !== String(originalTicket.sub_category_id || '')) {
        updatePayload.sub_category_id = formData.sub_category_id ? parseInt(formData.sub_category_id) : null;
      }
      if (formData.other_category_text !== (originalTicket.other_category_text || '')) {
        updatePayload.other_category_text = formData.other_category_text || null;
      }
      if (String(formData.location_id || '') !== String(originalTicket.location_id || '')) {
        updatePayload.location_id = formData.location_id ? parseInt(formData.location_id) : null;
      }
      if (String(formData.process_id || '') !== String(originalTicket.process_id || '')) {
        updatePayload.process_id = formData.process_id ? parseInt(formData.process_id) : null;
      }
      if (String(formData.team_id || '') !== String(originalTicket.team_id || '')) {
        updatePayload.team_id = formData.team_id ? parseInt(formData.team_id) : null;
      }

      // Always include custom fields if there are any
      if (customFields.length > 0) {
        updatePayload.custom_fields = customFields.map(field => ({
          field_id: field.field_id,
          value: customFieldValues[field.field_id] || ''
        })).filter(f => f.value !== '');
      }

      const response = await api.put(`/tickets/${id}`, updatePayload);

      if (response.data.success) {
        showToast('Ticket updated successfully!', 'success');
        navigate(`/tickets/${id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update ticket');
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        navigate(`/tickets/${id}`);
      }
    } else {
      navigate(`/tickets/${id}`);
    }
  };

  // Check if user can assign tickets
  const canAssign = user?.permissions?.can_assign_tickets || user?.permissions?.can_manage_tickets;

  // Role-based edit restrictions
  const roleCode = user?.role?.role_code || '';
  const isEngineer = roleCode === 'ENGINEER';
  const isCreator = originalTicket?.requester_id === user?.user_id;
  const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';

  // Helper: get priority class
  const getPriorityClass = (priorityId) => {
    const p = priorities.find(pr => pr.priority_id === parseInt(priorityId));
    if (!p) return '';
    const name = (p.priority_name || '').toLowerCase();
    if (name.includes('critical')) return 'critical';
    if (name.includes('high')) return 'high';
    if (name.includes('medium')) return 'medium';
    if (name.includes('low')) return 'low';
    return '';
  };

  // Helper: get status class
  const getStatusClass = (statusId) => {
    const s = statuses.find(st => st.status_id === parseInt(statusId));
    if (!s) return '';
    const code = (s.status_code || '').toLowerCase();
    if (code === 'open') return 'open';
    if (code === 'in_progress' || code === 'in-progress') return 'in-progress';
    if (code === 'resolved') return 'resolved';
    if (code === 'closed') return 'closed';
    if (code === 'escalated') return 'escalated';
    if (code === 'reopened') return 'reopened';
    return '';
  };

  // Helper: field CSS
  const fieldClass = (name, base) => {
    const classes = [base];
    if (errors[name]) classes.push('has-error');
    else if (changedFields[name]) classes.push('changed');
    return classes.join(' ');
  };

  // Check if resolution notes are required
  const isResolutionRequired = (() => {
    const selectedStatus = statuses.find(s => s.status_id === parseInt(formData.status_id));
    return selectedStatus && (selectedStatus.status_code === 'RESOLVED' || selectedStatus.status_code === 'CLOSED');
  })();

  // Loading state
  if (loading) {
    return (
      <div className="edit-ticket-page">
        <div className="et-page-header">
          <div className="et-header-inner">
            <div className="et-header-left">
              <div className="et-header-title-group">
                <div className="et-header-icon"><Pencil size={22} /></div>
                <div className="et-header-text"><h1>Edit Ticket</h1></div>
              </div>
            </div>
          </div>
        </div>
        <div className="et-content">
          <div className="et-loading">
            <div className="et-loading-spinner-ring" />
            <p>Loading ticket details...</p>
            <span>Fetching data from server</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state (no ticket loaded)
  if (error && !originalTicket) {
    return (
      <div className="edit-ticket-page">
        <div className="et-page-header">
          <div className="et-header-inner">
            <div className="et-header-left">
              <div className="et-header-title-group">
                <div className="et-header-icon"><Pencil size={22} /></div>
                <div className="et-header-text"><h1>Edit Ticket</h1></div>
              </div>
            </div>
          </div>
        </div>
        <div className="et-content">
          <div className="et-error-state">
            <div className="et-error-icon-wrapper">
              <AlertCircle size={40} />
            </div>
            <h2>Cannot Edit Ticket</h2>
            <p>{error}</p>
            <button className="et-btn et-btn-save" onClick={() => navigate('/tickets')}>
              <ArrowLeft size={18} />
              Back to Tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Get display names for metadata
  const currentPriority = priorities.find(p => p.priority_id === parseInt(formData.priority_id));
  const currentStatus = statuses.find(s => s.status_id === parseInt(formData.status_id));
  const currentDept = departments.find(d => d.department_id === parseInt(formData.department_id));
  const currentEngineer = engineers.find(e => e.user_id === parseInt(formData.assigned_to));

  return (
    <div className="edit-ticket-page">
      {/*  Gradient Header  */}
      <div className="et-page-header">
        <div className="et-header-inner">
          <div className="et-header-left">
            <button className="et-btn-back" onClick={handleCancel}>
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
            <div className="et-header-title-group">
              <div className="et-header-icon">
                <Pencil size={22} />
              </div>
              <div className="et-header-text">
                <h1>Edit Ticket</h1>
                <div className="et-header-ticket-id">
                  #{originalTicket?.ticket_number}
                </div>
              </div>
            </div>
          </div>
          <div className="et-header-right">
            {hasChanges && (
              <span className="et-unsaved-badge">
                <AlertCircle size={14} />
                Unsaved Changes
              </span>
            )}
          </div>
        </div>
      </div>

      {/*  Content  */}
      <div className="et-content">
        {/* Error Banner */}
        {error && (
          <div className="et-alert et-alert-error">
            <AlertCircle size={18} className="et-alert-icon" />
            <span className="et-alert-text">{error}</span>
            <button onClick={() => setError('')} className="et-alert-close">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Metadata Strip */}
        <div className="et-meta-strip">
          <div className="et-meta-item">
            <Clock size={14} />
            <span>Created: <strong>{originalTicket?.created_at ? formatDate(originalTicket.created_at) : '—'}</strong></span>
          </div>
          <div className="et-meta-divider" />
          <div className="et-meta-item">
            <User size={14} />
            <span>Requester: <strong>{originalTicket?.requester_name || '�'}</strong></span>
          </div>
          <div className="et-meta-divider" />
          {currentPriority && (
            <span className={`et-meta-priority ${getPriorityClass(formData.priority_id)}`}>
              {currentPriority.priority_name}
            </span>
          )}
          {currentStatus && (
            <span className={`et-meta-status ${getStatusClass(formData.status_id)}`}>
              {currentStatus.status_name}
            </span>
          )}
        </div>

        {/*  Form  */}
        <form onSubmit={handleSubmit} className="et-form">
          {/* Role-based restriction notices */}
          {isEngineer && !isAdminOrManager && (
            <div className="et-alert et-alert-info" style={{ marginBottom: '16px' }}>
              <Info size={18} className="et-alert-icon" />
              <span className="et-alert-text">
                As an Engineer, you can only update the <strong>Status</strong> and <strong>Resolution Notes</strong>. All other fields are read-only.
              </span>
            </div>
          )}
          {isCreator && !isAdminOrManager && !isEngineer && (
            <div className="et-alert et-alert-info" style={{ marginBottom: '16px' }}>
              <Info size={18} className="et-alert-icon" />
              <span className="et-alert-text">
                As the ticket creator, you cannot change the <strong>Subject</strong> and <strong>Department</strong> after creation.
              </span>
            </div>
          )}
          <div className="et-form-grid">
            {/*  Left: Ticket Details  */}
            <div className="et-section">
              <div className="et-section-header">
                <div className="et-section-icon details">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="et-section-title">Ticket Details</h2>
                  <p className="et-section-subtitle">Core ticket information</p>
                </div>
              </div>
              <div className="et-section-body">
                {/* Subject */}
                <div className="et-field">
                  <label htmlFor="subject" className="et-label">
                    <FileText size={14} className="et-label-icon" />
                    Subject <span className="et-required">*</span>
                    {changedFields.subject && <span className="et-field-changed-dot" />}
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className={fieldClass('subject', 'et-input')}
                    placeholder="Enter ticket subject"
                    disabled={(isEngineer && !isAdminOrManager) || (isCreator && !isAdminOrManager)}
                  />
                  {errors.subject && (
                    <span className="et-error-msg"><AlertCircle size={12} /> {errors.subject}</span>
                  )}
                </div>

                {/* Description */}
                <div className="et-field">
                  <label htmlFor="description" className="et-label">
                    <FileText size={14} className="et-label-icon" />
                    Description <span className="et-required">*</span>
                    {changedFields.description && <span className="et-field-changed-dot" />}
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={6}
                    className={fieldClass('description', 'et-textarea tall')}
                    placeholder="Describe the issue in detail..."
                    disabled={isEngineer && !isAdminOrManager}
                  />
                  {errors.description && (
                    <span className="et-error-msg"><AlertCircle size={12} /> {errors.description}</span>
                  )}
                </div>

                {/* Category & Priority � side by side */}
                <div className="et-field-row">
                  <div className="et-field">
                    <label htmlFor="category_id" className="et-label">
                      <Tag size={14} className="et-label-icon" />
                      Category <span className="et-required">*</span>
                      {changedFields.category_id && <span className="et-field-changed-dot" />}
                    </label>
                    <select
                      id="category_id"
                      name="category_id"
                      value={formData.category_id}
                      onChange={handleChange}
                      className={fieldClass('category_id', 'et-select')}
                      disabled={isEngineer && !isAdminOrManager}
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category.category_id} value={category.category_id}>
                          {category.category_name}
                        </option>
                      ))}
                    </select>
                    {errors.category_id && (
                      <span className="et-error-msg"><AlertCircle size={12} /> {errors.category_id}</span>
                    )}
                  </div>

                  <div className="et-field">
                    <label htmlFor="priority_id" className="et-label">
                      <AlertTriangle size={14} className="et-label-icon" />
                      Priority <span className="et-required">*</span>
                      {changedFields.priority_id && <span className="et-field-changed-dot" />}
                    </label>
                    <select
                      id="priority_id"
                      name="priority_id"
                      value={formData.priority_id}
                      onChange={handleChange}
                      className={fieldClass('priority_id', 'et-select')}
                      disabled={isEngineer && !isAdminOrManager}
                    >
                      <option value="">Select Priority</option>
                      {priorities.map((priority) => (
                        <option key={priority.priority_id} value={priority.priority_id}>
                          {priority.priority_name}
                        </option>
                      ))}
                    </select>
                    {errors.priority_id && (
                      <span className="et-error-msg"><AlertCircle size={12} /> {errors.priority_id}</span>
                    )}
                  </div>
                </div>

                {/* Sub-Category & Location row */}
                <div className="et-field-row">
                  {subCategories.length > 0 && (
                    <div className="et-field">
                      <label htmlFor="sub_category_id" className="et-label">
                        <Layers size={14} className="et-label-icon" />
                        Sub-Category
                        {changedFields.sub_category_id && <span className="et-field-changed-dot" />}
                      </label>
                      <select
                        id="sub_category_id"
                        name="sub_category_id"
                        value={formData.sub_category_id}
                        onChange={handleChange}
                        className="et-select"
                        disabled={isEngineer && !isAdminOrManager}
                      >
                        <option value="">Select Sub-Category</option>
                        {subCategories.map(sc => (
                          <option key={sc.sub_category_id} value={sc.sub_category_id}>
                            {sc.sub_category_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="et-field">
                    <label htmlFor="location_id" className="et-label">
                      <MapPin size={14} className="et-label-icon" />
                      Location <span className="et-required">*</span>
                      {changedFields.location_id && <span className="et-field-changed-dot" />}
                    </label>
                    <select
                      id="location_id"
                      name="location_id"
                      value={formData.location_id}
                      onChange={handleChange}
                      className={fieldClass('location_id', 'et-select')}
                      disabled={isEngineer && !isAdminOrManager}
                    >
                      <option value="">Select Location</option>
                      {locations.map(loc => (
                        <option key={loc.location_id} value={loc.location_id}>
                          {loc.location_name}
                        </option>
                      ))}
                    </select>
                    {errors.location_id && (
                      <span className="et-error-msg"><AlertCircle size={12} /> {errors.location_id}</span>
                    )}
                  </div>
                </div>

                {/* Other category text */}
                {isOtherSubCategory() && (
                  <div className="et-field">
                    <label htmlFor="other_category_text" className="et-label">
                      <FileText size={14} className="et-label-icon" />
                      Specify Issue Type <span className="et-required">*</span>
                    </label>
                    <input
                      type="text"
                      id="other_category_text"
                      name="other_category_text"
                      value={formData.other_category_text}
                      onChange={handleChange}
                      className={fieldClass('other_category_text', 'et-input')}
                      placeholder="Describe the issue type..."
                      disabled={isEngineer && !isAdminOrManager}
                    />
                    {errors.other_category_text && (
                      <span className="et-error-msg"><AlertCircle size={12} /> {errors.other_category_text}</span>
                    )}
                  </div>
                )}

                {/* Process / Client */}
                <div className="et-field">
                  <label htmlFor="process_id" className="et-label">
                    <Briefcase size={14} className="et-label-icon" />
                    Process / Client
                    {changedFields.process_id && <span className="et-field-changed-dot" />}
                  </label>
                  <select
                    id="process_id"
                    name="process_id"
                    value={formData.process_id}
                    onChange={handleChange}
                    className="et-select"
                    disabled={isEngineer && !isAdminOrManager}
                  >
                    <option value="">Select Process (Optional)</option>
                    {processes.map(proc => (
                      <option key={proc.process_id} value={proc.process_id}>
                        {proc.process_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic custom fields */}
                {customFields.length > 0 && (
                  <div className="et-custom-fields-section">
                    <label className="et-label">
                      <Tag size={14} className="et-label-icon" />
                      Additional Fields
                    </label>
                    <div className="et-custom-fields-grid">
                      {customFields.map(field => (
                        <div key={field.field_id} className="et-field">
                          <label className="et-label et-cf-label">
                            {field.field_label} {field.is_required ? <span className="et-required">*</span> : null}
                          </label>
                          {field.field_type === 'select' ? (
                            <select
                              value={customFieldValues[field.field_id] || ''}
                              onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                              className="et-select"
                            >
                              <option value="">Select...</option>
                              {(field.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : field.field_type === 'textarea' ? (
                            <textarea
                              value={customFieldValues[field.field_id] || ''}
                              onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                              className="et-textarea"
                              rows={2}
                              placeholder={field.field_label}
                            />
                          ) : field.field_type === 'checkbox' ? (
                            <label className="et-checkbox-inline">
                              <input
                                type="checkbox"
                                checked={customFieldValues[field.field_id] === 'true'}
                                onChange={e => handleCustomFieldChange(field.field_id, e.target.checked ? 'true' : 'false')}
                              />
                              <span>{field.field_label}</span>
                            </label>
                          ) : (
                            <input
                              type={field.field_type || 'text'}
                              value={customFieldValues[field.field_id] || ''}
                              onChange={e => handleCustomFieldChange(field.field_id, e.target.value)}
                              className="et-input"
                              placeholder={field.field_label}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/*  Right: Status & Assignment  */}
            <div className="et-section">
              <div className="et-section-header">
                <div className="et-section-icon status">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h2 className="et-section-title">Status & Assignment</h2>
                  <p className="et-section-subtitle">Workflow and ownership</p>
                </div>
              </div>
              <div className="et-section-body">
                {/* Status */}
                <div className="et-field">
                  <label htmlFor="status_id" className="et-label">
                    <CheckCircle size={14} className="et-label-icon" />
                    Status <span className="et-required">*</span>
                    {changedFields.status_id && <span className="et-field-changed-dot" />}
                  </label>
                  <select
                    id="status_id"
                    name="status_id"
                    value={formData.status_id}
                    onChange={handleChange}
                    className={fieldClass('status_id', 'et-select')}
                  >
                    <option value="">Select Status</option>
                    {statuses.map((status) => (
                      <option key={status.status_id} value={status.status_id}>
                        {status.status_name}
                      </option>
                    ))}
                  </select>
                  {errors.status_id && (
                    <span className="et-error-msg"><AlertCircle size={12} /> {errors.status_id}</span>
                  )}
                </div>

                {/* Assigned To � Admin only */}
                {canAssign && (
                  <div className="et-field">
                    <label htmlFor="assigned_to" className="et-label">
                      <User size={14} className="et-label-icon" />
                      Assign To
                      {changedFields.assigned_to && <span className="et-field-changed-dot" />}
                    </label>
                    <select
                      id="assigned_to"
                      name="assigned_to"
                      value={formData.assigned_to}
                      onChange={handleChange}
                      className={fieldClass('assigned_to', 'et-select')}
                    >
                      <option value="">Unassigned</option>
                      {engineers.map((engineer) => (
                        <option key={engineer.user_id} value={engineer.user_id}>
                          {engineer.full_name || engineer.username}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Department */}
                <div className="et-field">
                  <label htmlFor="department_id" className="et-label">
                    <Building2 size={14} className="et-label-icon" />
                    Department
                    {changedFields.department_id && <span className="et-field-changed-dot" />}
                  </label>
                  <select
                    id="department_id"
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    className={fieldClass('department_id', 'et-select')}
                    disabled={(isEngineer && !isAdminOrManager) || (isCreator && !isAdminOrManager)}
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.department_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Team Bucket */}
                {canAssign && teams.length > 0 && (
                  <div className="et-field">
                    <label htmlFor="team_id" className="et-label">
                      <Users size={14} className="et-label-icon" />
                      Team Bucket
                      {changedFields.team_id && <span className="et-field-changed-dot" />}
                    </label>
                    <select
                      id="team_id"
                      name="team_id"
                      value={formData.team_id}
                      onChange={handleChange}
                      className={fieldClass('team_id', 'et-select')}
                    >
                      <option value="">No Team</option>
                      {teams.map((team) => (
                        <option key={team.team_id} value={team.team_id}>
                          {team.team_name}{team.is_central ? ' ★' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Resolution Notes */}
                <div className="et-field">
                  <label htmlFor="resolution_notes" className="et-label">
                    <CheckCircle size={14} className="et-label-icon" />
                    Resolution Notes
                    {isResolutionRequired && <span className="et-required"> *</span>}
                    {changedFields.resolution_notes && <span className="et-field-changed-dot" />}
                  </label>
                  <textarea
                    id="resolution_notes"
                    name="resolution_notes"
                    value={formData.resolution_notes}
                    onChange={handleChange}
                    rows={4}
                    className={fieldClass('resolution_notes', 'et-textarea')}
                    placeholder="Enter resolution details (required when closing ticket)..."
                  />
                  {errors.resolution_notes && (
                    <span className="et-error-msg"><AlertCircle size={12} /> {errors.resolution_notes}</span>
                  )}
                  <span className="et-help-text">
                    Provide details about how the issue was resolved
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/*  Sticky Action Bar  */}
          <div className="et-action-bar">
            <div className="et-action-info">
              {hasChanges ? (
                <>
                  <Info size={16} className="et-action-info-icon" />
                  <span><span className="changed-count">{changedCount}</span> field{changedCount !== 1 ? 's' : ''} modified</span>
                </>
              ) : (
                <>
                  <Info size={16} className="et-action-info-icon" />
                  <span>No changes yet</span>
                </>
              )}
            </div>
            <div className="et-action-buttons">
              <button
                type="button"
                className="et-btn et-btn-cancel"
                onClick={handleCancel}
                disabled={saving}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                type="submit"
                className={`et-btn et-btn-save ${saving ? 'saving' : ''}`}
                disabled={saving || !hasChanges}
              >
                {saving ? (
                  <>
                    <Loader className="et-spinner" size={16} />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTicket;
