import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useSubmitContactFormMutation } from '../../services/contactApi.js';
import { useGetGymsQuery } from '../../services/gymsApi.js';
import contactBg from '../../assets/contact-support-team.png';
import './ContactPage.css';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical issue' },
  { value: 'membership', label: 'Membership' },
  { value: 'marketplace', label: 'Marketplace order' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const ContactPage = () => {
  const user = useSelector((state) => state.auth.user);
  const [searchParams] = useSearchParams();
  const selectedGymId = searchParams.get('gymId') ?? '';
  const selectedSubject = searchParams.get('subject') ?? '';

  const defaultValues = useMemo(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    subject: selectedSubject,
    category: 'general',
    priority: 'normal',
    gymId: selectedGymId,
    message: '',
  }), [selectedGymId, selectedSubject, user?.email, user?.name]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ defaultValues });

  const { data: gymsResponse } = useGetGymsQuery();
  const gyms = Array.isArray(gymsResponse?.data?.gyms) ? gymsResponse.data.gyms : [];
  const selectedGym = gyms.find((gym) => gym.id === watch('gymId'));

  const [submitContactForm, { isLoading, isSuccess, isError, error }] = useSubmitContactFormMutation();

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = async (formData) => {
    try {
      await submitContactForm({
        ...formData,
        gymId: formData.gymId || undefined,
      }).unwrap();
      reset({
        ...defaultValues,
        message: '',
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="contact-page" style={{ backgroundImage: `url(${contactBg})` }}>
      <div className="contact-overlay" />
      <div className="contact-container">
        <div className="contact-header">
          <h1>Get in Touch</h1>
          <p>Route support requests with the right context so billing, membership, technical, and marketplace issues reach the correct queue faster.</p>
        </div>

        {selectedGym ? (
          <div className="contact-context">
            This request will be linked to <strong>{selectedGym.name}</strong>.
          </div>
        ) : null}

        {isSuccess ? (
          <div className="contact-success">
            <span className="success-icon">OK</span>
            Message sent successfully. We will get back to you soon.
          </div>
        ) : null}

        {isError ? (
          <div className="contact-error">
            {error?.data?.message || 'Something went wrong. Please try again.'}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="contact-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="Your name"
                {...register('name', {
                  required: 'Name is required',
                  pattern: {
                    value: /^[A-Za-z][A-Za-z\s'-]*$/,
                    message: 'Use letters, spaces, apostrophes, or hyphens only',
                  },
                })}
                className={errors.name ? 'error' : ''}
              />
              {errors.name ? (
                <span className="error-message">{errors.name.message}</span>
              ) : null}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address',
                  },
                })}
                className={errors.email ? 'error' : ''}
              />
              {errors.email ? (
                <span className="error-message">{errors.email.message}</span>
              ) : null}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select id="category" {...register('category')}>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select id="priority" {...register('priority')}>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gymId">Gym context</label>
              <select id="gymId" {...register('gymId')}>
                <option value="">Not related to a gym</option>
                {gyms.map((gym) => (
                  <option key={gym.id} value={gym.id}>{gym.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject</label>
              <input
                id="subject"
                type="text"
                placeholder="What is this about?"
                {...register('subject', {
                  required: 'Subject is required',
                  validate: (value) => value.trim().length > 0 || 'Subject cannot be empty',
                })}
                className={errors.subject ? 'error' : ''}
              />
              {errors.subject ? (
                <span className="error-message">{errors.subject.message}</span>
              ) : null}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              rows={6}
              placeholder="Describe the issue, include order numbers or membership details when relevant, and tell us what outcome you need."
              {...register('message', {
                required: 'Message is required',
                validate: (value) => value.trim().length > 0 || 'Message cannot be empty',
              })}
              className={errors.message ? 'error' : ''}
            />
            {errors.message ? (
              <span className="error-message">{errors.message.message}</span>
            ) : (
              <span className="contact-helper">The assigned admin or manager will see your category, priority, and optional gym link.</span>
            )}
          </div>

          <button type="submit" disabled={isLoading} className="submit-btn primary-button">
            {isLoading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactPage;
