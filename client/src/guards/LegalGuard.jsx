/**
 * LEGAL GUARD COMPONENT
 * 
 * Protects routes by checking if user has accepted required legal documents
 * Redirects to legal acceptance pages if needed
 */

import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCheckLegalStatusQuery } from '../services/legalApi';
import { useSelector } from 'react-redux';

const LegalGuard = ({ children }) => {
  const location = useLocation();
  const user = useSelector(state => state.auth?.user);
  const [loading, setLoading] = useState(true);
  const [canAccess, setCanAccess] = useState(false);
  
  // Only check legal status if user is logged in
  // Important: We need to trigger a fresh query each time
  const { data: legalStatus, isLoading: isCheckingLegal, error: legalError } = useCheckLegalStatusQuery(
    undefined,
    { skip: !user || user?.role === 'admin' } // Skip query if not authenticated or admin
  );

  useEffect(() => {
    // Not logged in - allow access (will be redirected by auth guard)
    if (!user) {
      setCanAccess(true);
      setLoading(false);
      return;
    }

    // Admins are not required to accept legal documents
    if (user?.role === 'admin') {
      setCanAccess(true);
      setLoading(false);
      return;
    }

    // Still loading legal status
    if (isCheckingLegal) {
      console.log('[LegalGuard] Checking legal status...');
      setLoading(true);
      return;
    }

    // Error occurred - deny access to be safe
    if (legalError) {
      console.error('[LegalGuard] Legal status check error:', legalError);
      setCanAccess(false);
      setLoading(false);
      return;
    }

    // Ensure we have data - if undefined, default to needs acceptance
    if (!legalStatus) {
      console.warn('[LegalGuard] No legal status data received, defaulting to requiring acceptance');
      setCanAccess(false);
      setLoading(false);
      return;
    }

    // Check if user has accepted all required legal documents
    // Default to true (needs acceptance) if data is missing (for new users)
    const responseData = legalStatus.data || legalStatus;
    const needsTermsAcceptance = responseData?.needsTermsAcceptance ?? true;
    const needsPrivacyAcceptance = responseData?.needsPrivacyAcceptance ?? true;

    console.log('[LegalGuard] Legal Status Check:', {
      hasData: !!legalStatus,
      needsTermsAcceptance,
      needsPrivacyAcceptance,
      rawResponse: legalStatus
    });

    // User needs to accept legal documents
    if (needsTermsAcceptance || needsPrivacyAcceptance) {
      console.log('[LegalGuard] User must accept documents, denying access');
      setCanAccess(false);
    } else {
      console.log('[LegalGuard] User accepted all documents, allowing access');
      setCanAccess(true);
    }

    setLoading(false);
  }, [user, legalStatus, isCheckingLegal, legalError]);

  // Still checking legal status
  if (loading) {
    return (
      <div className="legal-guard-loading">
        <div className="spinner"></div>
        <p>Verifying your account...</p>
      </div>
    );
  }

  // User hasn't accepted legal documents
  if (!canAccess) {
    return <Navigate to="/legal-acceptance" state={{ from: location }} replace />;
  }

  // User has accepted or is not logged in
  return children;
};

export default LegalGuard;
