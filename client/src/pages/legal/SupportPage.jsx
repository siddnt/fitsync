import { Link } from 'react-router-dom';
import supportBg from '../../assets/contact-support-team.png';
import './LegalPage.css';

const SupportPage = () => (
  <div className="legal-page__wrapper" style={{ backgroundImage: `url(${supportBg})` }}>
    <div className="legal-page__overlay"></div>
    <div className="legal-page">
      <header className="legal-page__header">
        <h1>Support</h1>
        <p className="legal-page__intro">
          Need help? We are here to support trainees, trainers, gym owners, and sellers.
        </p>
      </header>

      <section className="legal-page__section">
        <h2>Common topics</h2>
        <ul>
          <li>Login and password reset issues.</li>
          <li>Trainer assignments and trainee updates.</li>
          <li>Membership billing and subscription questions.</li>
        </ul>
      </section>

      <section className="legal-page__section">
        <h2>Contact support</h2>
        <p>
          For direct help, use the contact form on the <Link to="/contact">Contact page</Link>.
        </p>
      </section>
    </div>
  </div>
);

export default SupportPage;
