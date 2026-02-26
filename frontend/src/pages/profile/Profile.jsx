// ============================================
// PROFILE PAGE - UPDATED (NO SECURITY SECTION)
// Removed redundant Security section
// Developer: Suvadip Panja
// Date: November 09, 2025
// FILE: pages/profile/Profile.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Calendar,
  Camera,
  Save,
  X,
  Edit,
  Loader,
} from 'lucide-react';
import PasswordExpiryCard from '../../components/passwordExpiry/PasswordExpiryCard';
import '../../styles/Profile.css';

const Profile = () => {
  const { user, refreshUser } = useAuth();

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role_name: '',
    role_code: '',
    department_name: '',
    created_at: null,
    last_login: null,
  });

  const [profilePicture, setProfilePicture] = useState(null);

  // ============================================
  // FETCH PROFILE DATA
  // ============================================
  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/profile');
      
      if (response.data.success) {
        const profile = response.data.data;
        
        if (process.env.NODE_ENV === 'development') console.log('📋 Profile data received:', profile);
        
        setProfileData({
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || '',
          phone_number: profile.phone_number || '',
          role_name: profile.role_name || 'User',
          role_code: profile.role_code || 'USER',
          department_name: profile.department_name || null,
          created_at: profile.created_at || null,
          last_login: profile.last_login || null,
        });
        
        if (profile.profile_picture) {
          if (process.env.NODE_ENV === 'development') console.log('✅ Profile picture found:', profile.profile_picture);
          setProfilePicture(profile.profile_picture);
        } else {
          if (process.env.NODE_ENV === 'development') console.log('ℹ️ No profile picture set');
          setProfilePicture(null);
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Profile fetch error:', err);
      setError(err.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLE INPUT CHANGE
  // ============================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ============================================
  // HANDLE PROFILE UPDATE
  // ============================================
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await api.put('/profile', {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: profileData.email,
        phone_number: profileData.phone_number,
      });

      if (response.data.success) {
        setSuccess('Profile updated successfully!');
        setEditing(false);
        await refreshUser();
        await fetchProfile();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // HANDLE PROFILE PICTURE UPLOAD
  // ============================================
  const handlePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid image file (JPG, PNG, GIF, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('profile_picture', file);

      if (process.env.NODE_ENV === 'development') console.log('📤 Uploading profile picture:', file.name);
      
      const response = await api.post('/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const newPicturePath = response.data.data.profile_picture;
        if (process.env.NODE_ENV === 'development') console.log('✅ Upload successful! New path:', newPicturePath);
        
        setProfilePicture(newPicturePath);
        setSuccess('Profile picture updated successfully!');
        
        await refreshUser();
        setTimeout(async () => {
          await fetchProfile();
          setSuccess(null);
        }, 1000);
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload profile picture');
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // HANDLE PROFILE PICTURE DELETE
  // ============================================
  const handleDeletePicture = async () => {
    if (!window.confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      setUploading(true);
      const response = await api.delete('/profile/picture');

      if (response.data.success) {
        setProfilePicture(null);
        setSuccess('Profile picture deleted successfully!');
        await refreshUser();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete profile picture');
    } finally {
      setUploading(false);
    }
  };

  // ============================================
  // CANCEL EDIT
  // ============================================
  const handleCancelEdit = () => {
    setEditing(false);
    fetchProfile();
    setError(null);
  };

  // ============================================
  // FORMAT DATE
  // ============================================
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      return 'N/A';
    }
  };

  // ============================================
  // RENDER
  // ============================================
  if (loading && !profileData.email) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1>My Profile</h1>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="profile-container">
        {/* Profile Picture Card */}
        <div className="profile-picture-card profile-card">
          <h3>Profile Picture</h3>
          <div className="profile-picture-section">
            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
              {profilePicture && (
                <img
                  src={profilePicture}
                  alt="Profile"
                  style={{
                    width: '200px',
                    height: '200px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '4px solid #e5e7eb',
                    display: 'block',
                    background: 'white'
                  }}
                  onLoad={() => { if (process.env.NODE_ENV === 'development') console.log('✅ Image loaded!'); }}
                  onError={(e) => {
                    if (process.env.NODE_ENV === 'development') console.error('❌ Failed to load:', e.target.src);
                  }}
                />
              )}
              
              {!profilePicture && (
                <div style={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  border: '4px solid #e5e7eb'
                }}>
                  <User size={64} />
                </div>
              )}
              
              <label 
                htmlFor="profile-picture-input"
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  background: '#667eea',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '3px solid white',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                {uploading ? <Loader size={20} /> : <Camera size={20} />}
              </label>
              
              <input
                type="file"
                id="profile-picture-input"
                accept="image/*"
                onChange={handlePictureUpload}
                style={{ display: 'none' }}
                disabled={uploading}
              />
            </div>
            
            <div className="profile-picture-actions">
              <p className="profile-picture-hint">
                JPG, PNG, GIF or WEBP. Max size 5MB
              </p>
              {profilePicture && (
                <button
                  className="btn-danger-outline btn-small"
                  onClick={handleDeletePicture}
                  disabled={uploading}
                >
                  Delete Picture
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="profile-card">
          <div className="profile-card-header">
            <h3>Personal Information</h3>
            {!editing && (
              <button className="btn-secondary btn-small" onClick={() => setEditing(true)}>
                <Edit size={16} />
                Edit
              </button>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="profile-form">
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={profileData.first_name}
                  onChange={handleInputChange}
                  disabled={!editing}
                  required
                />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={profileData.last_name}
                  onChange={handleInputChange}
                  disabled={!editing}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <div className="input-with-icon">
                <Mail size={20} />
                <input
                  type="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleInputChange}
                  disabled={!editing}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <div className="input-with-icon">
                <Phone size={20} />
                <input
                  type="tel"
                  name="phone_number"
                  value={profileData.phone_number}
                  onChange={handleInputChange}
                  disabled={!editing}
                />
              </div>
            </div>

            {editing && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={loading}
                >
                  <X size={20} />
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader className="spinner-small" size={20} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={20} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Account Information */}
        <div className="profile-card">
          <h3>Account Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">
                <Shield size={18} />
                <span>Role</span>
              </div>
              <div className="info-value">
                <span className={`role-badge role-${profileData.role_code.toLowerCase()}`}>
                  {profileData.role_name}
                </span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Building size={18} />
                <span>Department</span>
              </div>
              <div className="info-value">
                {profileData.department_name || 'Not assigned'}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Calendar size={18} />
                <span>Member Since</span>
              </div>
              <div className="info-value">
                {formatDate(profileData.created_at)}
              </div>
            </div>

            <div className="info-item">
              <div className="info-label">
                <Calendar size={18} />
                <span>Last Login</span>
              </div>
              <div className="info-value">
                {formatDate(profileData.last_login)}
              </div>
            </div>
          </div>
        </div>

        {/* Password Status Card */}
        <PasswordExpiryCard />

      </div>
    </div>
  );
};

export default Profile;