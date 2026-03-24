import { useState, useRef, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useGetProfileQuery, useUpdateProfileMutation } from '../../services/userApi.js';
import { authActions } from '../../features/auth/authSlice.js';
import { createSubmissionHandler } from '../../lib/redux-form.js';
import './ProfilePage.css';

/* ── role helpers ── */
const HEALTH_ROLES = new Set(['trainee', 'trainer']);
const TRAINER_ROLES = new Set(['trainer']);
const BUSINESS_ROLES = new Set(['gym-owner', 'seller', 'manager', 'admin']);

const buildInitial = (p) => ({
  firstName: p?.firstName || '',
  lastName: p?.lastName || '',
  age: p?.age || '',
  gender: p?.gender || '',
  height: p?.height || '',
  weight: p?.weight || '',
  contactNumber: p?.contactNumber || '',
  address: p?.address || '',
  bio: p?.bio || '',
  experienceYears: p?.experienceYears ?? '',
  mentoredCount: p?.mentoredCount ?? '',
  specializations: Array.isArray(p?.specializations) ? p.specializations.join(', ') : '',
  certifications: Array.isArray(p?.certifications) ? p.certifications.join(', ') : '',
  'profile.location': p?.profile?.location || '',
  'profile.headline': p?.profile?.headline || '',
  'profile.about': p?.profile?.about || '',
  'profile.company': p?.profile?.company || '',
  'profile.socialLinks.website': p?.profile?.socialLinks?.website || '',
  'profile.socialLinks.instagram': p?.profile?.socialLinks?.instagram || '',
  'profile.socialLinks.facebook': p?.profile?.socialLinks?.facebook || '',
});

