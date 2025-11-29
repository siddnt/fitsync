import React, { useState } from 'react';
import contactImg from '../../assets/contact_us.png';
import './ContactPage.css';

const ContactPage = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: ''
    });
    const [submitted, setSubmitted] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle form submission logic here
        console.log('Form submitted:', formData);
        setSubmitted(true);
        setFormData({ name: '', email: '', subject: '', message: '' });
        setTimeout(() => setSubmitted(false), 5000);
    };

    return (
        <div className="contact-page">
            <div className="contact-hero">
                <div className="contact-hero__bg" style={{ backgroundImage: `url(${contactImg})` }}></div>
                <div className="contact-hero__content">
                    <h1>Get In <span className="text-gradient">Touch</span></h1>
                    <p>Have questions or feedback? We'd love to hear from you. Reach out and let's connect.</p>
                </div>
            </div>

            <div className="contact-section">
                <div className="contact-container">
                    <div className="contact-info">
                        <h2>Contact Information</h2>
                        <p>Fill out the form and our team will get back to you within 24 hours.</p>
                        
                        <div className="info-items">
                            <div className="info-item">
                                <div className="info-icon">📧</div>
                                <div className="info-text">
                                    <h4>Email</h4>
                                    <p>support@fitsync.com</p>
                                </div>
                            </div>
                            <div className="info-item">
                                <div className="info-icon">📍</div>
                                <div className="info-text">
                                    <h4>Location</h4>
                                    <p>123 Fitness Street, Health City</p>
                                </div>
                            </div>
                            <div className="info-item">
                                <div className="info-icon">📞</div>
                                <div className="info-text">
                                    <h4>Phone</h4>
                                    <p>+1 (555) 123-4567</p>
                                </div>
                            </div>
                        </div>

                        <div className="social-links">
                            <h4>Follow Us</h4>
                            <div className="social-icons">
                                <a href="#" className="social-icon" aria-label="Facebook">FB</a>
                                <a href="#" className="social-icon" aria-label="Twitter">TW</a>
                                <a href="#" className="social-icon" aria-label="Instagram">IG</a>
                                <a href="#" className="social-icon" aria-label="LinkedIn">LI</a>
                            </div>
                        </div>
                    </div>

                    <div className="contact-form-container">
                        {submitted && (
                            <div className="success-message">
                                Thank you! Your message has been sent successfully.
                            </div>
                        )}
                        <form className="contact-form" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="name">Full Name</label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Your name"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email Address</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="subject">Subject</label>
                                <input
                                    type="text"
                                    id="subject"
                                    name="subject"
                                    value={formData.subject}
                                    onChange={handleChange}
                                    placeholder="How can we help?"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="message">Message</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    placeholder="Your message..."
                                    rows="5"
                                    required
                                ></textarea>
                            </div>
                            <button type="submit" className="submit-btn">
                                Send Message
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
