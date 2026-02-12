import privacyBg from '../../assets/auth-bg.png';
import './LegalPage.css';

const PrivacyPage = () => (
  <div className="legal-page__wrapper" style={{ backgroundImage: `url(${privacyBg})` }}>
    <div className="legal-page__overlay"></div>
    <div className="legal-page">
      <header className="legal-page__header">
        <h1>Privacy Policy</h1>
        <p className="legal-page__intro">
          This page explains how FitSync collects and uses data to support your fitness journey.
        </p>
      </header>

      <section className="legal-page__section">
        <h2>What we collect</h2>
        <ul>
          <li>Account details such as name, email, and role.</li>
          <li>Workout activity and progress shared by trainers.</li>
          <li>Basic usage analytics to improve the platform.</li>
        </ul>
      </section>

      <section className="legal-page__section">
        <h2>How we use it</h2>
        <ul>
          <li>To personalize dashboards and training updates.</li>
          <li>To provide support and keep your account secure.</li>
          <li>To improve product performance and reliability.</li>
        </ul>
      </section>

      <section className="legal-page__section">
        <h2>Your control</h2>
        <p>
          You can update your profile information at any time. Contact support if you want to delete your account
          or export your data.
        </p>
      </section>
    </div>
  </div>
);

export default PrivacyPage;
