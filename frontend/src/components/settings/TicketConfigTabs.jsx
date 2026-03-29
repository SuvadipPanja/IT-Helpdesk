// ============================================
// TICKET CONFIGURATION MANAGEMENT COMPONENT
// Admin UI for Sub-Categories, Custom Fields,
// Locations, and Processes/Clients
// Developer: Suvadip Panja
// ============================================

import { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, ChevronDown, ChevronRight,
  MapPin, Briefcase, Layers, Settings, Save,
  X, Check, AlertCircle, GripVertical, ToggleLeft, ToggleRight,
  Type, Hash, List, Calendar, Mail, Phone, Link, AlignLeft, CheckSquare
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketConfig.css';

// ============================================
// FIELD TYPE OPTIONS (for custom fields)
// ============================================
const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'textarea', label: 'Text Area', icon: AlignLeft },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'tel', label: 'Phone', icon: Phone },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
];

// ============================================
// SUB-CATEGORIES MANAGEMENT TAB
// ============================================
const SubCategoriesTab = () => {
  const [subCategories, setSubCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [expandedSubCatId, setExpandedSubCatId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [fields, setFields] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    category_id: '',
    sub_category_name: '',
    description: '',
    display_order: 0,
  });
  const [fieldFormData, setFieldFormData] = useState({
    sub_category_id: '',
    field_name: '',
    field_label: '',
    field_type: 'text',
    is_required: false,
    placeholder: '',
    options: [],
    display_order: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fallback = { data: { data: [] } };
      const [subCatRes, catRes] = await Promise.all([
        api.get('/ticket-config/sub-categories').catch(() => fallback),
        api.get('/system/categories').catch(() => fallback),
      ]);
      setSubCategories(subCatRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (subCategoryId) => {
    try {
      const res = await api.get(`/ticket-config/fields/${subCategoryId}`);
      setFields(prev => ({ ...prev, [subCategoryId]: res.data.data || [] }));
    } catch (error) {
      setFields(prev => ({ ...prev, [subCategoryId]: [] }));
    }
  };

  const toggleCategory = (catId) => {
    setExpandedCategoryId(expandedCategoryId === catId ? null : catId);
  };

  const toggleSubCategory = async (subCatId) => {
    if (expandedSubCatId === subCatId) {
      setExpandedSubCatId(null);
    } else {
      setExpandedSubCatId(subCatId);
      if (!fields[subCatId]) {
        await fetchFields(subCatId);
      }
    }
  };

  // Group sub-categories by category
  const grouped = categories.map(cat => ({
    ...cat,
    subCategories: subCategories.filter(sc => sc.category_id === cat.category_id),
  }));

  const handleAddSubCategory = () => {
    setEditingItem(null);
    setFormData({ category_id: expandedCategoryId || '', sub_category_name: '', description: '', display_order: 0 });
    setShowAddModal(true);
  };

  const handleEditSubCategory = (sc) => {
    setEditingItem(sc);
    setFormData({
      category_id: sc.category_id,
      sub_category_name: sc.sub_category_name,
      description: sc.description || '',
      display_order: sc.display_order || 0,
    });
    setShowAddModal(true);
  };

  const handleSaveSubCategory = async () => {
    if (!formData.category_id || !formData.sub_category_name.trim()) {
      setMessage({ type: 'error', text: 'Category and name are required' });
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/ticket-config/sub-categories/${editingItem.sub_category_id}`, formData);
        setMessage({ type: 'success', text: 'Sub-category updated!' });
      } else {
        await api.post('/ticket-config/sub-categories', formData);
        setMessage({ type: 'success', text: 'Sub-category created!' });
      }
      setShowAddModal(false);
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    }
  };

  const handleDeleteSubCategory = async (sc) => {
    if (!window.confirm(`Delete "${sc.sub_category_name}"? ${sc.ticket_count > 0 ? 'It will be deactivated since tickets use it.' : ''}`)) return;

    try {
      await api.delete(`/ticket-config/sub-categories/${sc.sub_category_id}`);
      setMessage({ type: 'success', text: 'Sub-category removed!' });
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleToggleActive = async (sc) => {
    try {
      await api.put(`/ticket-config/sub-categories/${sc.sub_category_id}`, { is_active: !sc.is_active });
      fetchData();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to toggle status' });
    }
  };

  // ---- Field CRUD ----
  const handleAddField = (subCatId) => {
    setEditingField(null);
    setFieldFormData({
      sub_category_id: subCatId,
      field_name: '',
      field_label: '',
      field_type: 'text',
      is_required: false,
      placeholder: '',
      options: [],
      display_order: 0,
    });
    setShowFieldModal(true);
  };

  const handleEditField = (field) => {
    setEditingField(field);
    setFieldFormData({
      sub_category_id: field.sub_category_id,
      field_name: field.field_name,
      field_label: field.field_label,
      field_type: field.field_type,
      is_required: !!field.is_required,
      placeholder: field.placeholder || '',
      options: field.options || [],
      display_order: field.display_order || 0,
    });
    setShowFieldModal(true);
  };

  const handleSaveField = async () => {
    if (!fieldFormData.field_label.trim()) {
      setMessage({ type: 'error', text: 'Field label is required' });
      return;
    }

    // Auto-generate field_name from label if not set
    const data = {
      ...fieldFormData,
      field_name: fieldFormData.field_name || fieldFormData.field_label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    };

    try {
      if (editingField) {
        await api.put(`/ticket-config/fields/${editingField.field_id}`, data);
        setMessage({ type: 'success', text: 'Field updated!' });
      } else {
        await api.post('/ticket-config/fields', data);
        setMessage({ type: 'success', text: 'Field created!' });
      }
      setShowFieldModal(false);
      fetchFields(data.sub_category_id);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save field' });
    }
  };

  const handleDeleteField = async (field) => {
    if (!window.confirm(`Delete field "${field.field_label}"?`)) return;
    try {
      await api.delete(`/ticket-config/fields/${field.field_id}`);
      setMessage({ type: 'success', text: 'Field removed!' });
      fetchFields(field.sub_category_id);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete field' });
    }
  };

  // Options management for select fields
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    if (newOption.trim() && !fieldFormData.options.includes(newOption.trim())) {
      setFieldFormData(prev => ({
        ...prev,
        options: [...prev.options, newOption.trim()]
      }));
      setNewOption('');
    }
  };

  const removeOption = (idx) => {
    setFieldFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx)
    }));
  };

  if (loading) {
    return <div className="tc-loading">Loading sub-categories...</div>;
  }

  return (
    <div className="tc-section">
      {message.text && (
        <div className={`tc-message tc-message-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {message.text}
          <button className="tc-message-close" onClick={() => setMessage({ type: '', text: '' })}><X size={14} /></button>
        </div>
      )}

      <div className="tc-toolbar">
        <h3><Layers size={20} /> Sub-Categories & Custom Fields</h3>
        <button className="tc-btn tc-btn-primary" onClick={handleAddSubCategory}>
          <Plus size={16} /> Add Sub-Category
        </button>
      </div>

      <p className="tc-description">
        Organize tickets with sub-categories under each category. Add custom input fields that appear when a specific sub-category is selected during ticket creation.
      </p>

      <div className="tc-tree">
        {grouped.map(cat => (
          <div key={cat.category_id} className="tc-category-group">
            <div className="tc-category-header" onClick={() => toggleCategory(cat.category_id)}>
              {expandedCategoryId === cat.category_id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <span className="tc-category-name">{cat.category_name}</span>
              <span className="tc-badge">{cat.subCategories.length}</span>
            </div>

            {expandedCategoryId === cat.category_id && (
              <div className="tc-subcategory-list">
                {cat.subCategories.length === 0 ? (
                  <div className="tc-empty">No sub-categories yet</div>
                ) : (
                  cat.subCategories.map(sc => (
                    <div key={sc.sub_category_id} className={`tc-subcategory-item ${!sc.is_active ? 'tc-inactive' : ''}`}>
                      <div className="tc-subcategory-row">
                        <div className="tc-subcategory-toggle" onClick={() => toggleSubCategory(sc.sub_category_id)}>
                          {expandedSubCatId === sc.sub_category_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <div className="tc-subcategory-info">
                          <span className="tc-subcategory-name">{sc.sub_category_name}</span>
                          {sc.description && <span className="tc-subcategory-desc">{sc.description}</span>}
                        </div>
                        <div className="tc-subcategory-meta">
                          <span className="tc-badge tc-badge-sm">{sc.field_count || 0} fields</span>
                          <span className="tc-badge tc-badge-sm">{sc.ticket_count || 0} tickets</span>
                        </div>
                        <div className="tc-actions">
                          <button className="tc-btn-icon" title={sc.is_active ? 'Deactivate' : 'Activate'} onClick={() => handleToggleActive(sc)}>
                            {sc.is_active ? <ToggleRight size={18} className="tc-toggle-on" /> : <ToggleLeft size={18} className="tc-toggle-off" />}
                          </button>
                          <button className="tc-btn-icon" title="Edit" onClick={() => handleEditSubCategory(sc)}><Edit2 size={15} /></button>
                          <button className="tc-btn-icon tc-btn-danger" title="Delete" onClick={() => handleDeleteSubCategory(sc)}><Trash2 size={15} /></button>
                        </div>
                      </div>

                      {/* Custom Fields Section */}
                      {expandedSubCatId === sc.sub_category_id && (
                        <div className="tc-fields-section">
                          <div className="tc-fields-header">
                            <span>Custom Fields</span>
                            <button className="tc-btn tc-btn-sm tc-btn-primary" onClick={() => handleAddField(sc.sub_category_id)}>
                              <Plus size={14} /> Add Field
                            </button>
                          </div>
                          {(!fields[sc.sub_category_id] || fields[sc.sub_category_id].length === 0) ? (
                            <div className="tc-empty tc-empty-sm">No custom fields defined</div>
                          ) : (
                            <div className="tc-fields-list">
                              {fields[sc.sub_category_id].map(field => (
                                <div key={field.field_id} className={`tc-field-item ${!field.is_active ? 'tc-inactive' : ''}`}>
                                  <div className="tc-field-info">
                                    <span className="tc-field-label">{field.field_label}</span>
                                    <span className="tc-field-meta">
                                      {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                                      {field.is_required ? ' • Required' : ' • Optional'}
                                      {field.options && field.options.length > 0 ? ` • ${field.options.length} options` : ''}
                                    </span>
                                  </div>
                                  <div className="tc-actions">
                                    <button className="tc-btn-icon" title="Edit" onClick={() => handleEditField(field)}><Edit2 size={14} /></button>
                                    <button className="tc-btn-icon tc-btn-danger" title="Delete" onClick={() => handleDeleteField(field)}><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <button className="tc-btn tc-btn-outline tc-btn-sm tc-add-btn" onClick={() => {
                  setEditingItem(null);
                  setFormData({ category_id: cat.category_id, sub_category_name: '', description: '', display_order: 0 });
                  setShowAddModal(true);
                }}>
                  <Plus size={14} /> Add to {cat.category_name}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Sub-Category Modal */}
      {showAddModal && (
        <div className="tc-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3>{editingItem ? 'Edit Sub-Category' : 'Add Sub-Category'}</h3>
              <button className="tc-btn-icon" onClick={() => setShowAddModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              <div className="tc-form-group">
                <label>Category *</label>
                <select value={formData.category_id} onChange={e => setFormData(prev => ({ ...prev, category_id: e.target.value }))}>
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                  ))}
                </select>
              </div>
              <div className="tc-form-group">
                <label>Sub-Category Name *</label>
                <input type="text" value={formData.sub_category_name} onChange={e => setFormData(prev => ({ ...prev, sub_category_name: e.target.value }))} placeholder="e.g., No Internet / Network Down" />
              </div>
              <div className="tc-form-group">
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description" />
              </div>
              <div className="tc-form-group">
                <label>Display Order</label>
                <input type="number" value={formData.display_order} onChange={e => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} min="0" />
              </div>
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn tc-btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="tc-btn tc-btn-primary" onClick={handleSaveSubCategory}>
                <Save size={16} /> {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Field Modal */}
      {showFieldModal && (
        <div className="tc-modal-overlay" onClick={() => setShowFieldModal(false)}>
          <div className="tc-modal tc-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3>{editingField ? 'Edit Custom Field' : 'Add Custom Field'}</h3>
              <button className="tc-btn-icon" onClick={() => setShowFieldModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              <div className="tc-form-row">
                <div className="tc-form-group tc-form-flex">
                  <label>Field Label *</label>
                  <input type="text" value={fieldFormData.field_label} onChange={e => setFieldFormData(prev => ({ ...prev, field_label: e.target.value }))} placeholder="e.g., Port Number" />
                </div>
                <div className="tc-form-group tc-form-flex">
                  <label>Field Type</label>
                  <select value={fieldFormData.field_type} onChange={e => setFieldFormData(prev => ({ ...prev, field_type: e.target.value }))}>
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="tc-form-row">
                <div className="tc-form-group tc-form-flex">
                  <label>Placeholder</label>
                  <input type="text" value={fieldFormData.placeholder} onChange={e => setFieldFormData(prev => ({ ...prev, placeholder: e.target.value }))} placeholder="Placeholder text shown to user" />
                </div>
                <div className="tc-form-group tc-form-flex">
                  <label>Display Order</label>
                  <input type="number" value={fieldFormData.display_order} onChange={e => setFieldFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} min="0" />
                </div>
              </div>
              <div className="tc-form-group">
                <label className="tc-checkbox-label">
                  <input type="checkbox" checked={fieldFormData.is_required} onChange={e => setFieldFormData(prev => ({ ...prev, is_required: e.target.checked }))} />
                  Required field
                </label>
              </div>

              {/* Options for select/dropdown type */}
              {fieldFormData.field_type === 'select' && (
                <div className="tc-form-group">
                  <label>Dropdown Options</label>
                  <div className="tc-options-list">
                    {fieldFormData.options.map((opt, idx) => (
                      <div key={idx} className="tc-option-item">
                        <span>{opt}</span>
                        <button className="tc-btn-icon tc-btn-danger" onClick={() => removeOption(idx)}><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="tc-option-add">
                    <input
                      type="text"
                      value={newOption}
                      onChange={e => setNewOption(e.target.value)}
                      placeholder="Type option and press Add"
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())}
                    />
                    <button className="tc-btn tc-btn-sm tc-btn-primary" type="button" onClick={addOption}>Add</button>
                  </div>
                </div>
              )}
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn tc-btn-secondary" onClick={() => setShowFieldModal(false)}>Cancel</button>
              <button className="tc-btn tc-btn-primary" onClick={handleSaveField}>
                <Save size={16} /> {editingField ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================
// LOCATIONS MANAGEMENT TAB
// ============================================
const LocationsTab = () => {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    location_name: '',
    location_code: '',
    address: '',
    display_order: 0,
  });

  useEffect(() => { fetchLocations(); }, []);

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ticket-config/locations');
      setLocations(res.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load locations' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ location_name: '', location_code: '', address: '', display_order: 0 });
    setShowModal(true);
  };

  const handleEdit = (loc) => {
    setEditingItem(loc);
    setFormData({
      location_name: loc.location_name,
      location_code: loc.location_code || '',
      address: loc.address || '',
      display_order: loc.display_order || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.location_name.trim()) {
      setMessage({ type: 'error', text: 'Location name is required' });
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/ticket-config/locations/${editingItem.location_id}`, formData);
        setMessage({ type: 'success', text: 'Location updated!' });
      } else {
        await api.post('/ticket-config/locations', formData);
        setMessage({ type: 'success', text: 'Location created!' });
      }
      setShowModal(false);
      fetchLocations();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    }
  };

  const handleDelete = async (loc) => {
    if (!window.confirm(`Delete "${loc.location_name}"?${loc.ticket_count > 0 ? ' It will be deactivated since tickets use it.' : ''}`)) return;
    try {
      await api.delete(`/ticket-config/locations/${loc.location_id}`);
      setMessage({ type: 'success', text: 'Location removed!' });
      fetchLocations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleToggleActive = async (loc) => {
    try {
      await api.put(`/ticket-config/locations/${loc.location_id}`, { is_active: !loc.is_active });
      fetchLocations();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to toggle status' });
    }
  };

  if (loading) return <div className="tc-loading">Loading locations...</div>;

  return (
    <div className="tc-section">
      {message.text && (
        <div className={`tc-message tc-message-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {message.text}
          <button className="tc-message-close" onClick={() => setMessage({ type: '', text: '' })}><X size={14} /></button>
        </div>
      )}

      <div className="tc-toolbar">
        <h3><MapPin size={20} /> Locations</h3>
        <button className="tc-btn tc-btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Add Location
        </button>
      </div>

      <p className="tc-description">
        Manage office locations that users can select when creating tickets. Location is a required field during ticket creation.
      </p>

      {locations.length === 0 ? (
        <div className="tc-empty-state">
          <MapPin size={48} />
          <p>No locations configured yet</p>
          <button className="tc-btn tc-btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Add First Location
          </button>
        </div>
      ) : (
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Location Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>Tickets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => (
                <tr key={loc.location_id} className={!loc.is_active ? 'tc-row-inactive' : ''}>
                  <td className="tc-cell-name">{loc.location_name}</td>
                  <td><span className="tc-code">{loc.location_code || '-'}</span></td>
                  <td>{loc.address || '-'}</td>
                  <td><span className="tc-badge">{loc.ticket_count || 0}</span></td>
                  <td>
                    <span className={`tc-status ${loc.is_active ? 'tc-status-active' : 'tc-status-inactive'}`}>
                      {loc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="tc-actions">
                      <button className="tc-btn-icon" title={loc.is_active ? 'Deactivate' : 'Activate'} onClick={() => handleToggleActive(loc)}>
                        {loc.is_active ? <ToggleRight size={18} className="tc-toggle-on" /> : <ToggleLeft size={18} className="tc-toggle-off" />}
                      </button>
                      <button className="tc-btn-icon" title="Edit" onClick={() => handleEdit(loc)}><Edit2 size={15} /></button>
                      <button className="tc-btn-icon tc-btn-danger" title="Delete" onClick={() => handleDelete(loc)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Location Modal */}
      {showModal && (
        <div className="tc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3>{editingItem ? 'Edit Location' : 'Add Location'}</h3>
              <button className="tc-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              <div className="tc-form-group">
                <label>Location Name *</label>
                <input type="text" value={formData.location_name} onChange={e => setFormData(prev => ({ ...prev, location_name: e.target.value }))} placeholder="e.g., Head Office" />
              </div>
              <div className="tc-form-group">
                <label>Location Code</label>
                <input type="text" value={formData.location_code} onChange={e => setFormData(prev => ({ ...prev, location_code: e.target.value }))} placeholder="e.g., HO" />
              </div>
              <div className="tc-form-group">
                <label>Address</label>
                <input type="text" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} placeholder="Full address" />
              </div>
              <div className="tc-form-group">
                <label>Display Order</label>
                <input type="number" value={formData.display_order} onChange={e => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} min="0" />
              </div>
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn tc-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="tc-btn tc-btn-primary" onClick={handleSave}>
                <Save size={16} /> {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================
// PROCESSES / CLIENTS MANAGEMENT TAB
// ============================================
const ProcessesTab = () => {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    process_name: '',
    process_code: '',
    description: '',
    display_order: 0,
  });

  useEffect(() => { fetchProcesses(); }, []);

  const fetchProcesses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ticket-config/processes');
      setProcesses(res.data.data || []);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load processes' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setFormData({ process_name: '', process_code: '', description: '', display_order: 0 });
    setShowModal(true);
  };

  const handleEdit = (proc) => {
    setEditingItem(proc);
    setFormData({
      process_name: proc.process_name,
      process_code: proc.process_code || '',
      description: proc.description || '',
      display_order: proc.display_order || 0,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.process_name.trim()) {
      setMessage({ type: 'error', text: 'Process name is required' });
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/ticket-config/processes/${editingItem.process_id}`, formData);
        setMessage({ type: 'success', text: 'Process updated!' });
      } else {
        await api.post('/ticket-config/processes', formData);
        setMessage({ type: 'success', text: 'Process created!' });
      }
      setShowModal(false);
      fetchProcesses();
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to save' });
    }
  };

  const handleDelete = async (proc) => {
    if (!window.confirm(`Delete "${proc.process_name}"?${proc.ticket_count > 0 ? ' It will be deactivated since tickets use it.' : ''}`)) return;
    try {
      await api.delete(`/ticket-config/processes/${proc.process_id}`);
      setMessage({ type: 'success', text: 'Process removed!' });
      fetchProcesses();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete' });
    }
  };

  const handleToggleActive = async (proc) => {
    try {
      await api.put(`/ticket-config/processes/${proc.process_id}`, { is_active: !proc.is_active });
      fetchProcesses();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to toggle status' });
    }
  };

  if (loading) return <div className="tc-loading">Loading processes...</div>;

  return (
    <div className="tc-section">
      {message.text && (
        <div className={`tc-message tc-message-${message.type}`}>
          {message.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {message.text}
          <button className="tc-message-close" onClick={() => setMessage({ type: '', text: '' })}><X size={14} /></button>
        </div>
      )}

      <div className="tc-toolbar">
        <h3><Briefcase size={20} /> Processes / Clients</h3>
        <button className="tc-btn tc-btn-primary" onClick={handleAdd}>
          <Plus size={16} /> Add Process
        </button>
      </div>

      <p className="tc-description">
        Manage processes or client projects. Users can optionally select a process/client when creating tickets to associate work with a specific project.
      </p>

      {processes.length === 0 ? (
        <div className="tc-empty-state">
          <Briefcase size={48} />
          <p>No processes configured yet</p>
          <button className="tc-btn tc-btn-primary" onClick={handleAdd}>
            <Plus size={16} /> Add First Process
          </button>
        </div>
      ) : (
        <div className="tc-table-wrap">
          <table className="tc-table">
            <thead>
              <tr>
                <th>Process Name</th>
                <th>Code</th>
                <th>Description</th>
                <th>Tickets</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(proc => (
                <tr key={proc.process_id} className={!proc.is_active ? 'tc-row-inactive' : ''}>
                  <td className="tc-cell-name">{proc.process_name}</td>
                  <td><span className="tc-code">{proc.process_code || '-'}</span></td>
                  <td>{proc.description || '-'}</td>
                  <td><span className="tc-badge">{proc.ticket_count || 0}</span></td>
                  <td>
                    <span className={`tc-status ${proc.is_active ? 'tc-status-active' : 'tc-status-inactive'}`}>
                      {proc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="tc-actions">
                      <button className="tc-btn-icon" title={proc.is_active ? 'Deactivate' : 'Activate'} onClick={() => handleToggleActive(proc)}>
                        {proc.is_active ? <ToggleRight size={18} className="tc-toggle-on" /> : <ToggleLeft size={18} className="tc-toggle-off" />}
                      </button>
                      <button className="tc-btn-icon" title="Edit" onClick={() => handleEdit(proc)}><Edit2 size={15} /></button>
                      <button className="tc-btn-icon tc-btn-danger" title="Delete" onClick={() => handleDelete(proc)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Process Modal */}
      {showModal && (
        <div className="tc-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="tc-modal" onClick={e => e.stopPropagation()}>
            <div className="tc-modal-header">
              <h3>{editingItem ? 'Edit Process' : 'Add Process'}</h3>
              <button className="tc-btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <div className="tc-modal-body">
              <div className="tc-form-group">
                <label>Process Name *</label>
                <input type="text" value={formData.process_name} onChange={e => setFormData(prev => ({ ...prev, process_name: e.target.value }))} placeholder="e.g., Client A" />
              </div>
              <div className="tc-form-group">
                <label>Process Code</label>
                <input type="text" value={formData.process_code} onChange={e => setFormData(prev => ({ ...prev, process_code: e.target.value }))} placeholder="e.g., CLA" />
              </div>
              <div className="tc-form-group">
                <label>Description</label>
                <input type="text" value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description" />
              </div>
              <div className="tc-form-group">
                <label>Display Order</label>
                <input type="number" value={formData.display_order} onChange={e => setFormData(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} min="0" />
              </div>
            </div>
            <div className="tc-modal-footer">
              <button className="tc-btn tc-btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="tc-btn tc-btn-primary" onClick={handleSave}>
                <Save size={16} /> {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// ============================================
// MAIN EXPORT - TABS OBJECT FOR SETTINGS PAGE
// ============================================
export { SubCategoriesTab, LocationsTab, ProcessesTab };
