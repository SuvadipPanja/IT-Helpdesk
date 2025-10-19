import { useState } from 'react';
import { X, AlertTriangle, Trash2, Loader } from 'lucide-react';
import api from '../../services/api';
import '../../styles/RoleModals.css';

const DeleteRoleModal = ({ role, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle delete
  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.delete(`/roles/${role.role_id}`);

      if (response.data.success) {
        alert('Role deleted successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error deleting role:', err);
      setError(err.response?.data?.message || 'Failed to delete role');
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
            <h2 className="modal-title">Delete Role</h2>
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

          {role.is_system_role ? (
            <div className="alert alert-error">
              <AlertTriangle size={18} />
              <span>
                Cannot delete system roles. System roles are protected and cannot be removed.
              </span>
            </div>
          ) : (
            <>
              <p>
                Are you sure you want to delete the role{' '}
                <strong>"{role.role_name}"</strong>?
              </p>

              {role.total_users > 0 && (
                <div className="alert alert-warning">
                  <AlertTriangle size={18} />
                  <span>
                    This role has <strong>{role.total_users} active user(s)</strong>.
                    Please reassign users before deleting.
                  </span>
                </div>
              )}

              <p className="warning-text">
                This action cannot be undone. The role will be deactivated.
              </p>
            </>
          )}
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
          {!role.is_system_role && (
            <button
              type="button"
              className="btn-danger"
              onClick={handleDelete}
              disabled={loading || role.total_users > 0}
            >
              {loading ? (
                <>
                  <Loader className="spinner" size={18} />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Delete Role
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteRoleModal;