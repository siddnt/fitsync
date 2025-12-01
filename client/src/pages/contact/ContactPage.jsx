import { useForm } from 'react-hook-form';
import { useSubmitContactFormMutation } from '../../services/contactApi';
import './ContactPage.css';

const ContactPage = () => {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm();

    const [submitContactForm, { isLoading, isSuccess, isError, error }] =
        useSubmitContactFormMutation();

    const onSubmit = async (data) => {
        try {
            await submitContactForm(data).unwrap();
            reset();
        } catch (err) {
            console.error('Failed to send message:', err);
        }
    };

    return (
        <div className="contact-page">
            <div className="contact-container">
                <h1>Contact Us</h1>
                <p>Have questions? We'd love to hear from you.</p>

                {isSuccess && (
                    <div className="contact-success">
                        Message sent successfully! We'll get back to you soon.
                    </div>
                )}

                {isError && (
                    <div className="contact-error">
                        {error?.data?.message || 'Something went wrong. Please try again.'}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="contact-form">
                    <div className="form-group">
                        <label htmlFor="name">Name</label>
                        <input
                            id="name"
                            type="text"
                            {...register('name', { required: 'Name is required' })}
                            className={errors.name ? 'error' : ''}
                        />
                        {errors.name && (
                            <span className="error-message">{errors.name.message}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            {...register('email', {
                                required: 'Email is required',
                                pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: 'Invalid email address',
                                },
                            })}
                            className={errors.email ? 'error' : ''}
                        />
                        {errors.email && (
                            <span className="error-message">{errors.email.message}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="message">Message</label>
                        <textarea
                            id="message"
                            rows="5"
                            {...register('message', { required: 'Message is required' })}
                            className={errors.message ? 'error' : ''}
                        />
                        {errors.message && (
                            <span className="error-message">{errors.message.message}</span>
                        )}
                    </div>

                    <button type="submit" disabled={isLoading} className="submit-btn">
                        {isLoading ? 'Sending...' : 'Send Message'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ContactPage;
