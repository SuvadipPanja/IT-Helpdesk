import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  CheckCircle
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/EditTicket.css';

const EditTicket = () => {
  const { id } = useParams();
  const { user } = useAuth();
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
    resolution_notes: ''
  });

  // Original ticket data for comparison
  const [originalTicket, setOriginalTicket] = useState(null);

  // Dropdown options
  const [categories, setCategories] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [departments, setDepartments] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch ticket and dropdown data
  useEffect(() => {
    if (id) {
      fetchTicketData();
      fetchDropdownData();
    }
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
        formData.resolution_notes !== (originalTicket.resolution_notes || '');
      
      setHasChanges(changed);
    }
  }, [formData, originalTicket]);

  // Fetch ticket data
  const fetchTicketData = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/tickets/${id}`);

      if (response.data.success) {
        const ticket = response.data.data;
        
        // Check permission - only creator or admin can edit
        const canEdit = 
          ticket.requester_id === user?.user_id || 
          user?.permissions?.can_assign_tickets ||
          user?.permissions?.can_manage_tickets;

        if (!canEdit) {
          setError('You do not have permission to edit this ticket');
          return;
        }

        setOriginalTicket(ticket);
        setFormData({
          subject: ticket.subject || '',
          description: ticket.description || '',
          category_id: ticket.category_id || '',
          priority_id: ticket.priority_id || '',
          status_id: ticket.status_id || '',
          assigned_to: ticket.assigned_to_id || '',
          department_id: ticket.department_id || '',
          resolution_notes: ticket.resolution_notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err.response?.data?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  // Fetch dropdown data
  const fetchDropdownData = async () => {
    try {
      const [categoriesRes, prioritiesRes, statusesRes, engineersRes, departmentsRes] = await Promise.all([
        api.get('/system/categories'),
        api.get('/system/priorities'),
        api.get('/system/statuses'),
        api.get('/system/engineers'),
        api.get('/system/departments')
      ]);

      if (categoriesRes.data.success) setCategories(categoriesRes.data.data);
      if (prioritiesRes.data.success) setPriorities(prioritiesRes.data.data);
      if (statusesRes.data.success) setStatuses(statusesRes.data.data);
      if (engineersRes.data.success) setEngineers(engineersRes.data.data);
      if (departmentsRes.data.success) setDepartments(departmentsRes.data.data);
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

    // Check if status is RESOLVED or CLOSED, resolution notes should be required
    const selectedStatus = statuses.find(s => s.status_id === parseInt(formData.status_id));
    if (selectedStatus && (selectedStatus.status_code === 'RESOLVED' || selectedStatus.status_code === 'CLOSED')) {
      if (!formData.resolution_notes || !formData.resolution_notes.trim()) {
        newErrors.resolution_notes = 'Resolution notes are required when closing/resolving a ticket';
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
      alert('No changes detected');
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
      if (formData.category_id !== originalTicket.category_id) {
        updatePayload.category_id = parseInt(formData.category_id);
      }
      if (formData.priority_id !== originalTicket.priority_id) {
        updatePayload.priority_id = parseInt(formData.priority_id);
      }
      if (formData.status_id !== originalTicket.status_id) {
        updatePayload.status_id = parseInt(formData.status_id);
      }
      if (formData.assigned_to !== (originalTicket.assigned_to_id || '')) {
        updatePayload.assigned_to = formData.assigned_to ? parseInt(formData.assigned_to) : null;
      }
      if (formData.department_id !== (originalTicket.department_id || '')) {
        updatePayload.department_id = formData.department_id ? parseInt(formData.department_id) : null;
      }
      if (formData.resolution_notes !== (originalTicket.resolution_notes || '')) {
        updatePayload.resolution_notes = formData.resolution_notes;
      }

      const response = await api.put(`/tickets/${id}`, updatePayload);

      if (response.data.success) {
        alert('Ticket updated successfully!');
        navigate(`/tickets/${id}`);
      }
    } catch (err) {
      console.error('Error updating ticket:', err);
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

  if (loading) {
    return (
      <div className="edit-ticket-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (error && !originalTicket) {
    return (
      <div className="edit-ticket-page">
        <div className="error-container">
          <AlertCircle size={64} className="error-icon" />
          <h2>Cannot Edit Ticket</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={18} />
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-ticket-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={handleCancel}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <div className="page-title-section">
            <Ticket size={28} className="page-icon" />
            <div>
              <h1 className="page-title">Edit Ticket</h1>
              <p className="page-subtitle">
                #{originalTicket?.ticket_number}
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          {hasChanges && (
            <span className="unsaved-badge">
              <AlertCircle size={16} />
              Unsaved Changes
            </span>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="alert-close">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="edit-ticket-form">
        <div className="form-grid">
          {/* Left Column */}
          <div className="form-column">
            <div className="form-card">
              <h2 className="form-card-title">Ticket Details</h2>

              {/* Subject */}
              <div className="form-group">
                <label htmlFor="subject" className="form-label required">
                  <FileText size={16} />
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={`form-input ${errors.subject ? 'error' : ''}`}
                  placeholder="Enter ticket subject"
                />
                {errors.subject && (
                  <span className="error-message">{errors.subject}</span>
                )}
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="description" className="form-label required">
                  <FileText size={16} />
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={6}
                  className={`form-textarea ${errors.description ? 'error' : ''}`}
                  placeholder="Describe the issue in detail..."
                />
                {errors.description && (
                  <span className="error-message">{errors.description}</span>
                )}
              </div>

              {/* Category */}
              <div className="form-group">
                <label htmlFor="category_id" className="form-label required">
                  <Tag size={16} />
                  Category
                </label>
                <select
                  id="category_id"
                  name="category_id"
                  value={formData.category_id}
                  onChange={handleChange}
                  className={`form-select ${errors.category_id ? 'error' : ''}`}
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.category_id} value={category.category_id}>
                      {category.category_name}
                    </option>
                  ))}
                </select>
                {errors.category_id && (
                  <span className="error-message">{errors.category_id}</span>
                )}
              </div>

              {/* Priority */}
              <div className="form-group">
                <label htmlFor="priority_id" className="form-label required">
                  <AlertTriangle size={16} />
                  Priority
                </label>
                <select
                  id="priority_id"
                  name="priority_id"
                  value={formData.priority_id}
                  onChange={handleChange}
                  className={`form-select ${errors.priority_id ? 'error' : ''}`}
                >
                  <option value="">Select Priority</option>
                  {priorities.map((priority) => (
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
          </div>

          {/* Right Column */}
          <div className="form-column">
            <div className="form-card">
              <h2 className="form-card-title">Status & Assignment</h2>

              {/* Status */}
              <div className="form-group">
                <label htmlFor="status_id" className="form-label required">
                  <CheckCircle size={16} />
                  Status
                </label>
                <select
                  id="status_id"
                  name="status_id"
                  value={formData.status_id}
                  onChange={handleChange}
                  className={`form-select ${errors.status_id ? 'error' : ''}`}
                >
                  <option value="">Select Status</option>
                  {statuses.map((status) => (
                    <option key={status.status_id} value={status.status_id}>
                      {status.status_name}
                    </option>
                  ))}
                </select>
                {errors.status_id && (
                  <span className="error-message">{errors.status_id}</span>
                )}
              </div>

              {/* Assigned To - Only for Admin/Manager */}
              {canAssign && (
                <div className="form-group">
                  <label htmlFor="assigned_to" className="form-label">
                    <User size={16} />
                    Assign To
                  </label>
                  <select
                    id="assigned_to"
                    name="assigned_to"
                    value={formData.assigned_to}
                    onChange={handleChange}
                    className="form-select"
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
              <div className="form-group">
                <label htmlFor="department_id" className="form-label">
                  <Ticket size={16} />
                  Department
                </label>
                <select
                  id="department_id"
                  name="department_id"
                  value={formData.department_id}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.department_id} value={dept.department_id}>
                      {dept.department_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resolution Notes */}
              <div className="form-group">
                <label htmlFor="resolution_notes" className="form-label">
                  <CheckCircle size={16} />
                  Resolution Notes
                  {formData.status_id && 
                   statuses.find(s => s.status_id === parseInt(formData.status_id))?.status_code === 'RESOLVED' && (
                    <span className="required-indicator"> *</span>
                  )}
                </label>
                <textarea
                  id="resolution_notes"
                  name="resolution_notes"
                  value={formData.resolution_notes}
                  onChange={handleChange}
                  rows={4}
                  className={`form-textarea ${errors.resolution_notes ? 'error' : ''}`}
                  placeholder="Enter resolution details (required when resolving ticket)..."
                />
                {errors.resolution_notes && (
                  <span className="error-message">{errors.resolution_notes}</span>
                )}
                <small className="form-help">
                  Provide details about how the issue was resolved
                </small>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            <X size={18} />
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !hasChanges}
          >
            {saving ? (
              <>
                <Loader className="spinner" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditTicket;