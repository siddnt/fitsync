import termsBg from '../../assets/register-bg-final.png';
import './LegalPage.css';

const TermsPage = () => (
  <div className="legal-page__wrapper" style={{ backgroundImage: `url(${termsBg})` }}>
    <div className="legal-page__overlay"></div>
    <div className="legal-page">
      <header className="legal-page__header">
        <h1>Terms of Service</h1>
        <p className="legal-page__intro">
          By using FitSync, you agree to the terms below. These keep the platform safe and fair for everyone.
        </p>
      </header>

      <section className="legal-page__section">
        <h2>Account responsibility</h2>
        <ul>
          <li>Keep your login credentials secure.</li>
          <li>Provide accurate information during registration.</li>
          <li>Do not share your account with others.</li>
        </ul>
      </section>

      <section className="legal-page__section">
        <h2>Acceptable use</h2>
        <ul>
          <li>Use the platform only for fitness-related activities.</li>
          <li>Respect other users and do not upload harmful content.</li>
          <li>Do not attempt to disrupt or reverse engineer services.</li>
        </ul>
      </section>

      <section className="legal-page__section">
        <h2>Service updates</h2>
        <p>
          We may improve or change features over time. We will notify users when changes impact core functionality.
        </p>
      </section>
    </div>
  </div>
);

export default TermsPage;
