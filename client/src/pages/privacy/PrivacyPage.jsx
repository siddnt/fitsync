import privacyImg from '../../assets/privacy_policy.png';
import './PrivacyPage.css';

const PrivacyPage = () => {
  const updatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="legal-hero__bg" style={{ backgroundImage: `url(${privacyImg})` }} />
        <div className="legal-hero__content">
          <h1>Privacy Policy</h1>
          <p>How FitSync handles account, operational, and commerce data</p>
        </div>
      </div>
      <div className="legal-container">
        <p className="legal-updated">Last updated: {updatedDate}</p>
        <div className="legal-summary">
          <article className="legal-summary__card">
            <small>What we collect</small>
            <strong>Account, fitness, and transaction data</strong>
            <span>Only the fields needed to run memberships, bookings, support, marketplace orders, and analytics.</span>
          </article>
          <article className="legal-summary__card">
            <small>How we use it</small>
            <strong>Service delivery and product operations</strong>
            <span>Data is used to power the product, not sold as a separate commercial asset.</span>
          </article>
          <article className="legal-summary__card">
            <small>Your control</small>
            <strong>Request updates or support review</strong>
            <span>Profile changes, account context, and privacy questions can be routed through the support workflow.</span>
          </article>
        </div>
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
          <h2>4. Data Retention and Access</h2>
          <p>
            We retain operational records such as bookings, invoices, support conversations, and audit events only
            for as long as they are needed to run the service, resolve disputes, or satisfy legal obligations.
          </p>
          <p>
            If you need help correcting account information or understanding what data is tied to your profile,
            contact the FitSync support team using the in-app contact route.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Data Security</h2>
          <p>We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
        </section>

        <section className="legal-section">
          <h2>6. Contact Us</h2>
          <p>If you have questions about this Privacy Policy, please contact us at <a href="mailto:privacy@fitsync.com">privacy@fitsync.com</a> or use the in-app support form for account-specific requests.</p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
