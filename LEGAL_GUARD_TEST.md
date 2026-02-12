# Legal Guard Implementation & Testing Guide

## Overview

The Legal Guard is a route protection mechanism that ensures users accept Terms of Service and Privacy Policy before accessing dashboard features.

## Architecture

### Components

1. **LegalGuard.jsx** - Route wrapper that checks legal status before allowing access
   - Location: `client/src/guards/LegalGuard.jsx`
   - Purpose: Protects `/dashboard` and child routes
   - Flow: User → Check Auth → Check Legal Status → Allow/Redirect

2. **legalApi.js** - RTK Query API service
   - Location: `client/src/services/legalApi.js`
   - Endpoints:
     - `GET /api/legal/versions` - Public, get current versions
     - `GET /api/legal/status` - Protected, check user's acceptance status
     - `POST /api/legal/terms/accept` - Protected, record terms acceptance
     - `POST /api/legal/privacy/accept` - Protected, record privacy acceptance

3. **Legal Controller** - Backend business logic
   - Location: `src/api/controllers/legal.controller.js`
   - Functions:
     - `checkLegalStatus()` - Returns boolean flags for needs acceptance
     - `acceptTerms()` - Records terms acceptance with timestamp and IP
     - `acceptPrivacy()` - Records privacy acceptance with timestamp and IP
     - `getLegalVersions()` - Returns current version numbers

4. **User Model** - Legal fields
   - Location: `src/models/user.model.js`
   - Fields in `legal` sub-document:
     - `termsAccepted` (Boolean, default: false)
     - `termsVersion` (String, default: null)
     - `termsAcceptedAt` (Date, default: null)
     - `privacyAccepted` (Boolean, default: false)
     - `privacyVersion` (String, default: null)
     - `privacyAcceptedAt` (Date, default: null)
     - `acceptanceIP` (String, default: null)

## Expected Flow

### New User Registration → Dashboard Access

1. **User completes registration**
   ```
   POST /api/auth/register
   {
     firstName, lastName, email, password, ...
   }
   Response: {user, accessToken, refreshToken}
   ```
   - New user created with `legal` field initialized to defaults
   - All acceptance flags default to `false`

2. **User logs in (automatic after registration)**
   - Redux auth state updated with user object
   - Frontend stores accessToken and refreshToken

3. **User navigates to /dashboard**
   - AppRouter matches route
   - LegalGuard component mounts
   - Checks: `useSelector(state => state.auth?.user)`
   - User exists? YES → Proceed to check legal status

4. **LegalGuard queries legal status**
   ```
   GET /api/legal/status (with auth header)
   Response: {
     data: {
       needsTermsAcceptance: true,
       needsPrivacyAcceptance: true,
       ...otherFields
     }
   }
   ```

5. **LegalGuard evaluates needs**
   ```javascript
   const needsTermsAcceptance = legalStatus?.data?.needsTermsAcceptance ?? true;
   const needsPrivacyAcceptance = legalStatus?.data?.needsPrivacyAcceptance ?? true;
   
   if (needsTermsAcceptance || needsPrivacyAcceptance) {
     // REDIRECT TO /legal-acceptance
   }
   ```

6. **User redirected to /legal-acceptance page**
   - Shows: "You must accept our Terms and Privacy Policy"
   - Shows buttons for each needed document
   - State includes `from: /dashboard` for redirect after acceptance

7. **User clicks "Accept Terms"**
   - Navigates to `/terms`
   - TermsPage shows full terms document
   - At bottom: "Accept Terms" button
   
8. **User clicks "Accept Terms" button**
   ```
   POST /api/legal/terms/accept
   {version: "1.0"}
   Response: {data: {termsAccepted: true, version: "1.0", acceptedAt: timestamp}}
   ```
   - Backend updates user.legal.termsAccepted = true
   - Backend records timestamp and IP
   - Frontend invalidates Legal cache
   - Frontend shows success message

9. **User navigated back or goes to /legal-acceptance**
   - LegalAcceptancePage refetches legal status
   - `needsTermsAcceptance` now false
   - `needsPrivacyAcceptance` still true
   - Shows only Privacy button

10. **User accepts privacy policy (same as terms)**
    - Navigates to `/privacy`
    - Clicks "Accept Privacy" button
    - Backend records acceptance
    - Frontend invalidates cache

11. **LegalAcceptancePage detects all accepted**
    ```javascript
    useEffect(() => {
      if (!needsTermsAcceptance && !needsPrivacyAcceptance) {
        navigate('/dashboard', {replace: true});
      }
    })
    ```
    - Auto-redirects to dashboard

