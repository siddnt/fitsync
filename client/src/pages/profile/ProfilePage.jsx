import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useGetProfileQuery, useUpdateProfileMutation } from '../../services/userApi.js';
import { createSubmissionHandler } from '../../lib/redux-form.js';
import './ProfilePage.css';

const ProfilePage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const { data, isLoading: isFetching } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  
  const profile = data?.data || currentUser;
  
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    age: profile?.age || '',
    gender: profile?.gender || '',
    height: profile?.height || '',
    weight: profile?.weight || '',
    contactNumber: profile?.contactNumber || '',
    address: profile?.address || '',
    bio: profile?.bio || '',
    experienceYears: profile?.experienceYears ?? '',
    mentoredCount: profile?.mentoredCount ?? '',
    specializations: Array.isArray(profile?.specializations) ? profile.specializations.join(', ') : '',
    certifications: Array.isArray(profile?.certifications) ? profile.certifications.join(', ') : '',
    'profile.location': profile?.profile?.location || '',
    'profile.headline': profile?.profile?.headline || '',
    'profile.about': profile?.profile?.about || '',
    'profile.socialLinks.website': profile?.profile?.socialLinks?.website || '',
    'profile.socialLinks.instagram': profile?.profile?.socialLinks?.instagram || '',
    'profile.socialLinks.facebook': profile?.profile?.socialLinks?.facebook || '',
  });

  const [previewImage, setPreviewImage] = useState(profile?.profilePicture || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, profilePicture: 'File size must be less than 5MB' }));
        return;
      }
      if (!file.type.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, profilePicture: 'Only image files are allowed' }));
        return;
      }
      
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => setPreviewImage(reader.result);
      reader.readAsDataURL(file);
      setErrors((prev) => ({ ...prev, profilePicture: '' }));
    }
  };

  const validate = (data) => {
    const newErrors = {};
    
    if (!data.firstName?.trim()) {
      newErrors.firstName = 'First name is required';
    }
    
    if (data.age && (data.age < 10 || data.age > 120)) {
      newErrors.age = 'Age must be between 10 and 120';
    }
    
    if (data.height && (data.height < 50 || data.height > 300)) {
      newErrors.height = 'Height must be between 50 and 300 cm';
    }
    
    if (data.weight && (data.weight < 20 || data.weight > 500)) {
      newErrors.weight = 'Weight must be between 20 and 500 kg';
    }
    
    if (data.contactNumber && !/^\+?[0-9\s\-()]{10,}$/.test(data.contactNumber)) {
      newErrors.contactNumber = 'Invalid phone number format';
    }

    if (data.experienceYears && (data.experienceYears < 0 || data.experienceYears > 60)) {
      newErrors.experienceYears = 'Experience should be between 0 and 60 years';
    }

    if (data.mentoredCount && data.mentoredCount < 0) {
      newErrors.mentoredCount = 'Mentored trainees cannot be negative';
    }
    
    return newErrors;
  };

  const handleSubmit = createSubmissionHandler({
    mutation: updateProfile,
    validate,
    prepare: (data) => {
      const formPayload = new FormData();
      
      // Append basic fields
      Object.entries(data).forEach(([key, value]) => {
        if (['specializations', 'certifications'].includes(key)) {
          return;
        }

        if (value !== '' && !key.startsWith('profile.')) {
          formPayload.append(key, value);
        }
      });
      
      // Handle nested profile fields
      const profileData = {
        location: data['profile.location'] || '',
        headline: data['profile.headline'] || '',
        about: data['profile.about'] || '',
        socialLinks: {
          website: data['profile.socialLinks.website'] || '',
          instagram: data['profile.socialLinks.instagram'] || '',
          facebook: data['profile.socialLinks.facebook'] || '',
        },
      };
      formPayload.append('profile', JSON.stringify(profileData));
      
      // Append file if selected
      if (selectedFile) {
        formPayload.append('profilePicture', selectedFile);
      }

      const normaliseList = (value) =>
        value
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean);

      formPayload.append('specializations', JSON.stringify(normaliseList(data.specializations || '')));
      formPayload.append('certifications', JSON.stringify(normaliseList(data.certifications || '')));
      
      return formPayload;
    },
    onSuccess: () => {
      setSelectedFile(null);
    },
    setErrors,
  });

  if (isFetching) {
    return (
      <div className="profile-page">
        <div className="profile-page__loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-page__container">
        <header className="profile-page__header">
          <h1>Edit Profile</h1>
          <p>Manage your personal information and preferences</p>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(formData); }} className="profile-form">
          {/* Profile Picture Section */}
          <section className="profile-form__section profile-form__picture-section">
            <h2>Profile Picture</h2>
            <div className="profile-picture-upload">
              <div className="profile-picture-preview">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" />
                ) : (
                  <div className="profile-picture-placeholder">
                    <span>No photo</span>
                  </div>
                )}
              </div>
              <div className="profile-picture-actions">
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {errors.profilePicture && (
                  <span className="field-error">{errors.profilePicture}</span>
                )}
                <p className="help-text">JPG, PNG or GIF. Max size 5MB</p>
              </div>
            </div>
          </section>

          {/* Personal Information */}
          <section className="profile-form__section">
            <h2>Personal Information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="firstName">First Name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={errors.firstName ? 'error' : ''}
                />
                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field">
                <label htmlFor="age">Age</label>
                <input
                  type="number"
                  id="age"
                  name="age"
                  value={formData.age}
                  onChange={handleChange}
                  min="10"
                  max="120"
                  className={errors.age ? 'error' : ''}
                />
                {errors.age && <span className="field-error">{errors.age}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </section>

          {/* Health Metrics */}
          <section className="profile-form__section">
            <h2>Health Metrics</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="height">Height (cm)</label>
                <input
                  type="number"
                  id="height"
                  name="height"
                  value={formData.height}
                  onChange={handleChange}
                  min="50"
                  max="300"
                  className={errors.height ? 'error' : ''}
                />
                {errors.height && <span className="field-error">{errors.height}</span>}
              </div>

              <div className="form-field">
                <label htmlFor="weight">Weight (kg)</label>
                <input
                  type="number"
                  id="weight"
                  name="weight"
                  value={formData.weight}
                  onChange={handleChange}
                  min="20"
                  max="500"
                  className={errors.weight ? 'error' : ''}
                />
                {errors.weight && <span className="field-error">{errors.weight}</span>}
              </div>
            </div>
          </section>

          {/* Trainer Profile */}
          {currentUser?.role === 'trainer' ? (
            <section className="profile-form__section">
              <h2>Trainer Profile</h2>
              <div className="profile-form__grid">
                <div className="form-field">
                  <label htmlFor="experienceYears">Experience (years)</label>
                  <input
                    type="number"
                    id="experienceYears"
                    name="experienceYears"
                    value={formData.experienceYears}
                    onChange={handleChange}
                    min="0"
                    max="60"
                    className={errors.experienceYears ? 'error' : ''}
                  />
                  {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
                </div>

                <div className="form-field">
                  <label htmlFor="mentoredCount">Trainees mentored</label>
                  <input
                    type="number"
                    id="mentoredCount"
                    name="mentoredCount"
                    value={formData.mentoredCount}
                    onChange={handleChange}
                    min="0"
                    className={errors.mentoredCount ? 'error' : ''}
                  />
                  {errors.mentoredCount && <span className="field-error">{errors.mentoredCount}</span>}
                </div>

                <div className="form-field form-field--full">
                  <label htmlFor="specializations">Specialisations</label>
                  <input
                    type="text"
                    id="specializations"
                    name="specializations"
                    value={formData.specializations}
                    onChange={handleChange}
                    placeholder="Strength training, Mobility, Nutrition"
                  />
                  <span className="help-text">Separate multiple specialisations with commas.</span>
                </div>

                <div className="form-field form-field--full">
                  <label htmlFor="certifications">Certifications</label>
                  <textarea
                    id="certifications"
                    name="certifications"
                    value={formData.certifications}
                    onChange={handleChange}
                    rows="3"
                    placeholder="e.g., ACE Certified, CrossFit Level 1, NASM CPT"
                  />
                  <span className="help-text">Separate multiple certifications with commas.</span>
                </div>
              </div>
            </section>
          ) : null}

          {/* Contact Information */}
          <section className="profile-form__section">
            <h2>Contact Information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="contactNumber">Phone Number</label>
                <input
                  type="tel"
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  className={errors.contactNumber ? 'error' : ''}
                />
                {errors.contactNumber && <span className="field-error">{errors.contactNumber}</span>}
              </div>

              <div className="form-field form-field--full">
                <label htmlFor="address">Address</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-field form-field--full">
                <label htmlFor="profile.location">Location</label>
                <input
                  type="text"
                  id="profile.location"
                  name="profile.location"
                  value={formData['profile.location']}
                  onChange={handleChange}
                  placeholder="e.g., Mumbai, Maharashtra"
                />
              </div>
            </div>
          </section>

          {/* About */}
          <section className="profile-form__section">
            <h2>About</h2>
            <div className="form-field">
              <label htmlFor="profile.headline">Headline</label>
              <input
                type="text"
                id="profile.headline"
                name="profile.headline"
                value={formData['profile.headline']}
                onChange={handleChange}
                placeholder="e.g., Fitness enthusiast | Marathon runner"
                maxLength="100"
              />
            </div>

            <div className="form-field">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                placeholder="Tell us about yourself..."
                rows="4"
                maxLength="500"
              />
            </div>

            <div className="form-field">
              <label htmlFor="profile.about">About (Extended)</label>
              <textarea
                id="profile.about"
                name="profile.about"
                value={formData['profile.about']}
                onChange={handleChange}
                placeholder="Share your fitness journey, goals, and interests..."
                rows="6"
                maxLength="1000"
              />
            </div>
          </section>

          {/* Social Links */}
          <section className="profile-form__section">
            <h2>Social Links</h2>
            <div className="profile-form__grid">
              <div className="form-field form-field--full">
                <label htmlFor="profile.socialLinks.website">Website</label>
                <input
                  type="url"
                  id="profile.socialLinks.website"
                  name="profile.socialLinks.website"
                  value={formData['profile.socialLinks.website']}
                  onChange={handleChange}
                  placeholder="https://your-website.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="profile.socialLinks.instagram">Instagram</label>
                <input
                  type="text"
                  id="profile.socialLinks.instagram"
                  name="profile.socialLinks.instagram"
                  value={formData['profile.socialLinks.instagram']}
                  onChange={handleChange}
                  placeholder="@username"
                />
              </div>

              <div className="form-field">
                <label htmlFor="profile.socialLinks.facebook">Facebook</label>
                <input
                  type="text"
                  id="profile.socialLinks.facebook"
                  name="profile.socialLinks.facebook"
                  value={formData['profile.socialLinks.facebook']}
                  onChange={handleChange}
                  placeholder="facebook.com/username"
                />
              </div>
            </div>
          </section>

          {/* Form Actions */}
          <div className="profile-form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
