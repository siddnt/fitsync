import { Link } from 'react-router-dom';
import supportImg from '../../assets/support.png';
import './SupportPage.css';

const SupportPage = () => {
  return (
    <div className="support-page">
      <div className="support-hero">
        <div className="support-hero__bg" style={{ backgroundImage: `url(${supportImg})` }}></div>
        <div className="support-hero__content">
          <h1>Help & Support</h1>
          <p>How can we help you today?</p>
        </div>
      </div>
      <div className="support-container">

        <div className="support-grid">
          <div className="support-card">
            <div className="support-icon">🏋️</div>
            <h3>Gym Memberships</h3>
            <p>Questions about joining a gym, membership plans, or cancellations.</p>
          </div>

          <div className="support-card">
            <div className="support-icon">👤</div>
            <h3>Account Issues</h3>
            <p>Help with login, password reset, profile settings, or account security.</p>
          </div>

          <div className="support-card">
            <div className="support-icon">🛒</div>
            <h3>Marketplace Orders</h3>
            <p>Track orders, returns, refunds, or product inquiries.</p>
          </div>

          <div className="support-card">
            <div className="support-icon">💪</div>
            <h3>Trainer Services</h3>
            <p>Questions about trainer assignments, sessions, or feedback.</p>
          </div>
        </div>

        <div className="support-contact">
          <h2>Still need help?</h2>
          <p>Our support team is here to assist you.</p>
          <div className="support-options">
            <div className="support-option">
              <span className="option-icon">📧</span>
              <div>
                <h4>Email Us</h4>
                <p>support@fitsync.com</p>
              </div>
            </div>
            <div className="support-option">
              <span className="option-icon">💬</span>
              <div>
                <h4>Contact Form</h4>
                <Link to="/contact">Send us a message</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