12. **User accesses dashboard**
    - LegalGuard checks status again
    - Both flags are false
    - Allows access
    - DashboardLayout renders

## Testing Procedure

### Setup

1. **Start backend server**
   ```bash
   npm run dev
   # Should see: "Server listening on port 4000"
   # Should see: "MongoDB connected"
   ```

2. **Start frontend server**
   ```bash
   cd client
   npm run dev
   # Should see: "VITE v7.2.6 ready in ... ms"
   # Should see: "Local: http://localhost:5173"
   ```

3. **Open browser**
   - Navigate to `http://localhost:5173`
   - Open DevTools (F12)
   - Go to Console tab

### Test Case 1: New User Registration → Legal Guard Redirect

**Steps:**
1. On landing page, click "Get Started" or auth link
2. Go to Register page
3. Fill in form:
   - Name: "Test User"
   - Email: "testuser+{timestamp}@example.com" (unique each time)
   - Password: "Test123!@#"
   - Confirm Password: "Test123!@#"
4. Click "Create Account"
5. **EXPECTED**: Should see legal acceptance page, NOT dashboard

**What to check in Console:**
```javascript
// Look for logs like:
[LegalGuard] User authenticated, checking legal status
[LegalGuard] Checking legal status...
[LegalGuard] Legal Status Check: {
  hasData: true,
  needsTermsAcceptance: true,
  needsPrivacyAcceptance: true,
  rawResponse: {...}
}
[LegalGuard] User must accept legal documents, redirecting...
```

**What to check in Network tab:**
1. After registration, should see POST `/api/auth/register` - 201 Success
2. Should see GET `/api/legal/status` - 200 Success
3. Response body should have:
   ```json
   {
     "data": {
       "needsTermsAcceptance": true,
       "needsPrivacyAcceptance": true,
       ...
     }
   }
   ```

### Test Case 2: Accept Terms

**Steps:**
1. On legal-acceptance page, click "Accept Terms"
2. Should navigate to `/terms`
3. Scroll to bottom, click "Accept Terms" button
4. **EXPECTED**: 
   - Success message appears
   - Button disabled
   - Redirect to legal-acceptance page

**What to check in Network tab:**
1. Should see POST `/api/legal/terms/accept` - 200 Success
2. Response should have:
   ```json
   {
     "data": {
       "termsAccepted": true,
       "version": "1.0",
       "acceptedAt": "2024-XX-XX..."
     }
   }
   ```

**Backend Console should show:**
```javascript
{
  timestamp: "2024-XX-XX...",
  userId: "...",
  email: "testuser+...",
  action: "terms_accepted",
  version: "1.0",
  ip: "..."
}
```

### Test Case 3: Legal Acceptance Page Shows Updated Status

**Steps:**
1. After terms acceptance, should be back on legal-acceptance page
2. **EXPECTED**: 
   - Only "Accept Privacy" button shown
   - "Terms: Accepted" text visible
   - LegalAcceptancePage called refetch()

**What to check in Console:**
```javascript
[LegalGuard] Legal Status Check: {
  hasData: true,
  needsTermsAcceptance: false,
  needsPrivacyAcceptance: true,
  ...
}
```

### Test Case 4: Accept Privacy Policy

**Steps:**
1. Click "Accept Privacy" button
2. Navigate to `/privacy`
3. Scroll to bottom, click "Accept Privacy" button
4. **EXPECTED**: Same flow as terms acceptance

**What to check in Network:**
- POST `/api/legal/privacy/accept` - 200 Success

### Test Case 5: Auto-Redirect After All Accepted

**Steps:**
1. After privacy acceptance, should auto-redirect to `/dashboard`
2. Dashboard should load
3. **EXPECTED**: No legal-acceptance page, no guard blocking

**What to check in Console:**
```javascript
[LegalGuard] User has accepted all documents, allowing access
// LegalAcceptancePage logs:
All legal documents accepted, redirecting to: /dashboard
```

### Test Case 6: Refresh Page - Legal Status Persists

**Steps:**
1. On dashboard, press F5 (refresh page)
2. **EXPECTED**: Dashboard still accessible, no re-prompt for legal

**What to check:**
- LegalGuard query should return false for both flags
- No redirect happens

**Network check:**
- GET `/api/legal/status` should show both false

## Common Issues & Debugging

