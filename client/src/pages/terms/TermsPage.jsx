import termsImg from '../../assets/terms_of_service.png';
import './TermsPage.css';

const TermsPage = () => {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="legal-hero__bg" style={{ backgroundImage: `url(${termsImg})` }}></div>
        <div className="legal-hero__content">
          <h1>Terms of Service</h1>
          <p>Please read these terms carefully</p>
        </div>
      </div>
      <div className="legal-container">
        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>By accessing or using FitSync, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
        </section>

        <section className="legal-section">
          <h2>2. Use of Services</h2>
          <p>You agree to use FitSync only for lawful purposes and in accordance with these Terms. You are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of your account</li>
            <li>All activities that occur under your account</li>
            <li>Providing accurate and complete information</li>
            <li>Complying with all applicable laws and regulations</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Membership and Payments</h2>
          <p>Gym memberships and trainer services are subject to the terms set by individual gym owners and trainers. FitSync facilitates these transactions but is not responsible for:</p>
          <ul>
            <li>Quality of services provided by gyms or trainers</li>
            <li>Disputes between users and service providers</li>
            <li>Refunds (handled by individual providers)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>4. Marketplace</h2>
          <p>Products sold through our marketplace are provided by third-party sellers. FitSync is not responsible for product quality, shipping, or returns. Please review seller policies before purchasing.</p>
        </section>

        <section className="legal-section">
          <h2>5. Limitation of Liability</h2>
          <p>FitSync is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of our services.</p>
        </section>

        <section className="legal-section">
          <h2>6. Contact</h2>
          <p>For questions about these Terms, contact us at <a href="mailto:legal@fitsync.com">legal@fitsync.com</a></p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