const ProfilePage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const { data, isLoading: isFetching } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();

  const profile = data?.data || currentUser;
  const role = profile?.role || currentUser?.role || 'trainee';

  /* ── form state ── */
  const [formData, setFormData] = useState(() => buildInitial(profile));
  const [previewImage, setPreviewImage] = useState(profile?.profilePicture || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);
  const hasHydrated = useRef(false);

  /* Re-hydrate form when API data arrives */
  useEffect(() => {
    if (data?.data && !hasHydrated.current) {
      setFormData(buildInitial(data.data));
      setPreviewImage(data.data.profilePicture || '');
      hasHydrated.current = true;
    }
  }, [data]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (successMsg) setSuccessMsg('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
  };

  const validate = (d) => {
    const errs = {};
    if (!d.firstName?.trim()) errs.firstName = 'First name is required';
    if (d.age && (d.age < 10 || d.age > 120)) errs.age = 'Age must be between 10 and 120';
    if (d.height && (d.height < 50 || d.height > 300)) errs.height = 'Height must be between 50 and 300 cm';
    if (d.weight && (d.weight < 20 || d.weight > 500)) errs.weight = 'Weight must be between 20 and 500 kg';
    if (d.contactNumber && !/^\+?[0-9\s\-()]{10,}$/.test(d.contactNumber)) errs.contactNumber = 'Invalid phone number format';
    if (d.experienceYears && (d.experienceYears < 0 || d.experienceYears > 60)) errs.experienceYears = 'Experience should be between 0 and 60 years';
    if (d.mentoredCount && d.mentoredCount < 0) errs.mentoredCount = 'Mentored trainees cannot be negative';
    return errs;
  };

  const handleSubmit = createSubmissionHandler({
    mutation: updateProfile,
    validate,
    prepare: (d) => {
      const payload = new FormData();

      /* basic flat fields */
      const flat = [
        'firstName', 'lastName', 'age', 'gender', 'contactNumber', 'address', 'bio',
      ];
      if (HEALTH_ROLES.has(role)) flat.push('height', 'weight');
      if (TRAINER_ROLES.has(role)) flat.push('experienceYears', 'mentoredCount');

      flat.forEach((key) => {
        if (d[key] !== '' && d[key] !== undefined) payload.append(key, d[key]);
      });

      /* nested profile object */
      const profileObj = {
        location: d['profile.location'] || '',
        headline: d['profile.headline'] || '',
        about: d['profile.about'] || '',
        company: d['profile.company'] || '',
        socialLinks: {
          website: d['profile.socialLinks.website'] || '',
          instagram: d['profile.socialLinks.instagram'] || '',
          facebook: d['profile.socialLinks.facebook'] || '',
        },
      };
      payload.append('profile', JSON.stringify(profileObj));

      /* arrays (trainer only) */
      const normalise = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (TRAINER_ROLES.has(role)) {
        payload.append('specializations', JSON.stringify(normalise(d.specializations)));
        payload.append('certifications', JSON.stringify(normalise(d.certifications)));
      }

      if (selectedFile) payload.append('profilePicture', selectedFile);

      return payload;
    },
    onSuccess: (result) => {
      setSelectedFile(null);
      setSuccessMsg('Profile updated successfully!');
      /* sync Redux auth state so the header/sidebar updates immediately */
      if (result?.data) {
        dispatch(authActions.updateProfile(result.data));
      }
    },
    setErrors,
  });

  /* ── role badge ── */
  const roleBadge = useMemo(() => {
    const labels = {
      trainee: 'Trainee',
      trainer: 'Trainer',
      'gym-owner': 'Gym Owner',
      seller: 'Seller',
      manager: 'Manager',
      admin: 'Admin',
    };
    return labels[role] || role;
  }, [role]);

  const statusLabel = profile?.status || currentUser?.status || 'active';

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
          <div className="profile-page__header-top">
            <div>
              <h1>Edit Profile</h1>
              <p>Manage your personal information and preferences</p>
            </div>
            <div className="profile-page__badges">
              <span className="profile-badge profile-badge--role">{roleBadge}</span>
              <span className={`profile-badge profile-badge--status profile-badge--${statusLabel}`}>
                {statusLabel}
              </span>
            </div>
          </div>
        </header>

        {/* Success / global error messages */}
        {successMsg && <div className="profile-toast profile-toast--success">{successMsg}</div>}
        {errors._form && <div className="profile-toast profile-toast--error">{errors._form}</div>}

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(formData); }} className="profile-form">
          {/* ── Profile Picture ── */}
          <section className="profile-form__section profile-form__picture-section">
            <h2>Profile Picture</h2>
            <div className="profile-picture-upload">
              <div className="profile-picture-preview">
                {previewImage ? (
                  <img src={previewImage} alt="Profile" />
                ) : (
                  <div className="profile-picture-placeholder"><span>No photo</span></div>
                )}
              </div>
              <div className="profile-picture-actions">
                <button type="button" className="btn btn--secondary" onClick={() => fileInputRef.current?.click()}>
                  Choose Photo
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
                {errors.profilePicture && <span className="field-error">{errors.profilePicture}</span>}
                <p className="help-text">JPG, PNG or GIF. Max size 5MB</p>
              </div>
            </div>
          </section>

          {/* ── Personal Information ── */}
          <section className="profile-form__section">
            <h2>Personal Information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="firstName">First Name *</label>
                <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className={errors.firstName ? 'error' : ''} />
                {errors.firstName && <span className="field-error">{errors.firstName}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="lastName">Last Name</label>
                <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} />
              </div>
              <div className="form-field">
                <label htmlFor="age">Age</label>
                <input type="number" id="age" name="age" value={formData.age} onChange={handleChange} min="10" max="120" className={errors.age ? 'error' : ''} />
                {errors.age && <span className="field-error">{errors.age}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="gender">Gender</label>
                <select id="gender" name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
              </div>
            </div>
          </section>

          {/* ── Health Metrics (trainee & trainer only) ── */}
          {HEALTH_ROLES.has(role) && (
            <section className="profile-form__section">
              <h2>Health Metrics</h2>
              <div className="profile-form__grid">
                <div className="form-field">
                  <label htmlFor="height">Height (cm)</label>
                  <input type="number" id="height" name="height" value={formData.height} onChange={handleChange} min="50" max="300" className={errors.height ? 'error' : ''} />
                  {errors.height && <span className="field-error">{errors.height}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="weight">Weight (kg)</label>
                  <input type="number" id="weight" name="weight" value={formData.weight} onChange={handleChange} min="20" max="500" className={errors.weight ? 'error' : ''} />
                  {errors.weight && <span className="field-error">{errors.weight}</span>}
                </div>
              </div>
            </section>
          )}

          {/* ── Trainer Profile ── */}
          {TRAINER_ROLES.has(role) && (
            <section className="profile-form__section">
              <h2>Trainer Profile</h2>
              <div className="profile-form__grid">
                <div className="form-field">
                  <label htmlFor="experienceYears">Experience (years)</label>
                  <input type="number" id="experienceYears" name="experienceYears" value={formData.experienceYears} onChange={handleChange} min="0" max="60" className={errors.experienceYears ? 'error' : ''} />
                  {errors.experienceYears && <span className="field-error">{errors.experienceYears}</span>}
                </div>
                <div className="form-field">
                  <label htmlFor="mentoredCount">Trainees mentored</label>
                  <input type="number" id="mentoredCount" name="mentoredCount" value={formData.mentoredCount} onChange={handleChange} min="0" className={errors.mentoredCount ? 'error' : ''} />
                  {errors.mentoredCount && <span className="field-error">{errors.mentoredCount}</span>}
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="specializations">Specialisations</label>
                  <input type="text" id="specializations" name="specializations" value={formData.specializations} onChange={handleChange} placeholder="Strength training, Mobility, Nutrition" />
                  <span className="help-text">Separate multiple specialisations with commas.</span>
                </div>
                <div className="form-field form-field--full">
                  <label htmlFor="certifications">Certifications</label>
                  <textarea id="certifications" name="certifications" value={formData.certifications} onChange={handleChange} rows="3" placeholder="e.g., ACE Certified, CrossFit Level 1, NASM CPT" />
                  <span className="help-text">Separate multiple certifications with commas.</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Business Info (gym-owner, seller, manager, admin) ── */}
          {BUSINESS_ROLES.has(role) && (
            <section className="profile-form__section">
              <h2>Business Information</h2>
              <div className="profile-form__grid">
                <div className="form-field form-field--full">
                  <label htmlFor="profile.company">Company / Organisation</label>
                  <input type="text" id="profile.company" name="profile.company" value={formData['profile.company']} onChange={handleChange} placeholder="e.g., FitSync Fitness Pvt. Ltd." />
                </div>
              </div>
            </section>
          )}

          {/* ── Contact Information ── */}
          <section className="profile-form__section">
            <h2>Contact Information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="contactNumber">Phone Number</label>
                <input type="tel" id="contactNumber" name="contactNumber" value={formData.contactNumber} onChange={handleChange} className={errors.contactNumber ? 'error' : ''} />
                {errors.contactNumber && <span className="field-error">{errors.contactNumber}</span>}
              </div>
              <div className="form-field form-field--full">
                <label htmlFor="address">Address</label>
                <input type="text" id="address" name="address" value={formData.address} onChange={handleChange} />
              </div>
              <div className="form-field form-field--full">
                <label htmlFor="profile.location">Location</label>
                <input type="text" id="profile.location" name="profile.location" value={formData['profile.location']} onChange={handleChange} placeholder="e.g., Mumbai, Maharashtra" />
              </div>
            </div>
          </section>

          {/* ── About ── */}
          <section className="profile-form__section">
            <h2>About</h2>
            <div className="form-field">
              <label htmlFor="profile.headline">Headline</label>
              <input type="text" id="profile.headline" name="profile.headline" value={formData['profile.headline']} onChange={handleChange} placeholder="e.g., Fitness enthusiast | Marathon runner" maxLength="100" />
            </div>
            <div className="form-field">
              <label htmlFor="bio">Bio</label>
              <textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} placeholder="Tell us about yourself..." rows="4" maxLength="500" />
            </div>
            <div className="form-field">
              <label htmlFor="profile.about">About (Extended)</label>
              <textarea id="profile.about" name="profile.about" value={formData['profile.about']} onChange={handleChange} placeholder="Share your fitness journey, goals, and interests..." rows="6" maxLength="1000" />
            </div>
          </section>

          {/* ── Social Links ── */}
          <section className="profile-form__section">
            <h2>Social Links</h2>
            <div className="profile-form__grid">
              <div className="form-field form-field--full">
                <label htmlFor="profile.socialLinks.website">Website</label>
                <input type="url" id="profile.socialLinks.website" name="profile.socialLinks.website" value={formData['profile.socialLinks.website']} onChange={handleChange} placeholder="https://your-website.com" />
              </div>
              <div className="form-field">
                <label htmlFor="profile.socialLinks.instagram">Instagram</label>
                <input type="text" id="profile.socialLinks.instagram" name="profile.socialLinks.instagram" value={formData['profile.socialLinks.instagram']} onChange={handleChange} placeholder="@username" />
              </div>
              <div className="form-field">
                <label htmlFor="profile.socialLinks.facebook">Facebook</label>
                <input type="text" id="profile.socialLinks.facebook" name="profile.socialLinks.facebook" value={formData['profile.socialLinks.facebook']} onChange={handleChange} placeholder="facebook.com/username" />
              </div>
            </div>
          </section>

          {/* ── Actions ── */}
          <div className="profile-form__actions">
            <button type="submit" className="btn btn--primary" disabled={isUpdating}>
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
