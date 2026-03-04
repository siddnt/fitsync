import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  useAcceptTermsMutation,
  useCheckLegalStatusQuery,
  useGetLegalVersionsQuery,
} from '../../services/legalApi';
import termsImg from '../../assets/terms_of_service.png';
import './TermsPage.css';
import '../legal/LegalPageStyles.css';

const TermsPage = () => {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth?.user);
  const [acceptTerms, { isLoading, isSuccess, isError, error }] = useAcceptTermsMutation();
  const [showAcceptButton, setShowAcceptButton] = useState(true);
  const [hasAccepted, setHasAccepted] = useState(false);
  const { data: legalStatus } = useCheckLegalStatusQuery(undefined, { skip: !user });
  const { data: legalVersions } = useGetLegalVersionsQuery();

  useEffect(() => {
    if (!user) {
      setShowAcceptButton(false);
      return;
    }

    if (legalStatus?.data?.needsTermsAcceptance === false) {
      setShowAcceptButton(false);
    }
  }, [legalStatus, user]);

  const handleAcceptTerms = async () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }

    if (!hasAccepted) {
      return;
    }
    try {
      const version =
        legalVersions?.data?.termsVersion ??
        legalStatus?.data?.currentTermsVersion ??
        '1.0';

      await acceptTerms({ version }).unwrap();
      setShowAcceptButton(false);
      // Redirect to legal acceptance page to continue flow
      setTimeout(() => {
        navigate('/legal-acceptance', { replace: true });
      }, 700);
    } catch (err) {
      console.error('Failed to accept terms:', err);
    }
  };

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

        {/* PHASE 1: Accept Terms Section */}
        {showAcceptButton && (
            <div className="legal-accept-section">
              <h2>Accept Terms of Service</h2>
              <p>You must accept these terms to continue using FitSync</p>
              {isSuccess && (
                <div className="legal-success-message">
                  ✓ Terms accepted successfully
                </div>
              )}
              {isError && (
                <div className="legal-error-message">
                  ✗ Failed to accept terms: {error?.data?.message || 'Please try again'}
                </div>
              )}
              <div className="legal-accept-controls">
                <label className="legal-accept-checkbox" htmlFor="accept-terms">
                  <input
                    id="accept-terms"
                    type="checkbox"
                    checked={hasAccepted}
                    onChange={(event) => setHasAccepted(event.target.checked)}
                    disabled={isLoading || isSuccess}
                  />
                  <span className="legal-accept-label">
                    I have read and accept the Terms of Service
                  </span>
                </label>
                <div className="legal-accept-actions">
                  <button
                    className="btn-accept-legal"
                    onClick={handleAcceptTerms}
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

export default TermsPage;
