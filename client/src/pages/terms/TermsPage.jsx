import termsImg from '../../assets/terms_of_service.png';
import './TermsPage.css';

const TermsPage = () => {
  return (
    <div className="legal-page">
      <div className="legal-hero">
        <div className="legal-hero__bg" style={{ backgroundImage: `url(${termsImg})` }} />
        <div className="legal-hero__content">
          <h1>Terms of Service</h1>
          <p>Key rules for using FitSync memberships, services, and marketplace flows</p>
        </div>
      </div>
      <div className="legal-container">
        <div className="legal-summary">
          <article className="legal-summary__card">
            <small>Platform role</small>
            <strong>FitSync coordinates workflows</strong>
            <span>We connect members, trainers, owners, sellers, and support operations through one system.</span>
          </article>
          <article className="legal-summary__card">
            <small>Transactions</small>
            <strong>Some fulfilment is provider-led</strong>
            <span>Gyms, trainers, and sellers still own the underlying service or product they deliver.</span>
          </article>
          <article className="legal-summary__card">
            <small>Support path</small>
            <strong>Questions should be routed in-app</strong>
            <span>Membership, billing, and marketplace issues move faster when they carry the correct context.</span>
          </article>
        </div>

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
          <p>Products sold through our marketplace are provided by third-party sellers. FitSync provides checkout, order visibility, and support routing, but sellers still control their own catalog, fulfillment, and return handling.</p>
        </section>

        <section className="legal-section">
          <h2>5. Acceptable Use</h2>
          <p>You may not misuse the platform, interfere with other users, upload unlawful content, or use FitSync to misrepresent gym listings, trainer services, or marketplace products.</p>
        </section>

        <section className="legal-section">
          <h2>6. Limitation of Liability</h2>
          <p>FitSync is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of our services.</p>
        </section>

        <section className="legal-section">
          <h2>7. Contact</h2>
          <p>For questions about these Terms, contact us at <a href="mailto:legal@fitsync.com">legal@fitsync.com</a> or use the in-app contact form for account-specific issues.</p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