### Issue 1: User redirects to legal-acceptance but should go to dashboard

**Diagnosis:**
1. Check Console for LegalGuard logs
2. Check Network → XHR → Look for GET `/api/legal/status` response
3. Check if `needsTermsAcceptance` is `true` when it should be `false`

**Solutions:**
- Check user's acceptance timestamp in MongoDB:
  ```javascript
  db.users.findOne({email: "testuser..."}).legal
  // Should show: termsAccepted: true, privacyAccepted: true
  ```
- If empty/missing, user record might not be saving properly
- Check backend logs for errors in acceptTerms/acceptPrivacy

### Issue 2: Legal status query returns undefined

**Diagnosis:**
1. Console shows: `[LegalGuard] No legal status data received`
2. Network shows GET `/api/legal/status` 200 but empty response

**Solutions:**
- Check backend `/api/legal/status` endpoint
- Ensure `checkLegalStatus` is exporting properly
- Check route configuration in `legal.routes.js`

### Issue 3: Accept button doesn't update legal status

**Diagnosis:**
1. User clicks "Accept Terms"
2. Button shows loading, then nothing happens
3. No POST request in Network tab

**Solutions:**
- Check auth token is being sent:
  - Network → POST `/api/legal/terms/accept`
  - Headers → Authorization: Bearer <token>
- Check mutation in legalApi is defined correctly
- Check backend acceptTerms controller for errors

### Issue 4: User can access dashboard without accepting

**Diagnosis:**
1. Skip legal-acceptance page
2. Direct access to /dashboard works

**Causes:**
- LegalGuard not rendering properly
- legalStatus returning both flags as false incorrectly
- RTK Query cache returning stale data

**Debug:**
```javascript
// In browser console
store.getState().auth.user // Should exist
// Should see GET /api/legal/status in Network
```

## Database Inspection

### Check User's Legal Status

```javascript
// In MongoDB Compass or mongosh
db.users.findOne({email: "testuser@example.com"})

// Should show:
{
  _id: ObjectId("..."),
  email: "testuser@example.com",
  legal: {
    termsAccepted: true,
    termsVersion: "1.0",
    termsAcceptedAt: ISODate("2024-..."),
    privacyAccepted: true,
    privacyVersion: "1.0",
    privacyAcceptedAt: ISODate("2024-..."),
    acceptanceIP: "::1" or actual IP
  }
}
```

## Logs to Monitor

### Frontend Console (DevTools)

```
[LegalGuard] User authenticated, checking legal status
[LegalGuard] Checking legal status...
[LegalGuard] Legal Status Check: {...}
[LegalGuard] User must accept legal documents, redirecting...
// OR
[LegalGuard] User has accepted all documents, allowing access
```

### Backend Console (Terminal)

```javascript
// From checkLegalStatus
{
  timestamp: "2024-...",
  userId: "...",
  action: "check_legal_status",
  userLegal: {...},
  needsTermsAcceptance: true/false,
  needsPrivacyAcceptance: true/false
}

// From acceptTerms
{
  timestamp: "2024-...",
  userId: "...",
  email: "...",
  action: "terms_accepted",
  version: "1.0",
  ip: "..."
}
```

## Success Criteria Checklist

- [ ] New user registration creates account with legal fields
- [ ] LegalGuard redirects unauthenticated users to legal-acceptance
- [ ] Legal-acceptance page loads with proper buttons
- [ ] User can click "Accept Terms" and navigate to terms page
- [ ] Terms page has "Accept Terms" button that works
- [ ] POST `/api/legal/terms/accept` returns 200 with termsAccepted: true
- [ ] Backend logs acceptance with timestamp and IP
- [ ] Legal-acceptance page shows updated status (only privacy needed)
- [ ] User can accept privacy policy (same flow as terms)
- [ ] After both accepted, auto-redirect to dashboard
- [ ] LegalGuard allows access to dashboard
- [ ] Refreshing dashboard doesn't re-prompt for legal
- [ ] Multiple new users each get their own legal records
- [ ] Existing users (pre-Phase1) default to needing acceptance
- [ ] Old versions of terms/privacy trigger re-acceptance

## Notes

- Default CURRENT_TERMS_VERSION = "1.0"
- Default CURRENT_PRIVACY_VERSION = "1.0"
- Increasing version forces users to re-accept
- IP address recorded for audit/legal purposes
- All timestamps in UTC (MongoDB ISODate)
- Legal acceptance cannot be undone (only version updates trigger re-acceptance)

