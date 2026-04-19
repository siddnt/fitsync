import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetProfileQuery, useUpdateProfileMutation } from '../../services/userApi.js';
import { createSubmissionHandler } from '../../lib/redux-form.js';
import './ProfilePage.css';

const buildFormData = (profile = {}) => ({
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

const PROFILE_COMPLETENESS_FIELDS = [
  'firstName',
  'lastName',
  'contactNumber',
  'address',
  'bio',
  'age',
  'gender',
  'height',
  'weight',
  'profile.location',
  'profile.headline',
  'profile.about',
  'profile.socialLinks.website',
  'profile.socialLinks.instagram',
];

const getRoleSummaryCards = (profile = {}, role) => {
  if (role === 'trainer') {
    return [
      { label: 'Experience', value: `${profile?.experienceYears ?? 0} yrs` },
      { label: 'Trainees mentored', value: `${profile?.mentoredCount ?? 0}` },
      { label: 'Specialisations', value: profile?.specializations?.length ? profile.specializations.join(', ') : 'Add focus areas' },
    ];
  }

  if (role === 'trainee') {
    return [
      { label: 'Current weight', value: profile?.weight ? `${profile.weight} kg` : 'Add weight' },
      { label: 'Height', value: profile?.height ? `${profile.height} cm` : 'Add height' },
      { label: 'Headline', value: profile?.profile?.headline || 'Add a short fitness headline' },
    ];
  }

  if (role === 'gym-owner' || role === 'seller') {
    return [
      { label: 'Company', value: profile?.profile?.company || 'Add your company' },
      { label: 'Contact', value: profile?.contactNumber || 'Add a business number' },
      { label: 'Location', value: profile?.profile?.location || profile?.address || 'Add business location' },
    ];
  }

  return [
    { label: 'Role', value: role || 'Member' },
    { label: 'Location', value: profile?.profile?.location || 'Add your location' },
    { label: 'Headline', value: profile?.profile?.headline || 'Add a headline' },
  ];
};

const ProfilePage = () => {
  const currentUser = useSelector((state) => state.auth.user);
  const { data, isLoading: isFetching } = useGetProfileQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();

  const profile = data?.data || currentUser || {};
  const [formData, setFormData] = useState(() => buildFormData(profile));
  const [previewImage, setPreviewImage] = useState(profile?.profilePicture || '');
  const [selectedFile, setSelectedFile] = useState(null);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  useEffect(() => {
    setFormData(buildFormData(profile));
    if (!selectedFile) {
      setPreviewImage(profile?.profilePicture || '');
    }
  }, [profile, selectedFile]);

  const role = profile?.role ?? currentUser?.role ?? 'member';
  const completionScore = useMemo(() => {
    const filled = PROFILE_COMPLETENESS_FIELDS.filter((field) => {
      const value = formData[field];
      return Array.isArray(value) ? value.length > 0 : String(value ?? '').trim().length > 0;
    }).length;
    return Math.round((filled / PROFILE_COMPLETENESS_FIELDS.length) * 100);
  }, [formData]);

  const roleSummaryCards = useMemo(() => getRoleSummaryCards(profile, role), [profile, role]);
  const completionGuidance = completionScore >= 85
    ? 'Profile is ready for public-facing discovery and internal dashboard context.'
    : completionScore >= 60
      ? 'Good progress. Add a few more details to make the profile stronger in admin and marketplace views.'
      : 'This profile still looks sparse. Add location, bio, contact details, and a headline first.';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
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

  const validate = (payload) => {
    const nextErrors = {};

    if (!payload.firstName?.trim()) {
      nextErrors.firstName = 'First name is required';
    }
    if (payload.age && (payload.age < 10 || payload.age > 120)) {
      nextErrors.age = 'Age must be between 10 and 120';
    }
    if (payload.height && (payload.height < 50 || payload.height > 300)) {
      nextErrors.height = 'Height must be between 50 and 300 cm';
    }
    if (payload.weight && (payload.weight < 20 || payload.weight > 500)) {
      nextErrors.weight = 'Weight must be between 20 and 500 kg';
    }
    if (payload.contactNumber && !/^\+?[0-9\s\-()]{10,}$/.test(payload.contactNumber)) {
      nextErrors.contactNumber = 'Invalid phone number format';
    }
    if (payload.experienceYears && (payload.experienceYears < 0 || payload.experienceYears > 60)) {
      nextErrors.experienceYears = 'Experience should be between 0 and 60 years';
    }
    if (payload.mentoredCount && payload.mentoredCount < 0) {
      nextErrors.mentoredCount = 'Mentored trainees cannot be negative';
    }

    return nextErrors;
  };

  const handleSubmit = createSubmissionHandler({
    mutation: updateProfile,
    validate,
    prepare: (payload) => {
      const formPayload = new FormData();

      Object.entries(payload).forEach(([key, value]) => {
        if (['specializations', 'certifications'].includes(key)) {
          return;
        }

        if (value !== '' && !key.startsWith('profile.')) {
          formPayload.append(key, value);
        }
      });

      const profileData = {
        location: payload['profile.location'] || '',
        headline: payload['profile.headline'] || '',
        about: payload['profile.about'] || '',
        socialLinks: {
          website: payload['profile.socialLinks.website'] || '',
          instagram: payload['profile.socialLinks.instagram'] || '',
          facebook: payload['profile.socialLinks.facebook'] || '',
        },
      };
      formPayload.append('profile', JSON.stringify(profileData));

      if (selectedFile) {
        formPayload.append('profilePicture', selectedFile);
      }

      const normaliseList = (value) =>
        value
          .split(',')
          .map((token) => token.trim())
          .filter(Boolean);

      formPayload.append('specializations', JSON.stringify(normaliseList(payload.specializations || '')));
      formPayload.append('certifications', JSON.stringify(normaliseList(payload.certifications || '')));

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
          <h1>Profile</h1>
          <p>Review how your account appears across FitSync, then update the underlying details below.</p>
        </header>

        <section className="profile-overview">
          <div className="profile-overview__identity">
            <div className="profile-overview__avatar">
              {previewImage ? (
                <img src={previewImage} alt={profile?.name || 'Profile'} />
              ) : (
                <span>{profile?.firstName?.slice(0, 1) || profile?.name?.slice(0, 1) || '?'}</span>
              )}
            </div>
            <div className="profile-overview__content">
              <span className="profile-overview__role">{role}</span>
              <h2>{profile?.name || [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Profile in progress'}</h2>
              <p>{profile?.profile?.headline || formData['profile.headline'] || 'Add a headline so dashboards and public views describe you clearly.'}</p>
              <div className="profile-overview__meta">
                <span>{profile?.email}</span>
                <span>{profile?.profile?.location || formData['profile.location'] || 'Location missing'}</span>
                <span>{profile?.contactNumber || formData.contactNumber || 'Phone missing'}</span>
              </div>
            </div>
          </div>

          <div className="profile-overview__completion">
            <small>Profile completeness</small>
            <strong>{completionScore}%</strong>
            <div className="profile-overview__progress">
              <span style={{ width: `${completionScore}%` }} />
            </div>
            <p>{completionGuidance}</p>
          </div>
        </section>

        <section className="profile-summary-grid">
          {roleSummaryCards.map((card) => (
            <article key={card.label} className="profile-summary-card">
              <small>{card.label}</small>
              <strong>{card.value}</strong>
            </article>
          ))}
        </section>

        <form onSubmit={(event) => { event.preventDefault(); handleSubmit(formData); }} className="profile-form">
          <section className="profile-form__section profile-form__picture-section">
            <h2>Profile picture</h2>
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
                  Choose photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                {errors.profilePicture ? (
                  <span className="field-error">{errors.profilePicture}</span>
                ) : null}
                <p className="help-text">JPG, PNG or GIF. Max size 5MB.</p>
              </div>
            </div>
          </section>

          <section className="profile-form__section">
            <h2>Personal information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="firstName">First name *</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  className={errors.firstName ? 'error' : ''}
                />
                {errors.firstName ? <span className="field-error">{errors.firstName}</span> : null}
              </div>

              <div className="form-field">
                <label htmlFor="lastName">Last name</label>
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
                {errors.age ? <span className="field-error">{errors.age}</span> : null}
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

          <section className="profile-form__section">
            <h2>Health metrics</h2>
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
                {errors.height ? <span className="field-error">{errors.height}</span> : null}
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
                {errors.weight ? <span className="field-error">{errors.weight}</span> : null}
              </div>
            </div>
          </section>

          {role === 'trainer' ? (
            <section className="profile-form__section">
              <h2>Trainer profile</h2>
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
                  {errors.experienceYears ? <span className="field-error">{errors.experienceYears}</span> : null}
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
                  {errors.mentoredCount ? <span className="field-error">{errors.mentoredCount}</span> : null}
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
                    placeholder="ACE Certified, CrossFit Level 1, NASM CPT"
                  />
                  <span className="help-text">Separate multiple certifications with commas.</span>
                </div>
              </div>
            </section>
          ) : null}

          <section className="profile-form__section">
            <h2>Contact information</h2>
            <div className="profile-form__grid">
              <div className="form-field">
                <label htmlFor="contactNumber">Phone number</label>
                <input
                  type="tel"
                  id="contactNumber"
                  name="contactNumber"
                  value={formData.contactNumber}
                  onChange={handleChange}
                  className={errors.contactNumber ? 'error' : ''}
                />
                {errors.contactNumber ? <span className="field-error">{errors.contactNumber}</span> : null}
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
                  placeholder="Mumbai, Maharashtra"
                />
              </div>
            </div>
          </section>

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
                placeholder="Fitness enthusiast | Marathon runner"
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
              <label htmlFor="profile.about">About (extended)</label>
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

          <section className="profile-form__section">
            <h2>Social links</h2>
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

          <div className="profile-form__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isUpdating}
            >
              {isUpdating ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;
