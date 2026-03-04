/**
 * LEGAL ACCEPTANCE PAGE
 * 
 * Shows when user needs to accept terms and/or privacy policy
 * Redirects based on what needs acceptance
 */

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useCheckLegalStatusQuery } from '../../services/legalApi';
import './LegalAcceptancePage.css';

const LegalAcceptancePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth?.user);
  const { data: legalStatus, isLoading, refetch } = useCheckLegalStatusQuery(undefined, { skip: !user });

  // Use ?? true to default to needing acceptance if undefined
  const needsTermsAcceptance = legalStatus?.data?.needsTermsAcceptance ?? true;
  const needsPrivacyAcceptance = legalStatus?.data?.needsPrivacyAcceptance ?? true;

  useEffect(() => {
    // Refetch legal status when page loads to ensure fresh data
    if (user) {
      refetch();
    }
  }, [refetch, user]);

  useEffect(() => {
    // If already accepted both, redirect back
    if (!isLoading && !needsTermsAcceptance && !needsPrivacyAcceptance) {
      const from = location.state?.from?.pathname || '/dashboard';
      console.log('All legal documents accepted, redirecting to:', from);
      navigate(from, { replace: true });
    }
  }, [needsTermsAcceptance, needsPrivacyAcceptance, isLoading, navigate, location]);

  if (isLoading) {
    return (
      <div className="legal-acceptance-page">
        <div className="legal-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="legal-acceptance-page">
      <div className="legal-acceptance-container">
        <div className="legal-acceptance-header">
          <h1>Welcome to FitSync</h1>
          <p>Before you continue, please review and accept our legal documents</p>
        </div>

        <div className="legal-acceptance-items">
          {/* Terms of Service */}
          {needsTermsAcceptance && (
            <div className="legal-acceptance-item">
              <div className="legal-item-header">
                <h2>📋 Terms of Service</h2>
                <span className="legal-item-status">Required</span>
              </div>
              <p className="legal-item-description">
                Please read and accept our Terms of Service to continue using FitSync.
              </p>
              <button
                className="btn-legal-item"
                onClick={() => navigate('/terms')}
              >
                Review Terms of Service →
              </button>
            </div>
          )}

          {/* Privacy Policy */}
          {needsPrivacyAcceptance && (
            <div className="legal-acceptance-item">
              <div className="legal-item-header">
                <h2>🔒 Privacy Policy</h2>
                <span className="legal-item-status">Required</span>
              </div>
              <p className="legal-item-description">
                Please read and accept our Privacy Policy to continue using FitSync.
              </p>
              <button
                className="btn-legal-item"
                onClick={() => navigate('/privacy')}
              >
                Review Privacy Policy →
              </button>
            </div>
          )}

          {/* Both Accepted */}
          {!needsTermsAcceptance && !needsPrivacyAcceptance && (
            <div className="legal-acceptance-item legal-item-success">
              <h2>✓ All Legal Documents Accepted</h2>
              <p>Thank you for accepting our legal documents. You can now access your dashboard.</p>
              <button
                className="btn-legal-item btn-success"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LegalAcceptancePage;
