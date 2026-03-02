import privacyImg from '../../assets/privacy_policy.png';
import './PrivacyPage.css';

const PrivacyPage = () => {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="legal-hero__bg" style={{ backgroundImage: `url(${privacyImg})` }}></div>
        <div className="legal-hero__content">
          <h1>Privacy Policy</h1>
          <p>Your privacy matters to us</p>
        </div>
      </div>
      <div className="legal-container">
        <p className="legal-updated">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        <section className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support.</p>
          <ul>
            <li>Personal information (name, email, phone number)</li>
            <li>Health and fitness data (with your consent)</li>
            <li>Payment information</li>
            <li>Usage data and preferences</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send related information</li>
            <li>Send promotional communications (with your consent)</li>
            <li>Monitor and analyze trends and usage</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share your information with:</p>
          <ul>
            <li>Gym owners and trainers you connect with</li>
            <li>Service providers who assist our operations</li>
            <li>Legal authorities when required by law</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Data Security</h2>
          <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
        </section>

        <section className="legal-section">
          <h2>5. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@fitsync.com">privacy@fitsync.com</a></p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
