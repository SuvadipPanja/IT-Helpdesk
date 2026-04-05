import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Save,
  Send,
  AlertCircle,
  Plus,
  Trash2,
  Loader,
  Shield,
  Server,
  Calendar,
  FileText,
  CheckSquare,
} from 'lucide-react';
import api from '../../services/api';
import crService from '../../services/crService';
import '../../styles/CreateCR.css';

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SYSTEM_TYPES = ['SERVER', 'APPLICATION', 'NETWORK', 'DATABASE', 'CLOUD', 'OTHER'];
const IMPACT_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const NULLABLE_FORM_FIELDS = [
  'reason',
  'expected_benefits',
  'impact_description',
  'risk_assessment_notes',
  'implementation_plan',
  'test_plan',
  'rollback_plan',
  'communication_plan',
  'estimated_downtime_mins',
  'users_affected_count',
  'cr_category_id',
  'cr_sub_category_id',
  'priority_id',
  'requested_for_id',
  'department_id',
  'location_id',
  'process_id',
  'related_ticket_id',
  'proposed_start',
  'proposed_end',
  'requested_approver_id',
];

const CreateCR = () => {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams();
  const isEditMode = Boolean(editId);

  // Pre-fill from query params (e.g., creating CR from ticket)
  const relatedTicketId = searchParams.get('ticket_id') || '';

  const [formData, setFormData] = useState(() => ({
    title: '',
    description: '',
    reason: '',
    expected_benefits: '',
    impact_description: '',
    risk_level: 'MEDIUM',
    risk_assessment_notes: '',
    implementation_plan: '',
    test_plan: '',
    rollback_plan: '',
    communication_plan: '',
    estimated_downtime_mins: '',
    users_affected_count: '',
    cr_type_id: '',
    cr_category_id: '',
    cr_sub_category_id: '',
    priority_id: '',
    requested_for_id: '',
    department_id: user?.department?.department_id ? String(user.department.department_id) : '',
    location_id: user?.location_id ? String(user.location_id) : '',
    process_id: user?.process_id ? String(user.process_id) : '',
    related_ticket_id: relatedTicketId,
    proposed_start: '',
    proposed_end: '',
    maintenance_window: false,
    requested_approver_id: '',
    send_to_approval: false,
  }));

  // Affected systems (dynamic rows)
  const [affectedSystems, setAffectedSystems] = useState([]);

  // Checklist items
  const [checklistItems, setChecklistItems] = useState([]);

  // Lookups
  const [lookups, setLookups] = useState({ types: [], categories: [], statuses: [] });
  const [priorities, setPriorities] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [crSettings, setCrSettings] = useState({ allow_approver_select: true });

  // UI state
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState(1);

  // Auto-fill from user context
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        location_id: prev.location_id || (user.location_id ? String(user.location_id) : ''),
        department_id: prev.department_id || (user.department?.department_id ? String(user.department.department_id) : ''),
        process_id: prev.process_id || (user.process_id ? String(user.process_id) : ''),
      }));
    }
  }, [user]);

  // Load existing CR data in edit mode
  useEffect(() => {
    if (isEditMode) {
      const loadCR = async () => {
        try {
          setLoading(true);
          const res = await crService.getById(editId);
          if (res.data?.success) {
            const cr = res.data.data;
            setFormData(prev => ({
              ...prev,
              title: cr.title || '',
              description: cr.description || '',
              reason: cr.reason || '',
              expected_benefits: cr.expected_benefits || '',
              impact_description: cr.impact_description || '',
              risk_level: cr.risk_level || 'MEDIUM',
              risk_assessment_notes: cr.risk_assessment_notes || '',
              implementation_plan: cr.implementation_plan || '',
              test_plan: cr.test_plan || '',
              rollback_plan: cr.rollback_plan || '',
              communication_plan: cr.communication_plan || '',
              estimated_downtime_mins: cr.estimated_downtime_mins ? String(cr.estimated_downtime_mins) : '',
              users_affected_count: cr.users_affected_count ? String(cr.users_affected_count) : '',
              cr_type_id: cr.cr_type_id ? String(cr.cr_type_id) : '',
              cr_category_id: cr.cr_category_id ? String(cr.cr_category_id) : '',
              cr_sub_category_id: cr.cr_sub_category_id ? String(cr.cr_sub_category_id) : '',
              priority_id: cr.priority_id ? String(cr.priority_id) : '',
              requested_for_id: cr.requested_for_id ? String(cr.requested_for_id) : '',
              department_id: cr.department_id ? String(cr.department_id) : '',
              location_id: cr.location_id ? String(cr.location_id) : '',
              process_id: cr.process_id ? String(cr.process_id) : '',
              related_ticket_id: cr.related_ticket_id ? String(cr.related_ticket_id) : '',
              proposed_start: cr.proposed_start ? cr.proposed_start.slice(0, 16) : '',
              proposed_end: cr.proposed_end ? cr.proposed_end.slice(0, 16) : '',
              maintenance_window: cr.maintenance_window || false,
              requested_approver_id: cr.requested_approver_id ? String(cr.requested_approver_id) : '',
            }));
            if (cr.affected_systems?.length) setAffectedSystems(cr.affected_systems);
            if (cr.checklist_items?.length) setChecklistItems(cr.checklist_items);
          }
        } catch (err) {
          toastError('Failed to load change request');
          navigate('/change-requests');
        } finally {
          setLoading(false);
        }
      };
      loadCR();
    }
  }, [editId]);

  // Fetch all dropdown data
  useEffect(() => {
    fetchDropdownData();
  }, []);

  const fetchDropdownData = async () => {
    const fallback = { data: { success: false, data: [] } };
    try {
      const [lookupsRes, prioritiesRes, departmentsRes, locationsRes, processesRes, approversRes, crSettingsRes] = await Promise.all([
        crService.getLookups().catch(() => fallback),
        api.get('/system/priorities').catch(() => fallback),
        api.get('/system/departments').catch(() => fallback),
        api.get('/system/locations').catch(() => fallback),
        api.get('/system/processes').catch(() => fallback),
        crService.getApprovers().catch(() => fallback),
        crService.getCRSettings().catch(() => fallback),
      ]);

      if (lookupsRes.data?.success) setLookups(lookupsRes.data.data);
      if (prioritiesRes.data?.success) setPriorities(prioritiesRes.data.data);
      if (departmentsRes.data?.success) setDepartments(departmentsRes.data.data);
      if (locationsRes.data?.success) setLocations(locationsRes.data.data);
      if (processesRes.data?.success) setProcesses(processesRes.data.data);
      if (approversRes.data?.success) setApprovers(approversRes.data.data);
      if (crSettingsRes.data?.success) setCrSettings(crSettingsRes.data.data);
    } catch (err) {
      console.error('Failed to load dropdown data:', err);
    }
  };

  // Load sub-categories when category changes
  useEffect(() => {
    if (formData.cr_category_id && lookups.categories.length) {
      const cat = lookups.categories.find(c => String(c.category_id) === String(formData.cr_category_id));
      setSubCategories(cat?.sub_categories || []);
    } else {
      setSubCategories([]);
    }
  }, [formData.cr_category_id, lookups.categories]);

  // Auto-suggest risk level based on type
  useEffect(() => {
    if (formData.cr_type_id && lookups.types.length) {
      const crType = lookups.types.find(t => String(t.type_id) === String(formData.cr_type_id));
      if (crType?.default_risk_level) {
        setFormData(prev => ({ ...prev, risk_level: crType.default_risk_level }));
      }
    }
  }, [formData.cr_type_id, lookups.types]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'cr_category_id') updated.cr_sub_category_id = '';
      return updated;
    });
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // Affected Systems management
  const addSystem = () => {
    setAffectedSystems(prev => [...prev, { system_name: '', system_type: '', impact_level: 'MEDIUM', expected_downtime_mins: 0, notes: '' }]);
  };

  const updateSystem = (index, field, value) => {
    setAffectedSystems(prev => prev.map((sys, i) => i === index ? { ...sys, [field]: value } : sys));
  };

  const removeSystem = (index) => {
    setAffectedSystems(prev => prev.filter((_, i) => i !== index));
  };

  // Checklist management
  const addChecklistItem = () => {
    setChecklistItems(prev => [...prev, { item_text: '' }]);
  };

  const updateChecklistItem = (index, value) => {
    setChecklistItems(prev => prev.map((item, i) => i === index ? { ...item, item_text: value } : item));
  };

  const removeChecklistItem = (index) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== index));
  };

  // Section map: which field belongs to which section number
  const FIELD_SECTION_MAP = {
    title: 1, cr_type_id: 1, cr_category_id: 1,
    department_id: 2, location_id: 2,
    description: 3, impact_description: 3,
    implementation_plan: 4, rollback_plan: 4,
    proposed_start: 5, proposed_end: 5,
  };

  // Navigate to the first section that has errors
  const navigateToFirstError = (errors) => {
    const firstField = Object.keys(errors)[0];
    const section = FIELD_SECTION_MAP[firstField];
    if (section) setActiveSection(section);
  };

  const applyApiErrors = (apiErrors = []) => {
    const mappedErrors = apiErrors.reduce((acc, error) => {
      if (error?.field && !acc[error.field]) acc[error.field] = error.message;
      return acc;
    }, {});

    setErrors(mappedErrors);
    if (Object.keys(mappedErrors).length > 0) navigateToFirstError(mappedErrors);
    return mappedErrors;
  };

  const buildPayload = () => {
    const payload = Object.entries(formData).reduce((acc, [field, value]) => {
      acc[field] = NULLABLE_FORM_FIELDS.includes(field) && value === '' ? null : value;
      return acc;
    }, {});

    payload.title = formData.title.trim();
    payload.description = formData.description ?? '';
    payload.affected_systems = affectedSystems
      .filter((system) => system.system_name?.trim())
      .map((system) => ({
        ...system,
        system_name: system.system_name.trim(),
        system_type: system.system_type || null,
        impact_level: system.impact_level || 'MEDIUM',
        expected_downtime_mins: system.expected_downtime_mins === '' ? 0 : system.expected_downtime_mins,
        notes: system.notes?.trim() || null,
      }));
    payload.checklist_items = checklistItems
      .filter((item) => item.item_text?.trim())
      .map((item) => ({ item_text: item.item_text.trim() }));

    return payload;
  };

  // Draft validation - only title + type required
  const validateDraft = () => {
    const newErrors = {};
    if (!formData.title?.trim() || formData.title.trim().length < 5) newErrors.title = 'Title is required (min 5 characters)';
    if (!formData.cr_type_id) newErrors.cr_type_id = 'Change type is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) navigateToFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Full validation - required for submit
  const validateForm = () => {
    const newErrors = {};
    if (!formData.title?.trim() || formData.title.trim().length < 5) newErrors.title = 'Title is required (min 5 characters)';
    if (!formData.cr_type_id) newErrors.cr_type_id = 'Change type is required';
    if (!formData.description?.trim() || formData.description.trim().length < 10) newErrors.description = 'Description is required (min 10 characters)';
    if (!formData.impact_description?.trim()) newErrors.impact_description = 'Impact description is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) navigateToFirstError(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit (save as draft)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!validateDraft()) {
      toastError('Please fix the form errors');
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload();

      const response = isEditMode
        ? await crService.update(editId, payload)
        : await crService.create(payload);
      if (response.data?.success) {
        const crId = isEditMode ? editId : response.data.data.cr_id;
        const crNumber = isEditMode ? '' : ` ${response.data.data.cr_number}`;
        toastSuccess(isEditMode ? 'Change request updated' : `Change request${crNumber} created as draft`);
        navigate(`/cr/${crId}`);
      }
    } catch (err) {
      const fieldErrors = applyApiErrors(err.response?.data?.errors || []);
      const msg = Object.values(fieldErrors)[0] || err.response?.data?.message || 'Failed to create change request';
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Save and submit in one action
  const handleSaveAndSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toastError('Please fix the form errors');
      return;
    }

    setLoading(true);
    try {
      const payload = buildPayload();

      let crId, crNumber;
      if (isEditMode) {
        await crService.update(editId, payload);
        crId = editId;
        crNumber = '';
      } else {
        const createRes = await crService.create(payload);
        if (!createRes.data?.success) throw new Error('Failed to create');
        crId = createRes.data.data.cr_id;
        crNumber = ` ${createRes.data.data.cr_number}`;
      }
      await crService.submit(crId, { direct_to_approval: payload.send_to_approval || false });
      toastSuccess(isEditMode ? 'Change request updated and submitted' : `Change request${crNumber} submitted for review`);
      navigate(`/cr/${crId}`);
    } catch (err) {
      const fieldErrors = applyApiErrors(err.response?.data?.errors || []);
      const msg = Object.values(fieldErrors)[0] || err.response?.data?.message || 'Failed to create/submit change request';
      toastError(msg);
    } finally {
      setLoading(false);
    }
  };

  const selectedType = lookups.types.find(t => String(t.type_id) === String(formData.cr_type_id));

  const sections = [
    { id: 1, label: 'Basic Info', icon: <FileText size={16} /> },
    { id: 2, label: 'Organization', icon: <Server size={16} /> },
    { id: 3, label: 'Change Details', icon: <AlertCircle size={16} /> },
    { id: 4, label: 'Implementation', icon: <CheckSquare size={16} /> },
    { id: 5, label: 'Schedule', icon: <Calendar size={16} /> },
    { id: 6, label: 'Systems', icon: <Server size={16} /> },
    { id: 7, label: 'Checklist', icon: <Shield size={16} /> },
  ];

  return (
    <div className="create-cr-page">
      {/* Header */}
      <div className="page-header-create">
        <button className="btn-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h1>{isEditMode ? 'Edit Change Request' : 'Create Change Request'}</h1>
      </div>

      {/* Section Navigation */}
      <div className="cr-section-nav">
        {sections.map(s => (
          <button
            key={s.id}
            className={`cr-section-tab ${activeSection === s.id ? 'active' : ''}`}
            onClick={() => setActiveSection(s.id)}
            type="button"
          >
            {s.icon}
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="cr-form">

        {/* Section 1: Basic Information */}
        {activeSection === 1 && (
          <div className="form-section">
            <h2 className="section-title">Basic Information</h2>

            <div className="form-group">
              <label className="form-label required">CR Title</label>
              <input type="text" name="title" className={`form-input ${errors.title ? 'input-error' : ''}`} value={formData.title} onChange={handleChange} placeholder="Brief title for this change request" maxLength={200} />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label required">Change Type</label>
                <select name="cr_type_id" className={`form-input ${errors.cr_type_id ? 'input-error' : ''}`} value={formData.cr_type_id} onChange={handleChange}>
                  <option value="">Select type...</option>
                  {lookups.types.map(t => (
                    <option key={t.type_id} value={t.type_id}>{t.type_name} — {t.description}</option>
                  ))}
                </select>
                {errors.cr_type_id && <span className="error-message">{errors.cr_type_id}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select name="priority_id" className="form-input" value={formData.priority_id} onChange={handleChange}>
                  <option value="">Select priority...</option>
                  {priorities.map(p => (
                    <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select name="cr_category_id" className="form-input" value={formData.cr_category_id} onChange={handleChange}>
                  <option value="">Select category...</option>
                  {lookups.categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sub-Category</label>
                <select name="cr_sub_category_id" className="form-input" value={formData.cr_sub_category_id} onChange={handleChange} disabled={!subCategories.length}>
                  <option value="">Select sub-category...</option>
                  {subCategories.map(sc => (
                    <option key={sc.sub_category_id} value={sc.sub_category_id}>{sc.sub_category_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {formData.related_ticket_id && (
              <div className="form-group">
                <label className="form-label">Related Ticket</label>
                <input type="text" className="form-input" value={`Ticket #${formData.related_ticket_id}`} readOnly />
              </div>
            )}

            {selectedType && (
              <div className="cr-type-info">
                <strong>{selectedType.type_name}:</strong> {selectedType.description}
                {selectedType.requires_cab_approval ? ' • Requires CAB approval' : ''}
                {selectedType.requires_manager_approval ? ' • Requires Manager approval' : ''}
                {' • Review SLA: '}{selectedType.review_sla_hours}h
              </div>
            )}

            {/* Approver Selection */}
            {crSettings.allow_approver_select && (
              <div className="form-group" style={{ marginTop: '16px', padding: '14px 16px', background: 'var(--bg-tertiary, #1e2130)', borderRadius: '8px', border: '1px solid var(--border-color, #2d3148)' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Select Approval Person
                  <span style={{ marginLeft: '8px', color: '#6b7280', fontWeight: 400, fontSize: '0.85em' }}>(optional)</span>
                </label>
                {approvers.length > 0 ? (
                  <select name="requested_approver_id" className="form-input" value={formData.requested_approver_id} onChange={handleChange}>
                    <option value="">— No specific approver (goes to TCC team queue) —</option>
                    {approvers
                      .filter(a => a.user_id !== user?.user_id)
                      .map(a => (
                        <option key={a.user_id} value={a.user_id}>
                          {a.full_name}{a.role_name ? ` (${a.role_name})` : ''}{a.department_name ? ` — ${a.department_name}` : ''}
                        </option>
                      ))}
                  </select>
                ) : (
                  <div style={{ color: '#9ca3af', fontSize: '0.9em', padding: '8px 0' }}>
                    No approvers are currently configured. The CR will go to the TCC team queue.
                  </div>
                )}
                <span className="field-hint">
                  {formData.requested_approver_id
                    ? '✓ Selected — this person will receive the CR in their approval queue. They can approve (→ goes to TCC team), reject (→ CR is cancelled), or request more details.'
                    : 'Choose a specific person to approve this CR. Leave blank to route to the general TCC team queue.'}
                </span>
                {crSettings.allow_approver_select && formData.requested_approver_id && (
                  <label className="form-checkbox-label" style={{ marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      name="send_to_approval"
                      checked={formData.send_to_approval}
                      onChange={handleChange}
                    />
                    <span>Send directly to approver's queue on submit (skip review step)</span>
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {/* Section 2: Organizational Context */}
        {activeSection === 2 && (
          <div className="form-section">
            <h2 className="section-title">Organizational Context</h2>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Location</label>
                <select name="location_id" className="form-input" value={formData.location_id} onChange={handleChange}>
                  <option value="">Select location...</option>
                  {locations.map(l => (
                    <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <select name="department_id" className="form-input" value={formData.department_id} onChange={handleChange}>
                  <option value="">Select department...</option>
                  {departments.map(d => (
                    <option key={d.department_id} value={d.department_id}>{d.department_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Process / Client</label>
                <select name="process_id" className="form-input" value={formData.process_id} onChange={handleChange}>
                  <option value="">Select process...</option>
                  {processes.map(p => (
                    <option key={p.process_id} value={p.process_id}>{p.process_name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Requested For</label>
                <input type="text" className="form-input" value="Self" readOnly />
                <span className="field-hint">Auto-assigned to you</span>
              </div>
            </div>

            </div>
        )}

        {/* Section 3: Change Details */}
        {activeSection === 3 && (
          <div className="form-section">
            <h2 className="section-title">Change Details</h2>

            <div className="form-group">
              <label className="form-label required">Description of Change</label>
              <textarea name="description" className={`form-input form-textarea ${errors.description ? 'input-error' : ''}`} value={formData.description} onChange={handleChange} rows={4} placeholder="What exactly is being changed?" />
              {errors.description && <span className="error-message">{errors.description}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Business Justification</label>
              <textarea name="reason" className="form-input form-textarea" value={formData.reason} onChange={handleChange} rows={3} placeholder="Why is this change needed?" />
            </div>

            <div className="form-group">
              <label className="form-label">Expected Benefits</label>
              <textarea name="expected_benefits" className="form-input form-textarea" value={formData.expected_benefits} onChange={handleChange} rows={2} placeholder="What improvement will result?" />
            </div>

            <div className="form-group">
              <label className="form-label required">Impact Description</label>
              <textarea name="impact_description" className={`form-input form-textarea ${errors.impact_description ? 'input-error' : ''}`} value={formData.impact_description} onChange={handleChange} rows={3} placeholder="Which systems, users, services will be affected?" />
              {errors.impact_description && <span className="error-message">{errors.impact_description}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select name="risk_level" className="form-input" value={formData.risk_level} onChange={handleChange}>
                  {RISK_LEVELS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Downtime (minutes)</label>
                <input type="number" name="estimated_downtime_mins" className="form-input" value={formData.estimated_downtime_mins} onChange={handleChange} min={0} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Users Affected</label>
                <input type="number" name="users_affected_count" className="form-input" value={formData.users_affected_count} onChange={handleChange} min={0} placeholder="0" />
              </div>
            </div>

            {(formData.risk_level === 'HIGH' || formData.risk_level === 'CRITICAL') && (
              <div className="form-group">
                <label className="form-label required">Risk Assessment Notes</label>
                <textarea name="risk_assessment_notes" className="form-input form-textarea" value={formData.risk_assessment_notes} onChange={handleChange} rows={3} placeholder="Detail the identified risks and mitigation strategies" />
              </div>
            )}
          </div>
        )}

        {/* Section 4: Implementation Plan */}
        {activeSection === 4 && (
          <div className="form-section">
            <h2 className="section-title">Implementation Plan</h2>

            <div className="form-group">
              <label className="form-label">Implementation Plan</label>
              <textarea name="implementation_plan" className="form-input form-textarea" value={formData.implementation_plan} onChange={handleChange} rows={5} placeholder="Step-by-step execution plan" />
            </div>

            <div className="form-group">
              <label className="form-label">Test Plan</label>
              <textarea name="test_plan" className="form-input form-textarea" value={formData.test_plan} onChange={handleChange} rows={3} placeholder="How to verify success after implementation" />
            </div>

            <div className="form-group">
              <label className="form-label">Rollback / Backout Plan</label>
              <textarea name="rollback_plan" className="form-input form-textarea" value={formData.rollback_plan} onChange={handleChange} rows={3} placeholder="How to undo if implementation fails" />
            </div>

            <div className="form-group">
              <label className="form-label">Communication Plan</label>
              <textarea name="communication_plan" className="form-input form-textarea" value={formData.communication_plan} onChange={handleChange} rows={2} placeholder="Who needs to be notified before/during/after" />
            </div>
          </div>
        )}

        {/* Section 5: Scheduling */}
        {activeSection === 5 && (
          <div className="form-section">
            <h2 className="section-title">Scheduling</h2>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Proposed Start</label>
                <input type="datetime-local" name="proposed_start" className="form-input" value={formData.proposed_start} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label className="form-label">Proposed End</label>
                <input type="datetime-local" name="proposed_end" className="form-input" value={formData.proposed_end} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-checkbox-label">
                <input type="checkbox" name="maintenance_window" checked={formData.maintenance_window} onChange={handleChange} />
                <span>Maintenance Window Required</span>
              </label>
              <span className="field-hint">Check if the change requires system downtime</span>
            </div>
          </div>
        )}

        {/* Section 6: Affected Systems */}
        {activeSection === 6 && (
          <div className="form-section">
            <h2 className="section-title">
              Affected Systems
              <button type="button" className="btn-add-row" onClick={addSystem}>
                <Plus size={14} /> Add System
              </button>
            </h2>

            {affectedSystems.length === 0 && (
              <p className="empty-hint">No affected systems added. Click "Add System" to add one.</p>
            )}

            {affectedSystems.map((sys, idx) => (
              <div key={idx} className="dynamic-row">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">System Name</label>
                    <input type="text" className="form-input" value={sys.system_name} onChange={(e) => updateSystem(idx, 'system_name', e.target.value)} placeholder="e.g., Email Server" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select className="form-input" value={sys.system_type} onChange={(e) => updateSystem(idx, 'system_type', e.target.value)}>
                      <option value="">Select...</option>
                      {SYSTEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Impact</label>
                    <select className="form-input" value={sys.impact_level} onChange={(e) => updateSystem(idx, 'impact_level', e.target.value)}>
                      {IMPACT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <button type="button" className="btn-remove-row" onClick={() => removeSystem(idx)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section 7: Pre-Implementation Checklist */}
        {activeSection === 7 && (
          <div className="form-section">
            <h2 className="section-title">
              Pre-Implementation Checklist
              <button type="button" className="btn-add-row" onClick={addChecklistItem}>
                <Plus size={14} /> Add Item
              </button>
            </h2>

            {checklistItems.length === 0 && (
              <p className="empty-hint">No checklist items added. Click "Add Item" to add one.</p>
            )}

            {checklistItems.map((item, idx) => (
              <div key={idx} className="checklist-row">
                <input type="text" className="form-input" value={item.item_text} onChange={(e) => updateChecklistItem(idx, e.target.value)} placeholder="Checklist item text..." />
                <button type="button" className="btn-remove-row" onClick={() => removeChecklistItem(idx)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <Loader size={16} className="spinner" /> : <Save size={16} />}
            <span>Save as Draft</span>
          </button>
          <button type="button" className="btn btn-success" onClick={handleSaveAndSubmit} disabled={loading}>
            {loading ? <Loader size={16} className="spinner" /> : <Send size={16} />}
            <span>Save &amp; Submit</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateCR;
