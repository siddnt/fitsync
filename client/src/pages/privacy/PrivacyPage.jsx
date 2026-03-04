import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useAcceptPrivacyMutation,
  useCheckLegalStatusQuery,
  useGetLegalVersionsQuery,
} from '../../services/legalApi';
import privacyImg from '../../assets/privacy_policy.png';
import './PrivacyPage.css';
import '../legal/LegalPageStyles.css';

const PrivacyPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth?.user);
  const [acceptPrivacy, { isLoading, isSuccess, isError, error }] = useAcceptPrivacyMutation();
  const [showAcceptButton, setShowAcceptButton] = useState(true);
  const [hasAccepted, setHasAccepted] = useState(false);
  const { data: legalStatus } = useCheckLegalStatusQuery(undefined, { skip: !user });
  const { data: legalVersions } = useGetLegalVersionsQuery();

  useEffect(() => {
    if (!user) {
      setShowAcceptButton(false);
      return;
    }

    if (legalStatus?.data?.needsPrivacyAcceptance === false) {
      setShowAcceptButton(false);
    }
  }, [legalStatus, user]);

  const handleAcceptPrivacy = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!hasAccepted) {
      return;
    }
    try {
      const version =
        legalVersions?.data?.privacyVersion ??
        legalStatus?.data?.currentPrivacyVersion ??
        '1.0';

      await acceptPrivacy({ version }).unwrap();
      setShowAcceptButton(false);
      // Redirect to legal acceptance page to continue flow
      setTimeout(() => {
        navigate('/legal-acceptance', { replace: true });
      }, 700);
    } catch (err) {
      console.error('Failed to accept privacy policy:', err);
    }
  };

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

        {/* PHASE 1: Accept Privacy Section */}
        {showAcceptButton && (
            <div className="legal-accept-section">
              <h2>Accept Privacy Policy</h2>
              <p>You must accept our privacy policy to continue using FitSync</p>
              {isSuccess && (
                <div className="legal-success-message">
                  ✓ Privacy policy accepted successfully
                </div>
              )}
              {isError && (
                <div className="legal-error-message">
                  ✗ Failed to accept privacy policy: {error?.data?.message || 'Please try again'}
                </div>
              )}
              <div className="legal-accept-controls">
                <label className="legal-accept-checkbox" htmlFor="accept-privacy">
                  <input
                    id="accept-privacy"
                    type="checkbox"
                    checked={hasAccepted}
                    onChange={(event) => setHasAccepted(event.target.checked)}
                    disabled={isLoading || isSuccess}
                  />
                  <span className="legal-accept-label">
                    I have read and accept the Privacy Policy
                  </span>
                </label>
                <div className="legal-accept-actions">
                  <button
                    className="btn-accept-legal"
                    onClick={handleAcceptPrivacy}
                    disabled={!hasAccepted || isLoading || isSuccess}
                  >
                    {isLoading ? 'Submitting...' : isSuccess ? 'Submitted ✓' : 'Submit acceptance'}
                  </button>
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default PrivacyPage;
