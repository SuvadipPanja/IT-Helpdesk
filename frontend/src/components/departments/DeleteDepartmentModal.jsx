import { useState } from 'react';
import { X, AlertTriangle, Trash2, Loader } from 'lucide-react';
import api from '../../services/api';
import '../../styles/DepartmentModals.css';

const DeleteDepartmentModal = ({ department, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle delete
  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.delete(`/departments/${department.department_id}`);

      if (response.data.success) {
        alert('Department deleted successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error deleting department:', err);
      setError(err.response?.data?.message || 'Failed to delete department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <AlertTriangle size={24} className="modal-icon text-danger" />
            <h2 className="modal-title">Delete Department</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <p>
            Are you sure you want to delete the department{' '}
            <strong>"{department.department_name}"</strong>?
          </p>

          {department.total_users > 0 && (
            <div className="alert alert-warning">
              <AlertTriangle size={18} />
              <span>
                This department has <strong>{department.total_users} active user(s)</strong>.
                Please reassign users before deleting.
              </span>
            </div>
          )}

          <p className="warning-text">
            This action cannot be undone. The department will be deactivated.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="spinner" size={18} />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Delete Department
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteDepartmentModal;