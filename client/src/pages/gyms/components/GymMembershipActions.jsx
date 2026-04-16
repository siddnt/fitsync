import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  formatMembershipPlanDuration,
  getMembershipPlanDefinition,
} from '../../../constants/membershipPlans.js';
import './GymMembershipActions.css';

const statusCopy = {
  active: 'Active membership',
  paused: 'Membership paused',
  cancelled: 'Membership cancelled',
  expired: 'Membership expired',
};

const normalizePlanCode = (value) => String(value || '').trim().toLowerCase();

const parseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const formatPlanAmount = (amount, currencyPrefix) => {
  const numeric = parseAmount(amount);
  if (numeric === null) {
    return null;
  }

  return `${currencyPrefix}${numeric.toLocaleString('en-IN')}`;
};

const resolvePlanLabel = (plan) =>
  plan?.label
  || getMembershipPlanDefinition(plan?.code)?.label
  || String(plan?.code || '').trim()
  || 'Membership plan';

const resolvePlanDuration = (plan) =>
  Number(plan?.durationMonths)
  || getMembershipPlanDefinition(plan?.code)?.durationMonths
  || 0;

const GymMembershipActions = ({
  membership = null,
  isLoading = false,
  canManage = false,
  isAuthenticated = false,
  onJoin = undefined,
  onLeave = undefined,
  isJoining = false,
  isLeaving = false,
  error = null,
  userRole = null,
  trainers = [],
  pricingPlans = [],
  currency = 'Rs ',
}) => {
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [localError, setLocalError] = useState(null);

  const isTrainerAccount = userRole === 'trainer';
  const isTrainerMembership = isTrainerAccount && membership?.plan === 'trainer-access';
  const trainerMembershipStatus = isTrainerMembership ? membership?.status ?? null : null;
  const isTrainerPending = trainerMembershipStatus === 'pending';

  const availablePlans = useMemo(
    () => (
      Array.isArray(pricingPlans)
        ? pricingPlans.filter((plan) => plan?.isActive !== false && parseAmount(plan?.price ?? plan?.mrp) !== null)
        : []
    ),
    [pricingPlans],
  );

  const selectedPlan = useMemo(() => {
    const selectedCode = normalizePlanCode(selectedPlanCode);
    return availablePlans.find((plan) => normalizePlanCode(plan.code) === selectedCode) || null;
  }, [availablePlans, selectedPlanCode]);

  const selectedPlanLabel = resolvePlanLabel(selectedPlan);
  const selectedPlanDurationMonths = resolvePlanDuration(selectedPlan);
  const selectedPlanAmount = parseAmount(selectedPlan?.price ?? selectedPlan?.mrp);
  const selectedPlanMrp = parseAmount(selectedPlan?.mrp);
  const selectedPlanDiscount = selectedPlanAmount !== null
    && selectedPlanMrp !== null
    && selectedPlanMrp > selectedPlanAmount
    ? Math.round(((selectedPlanMrp - selectedPlanAmount) / selectedPlanMrp) * 100)
    : 0;
  const currentPlanLabel = resolvePlanLabel({ code: membership?.plan });
  const availablePlanLabels = useMemo(
    () => availablePlans.map((plan) => resolvePlanLabel(plan)),
    [availablePlans],
  );

  const selectedTrainerDetails = useMemo(
    () => trainers.find((trainer) => trainer.id === selectedTrainer),
    [trainers, selectedTrainer],
  );

  const selectedTrainerGenderLabel = useMemo(() => {
    if (!selectedTrainerDetails?.gender) {
      return null;
    }

    const cleaned = selectedTrainerDetails.gender.replace(/-/g, ' ').trim();
    if (!cleaned) {
      return null;
    }

    return cleaned
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }, [selectedTrainerDetails?.gender]);

  useEffect(() => {
    setSelectedPlanCode((currentValue) => {
      const preferredMembershipPlan = normalizePlanCode(membership?.plan);
      const matchingMembershipPlan = availablePlans.find(
        (plan) => normalizePlanCode(plan.code) === preferredMembershipPlan,
      );

      if (matchingMembershipPlan) {
        return matchingMembershipPlan.code;
      }

      const hasCurrentSelection = availablePlans.some(
        (plan) => normalizePlanCode(plan.code) === normalizePlanCode(currentValue),
      );

      return hasCurrentSelection ? currentValue : '';
    });
  }, [availablePlans, membership?.plan]);

  useEffect(() => {
    if (membership?.trainer?.id) {
      setSelectedTrainer(membership.trainer.id);
    } else {
      setSelectedTrainer('');
    }
    setAutoRenew(membership?.autoRenew ?? (isTrainerAccount ? false : true));
  }, [membership?.trainer?.id, membership?.autoRenew, isTrainerAccount]);

  useEffect(() => {
    setLocalError(null);
  }, [selectedPlanCode, selectedTrainer, isTrainerAccount]);

  if (!isAuthenticated) {
    return (
      <div className="gym-membership-actions">
        <p className="gym-membership-actions__message">Sign in as a trainee or trainer to join this gym.</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="gym-membership-actions">
        <p className="gym-membership-actions__message">
          Switch to a trainee or trainer account to manage memberships for this gym.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="gym-membership-actions">
        <p className="gym-membership-actions__hint">Checking membership status...</p>
      </div>
    );
  }

  const status = membership?.status;
  const hasActiveMembership = status === 'active' || status === 'paused';
  const canRejoin = !status || status === 'cancelled' || status === 'expired';
  const showTrainerLeaveButton = isTrainerMembership
    && Boolean(membership?.id)
    && status
    && status !== 'cancelled'
    && status !== 'expired';

  const handleJoinClick = async () => {
    setLocalError(null);

    if (isTrainerAccount) {
      try {
        await onJoin?.({ joinAsTrainer: true });
      } catch (joinError) {
        setLocalError(joinError?.message ?? 'Unable to join the gym. Please try again.');
      }
      return;
    }

    if (!selectedPlan?.code || selectedPlanAmount === null) {
      setLocalError('Select a membership plan to continue.');
      return;
    }

    if (!selectedTrainer) {
      setLocalError('Select a trainer to continue.');
      return;
    }

    try {
      await onJoin?.({
        planCode: selectedPlan.code,
        trainerId: selectedTrainer,
        autoRenew,
      });
    } catch (joinError) {
      setLocalError(joinError?.message ?? 'Unable to join the gym. Please try again.');
    }
  };

  const renderStatus = () => {
    if (!status) {
      return null;
    }

    if (isTrainerMembership) {
      const statusTone = ['cancelled', 'expired'].includes(status)
        ? status
        : status === 'paused' || status === 'pending'
          ? 'paused'
          : 'active';
      const statusLabelMap = {
        active: 'Trainer access active',
        paused: 'Trainer access paused',
        cancelled: 'Trainer access cancelled',
        expired: 'Trainer access expired',
        pending: 'Trainer access pending approval',
      };

      return (
        <span className={`status-pill status-pill--${statusTone}`}>
          {statusLabelMap[status] ?? `Trainer access: ${status}`}
        </span>
      );
    }

    const copy = statusCopy[status] ?? `Status: ${status}`;
    return <span className={`status-pill status-pill--${status}`}>{copy}</span>;
  };

  return (
    <div className="gym-membership-actions">
      <div className="gym-membership-actions__row">
        {renderStatus()}
        {isTrainerAccount ? (
          <span className="gym-membership-actions__hint">
            {isTrainerPending
              ? 'Trainer request submitted. The gym owner will review and approve your listing.'
              : hasActiveMembership
                ? 'Trainees can now select you when joining this gym.'
                : 'Link yourself to this gym to appear as an available trainer. Earnings split 50/50 with the gym owner once trainees select you.'}
          </span>
        ) : membership?.plan ? (
          <span className="gym-membership-actions__hint">Current plan: {currentPlanLabel}</span>
        ) : null}
      </div>

      {isTrainerAccount ? (
        <>
          {localError ? <p className="gym-membership-actions__error">{localError}</p> : null}
          {error ? <p className="gym-membership-actions__error">{error}</p> : null}

          {!isTrainerPending ? (
            <p className="gym-membership-actions__hint">
              Earnings split 50/50 with the gym owner for every trainee who picks you.
            </p>
          ) : null}

          {showTrainerLeaveButton ? (
            <div className="gym-membership-actions__buttons">
              <button
                type="button"
                className="ghost-button"
                onClick={onLeave}
                disabled={isLeaving}
              >
                {isLeaving
                  ? isTrainerPending
                    ? 'Withdrawing...'
                    : 'Leaving...'
                  : isTrainerPending
                    ? 'Withdraw request'
                    : 'Leave trainer roster'}
              </button>
            </div>
          ) : null}

          {canRejoin ? (
            <div className="gym-membership-actions__buttons">
              <button
                type="button"
                className="cta-button"
                onClick={handleJoinClick}
                disabled={isJoining}
              >
                {isJoining ? 'Joining...' : 'Join as trainer'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {selectedPlanAmount !== null ? (
            <>
              <p className="gym-membership-actions__price">
                Selected plan: <strong>{selectedPlanLabel}</strong> for{' '}
                <strong>{formatPlanAmount(selectedPlanAmount, currency)}</strong>
              </p>
              <p className="gym-membership-actions__hint">
                {selectedPlanDurationMonths
                  ? formatMembershipPlanDuration(selectedPlanDurationMonths)
                  : 'Membership duration unavailable'}
                {selectedPlanMrp !== null && selectedPlanMrp > selectedPlanAmount
                  ? ` / MRP ${formatPlanAmount(selectedPlanMrp, currency)} / ${selectedPlanDiscount}% off`
                  : ''}
              </p>
            </>
          ) : availablePlans.length ? (
            <>
              <p className="gym-membership-actions__price">
                Available plans: <strong>{availablePlans.length}</strong>
              </p>
              <p className="gym-membership-actions__hint">
                {availablePlanLabels.join(', ')}. Select a plan to continue.
              </p>
            </>
          ) : (
            <p className="gym-membership-actions__hint">Gym pricing unavailable.</p>
          )}

          {hasActiveMembership ? (
            <div className="gym-membership-actions__buttons">
              <button
                type="button"
                className="ghost-button"
                onClick={onLeave}
                disabled={isLeaving}
              >
                {isLeaving ? 'Leaving...' : 'Leave gym'}
              </button>
            </div>
          ) : null}

          {canRejoin ? (
            <div className="gym-membership-actions__form">
              <div className="gym-membership-actions__label">
                <span>Available plans</span>
                {availablePlans.length ? (
                  <div className="gym-membership-actions__plan-grid" role="radiogroup" aria-label="Select membership plan">
                    {availablePlans.map((plan) => {
                      const amount = formatPlanAmount(plan.price ?? plan.mrp, currency);
                      const durationMonths = resolvePlanDuration(plan);
                      const durationLabel = formatMembershipPlanDuration(durationMonths);
                      const mrp = parseAmount(plan.mrp);
                      const price = parseAmount(plan.price ?? plan.mrp);
                      const discount = price !== null && mrp !== null && mrp > price
                        ? Math.round(((mrp - price) / mrp) * 100)
                        : 0;
                      const isSelected = normalizePlanCode(selectedPlan?.code) === normalizePlanCode(plan.code);

                      return (
                        <button
                          key={plan.code}
                          type="button"
                          className={`gym-membership-actions__plan-card ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setSelectedPlanCode(plan.code)}
                          disabled={isJoining}
                          aria-pressed={isSelected}
                        >
                          <span className="gym-membership-actions__plan-card-top">
                            <strong>{resolvePlanLabel(plan)}</strong>
                            <span>{amount || 'N/A'}</span>
                          </span>
                          <span className="gym-membership-actions__plan-card-meta">
                            {durationLabel || 'Membership duration unavailable'}
                          </span>
                          {mrp !== null && price !== null && mrp > price ? (
                            <span className="gym-membership-actions__plan-card-meta">
                              MRP {formatPlanAmount(mrp, currency)} / {discount}% off
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="gym-membership-actions__hint">No active membership plans are available for this gym.</p>
                )}
              </div>

              <label className="gym-membership-actions__label" htmlFor="gym-membership-trainer">
                Select trainer
                <select
                  id="gym-membership-trainer"
                  value={selectedTrainer}
                  onChange={(event) => setSelectedTrainer(event.target.value)}
                  disabled={!trainers.length || isJoining}
                >
                  <option value="">Choose a trainer</option>
                  {trainers.map((trainer) => {
                    const statusTag = trainer.status === 'pending' ? 'pending approval' : null;
                    const traineeTag = trainer.activeTrainees ? `${trainer.activeTrainees} trainees` : null;
                    const experienceTag = typeof trainer.experienceYears === 'number' && trainer.experienceYears > 0
                      ? `${trainer.experienceYears} yrs exp`
                      : null;
                    const summary = [statusTag, experienceTag, traineeTag]
                      .filter(Boolean)
                      .join(' / ');

                    return (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.name}
                        {summary ? ` / ${summary}` : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              {!trainers.length ? (
                <p className="gym-membership-actions__hint">
                  No trainers are currently available for this gym. Please check back soon.
                </p>
              ) : null}

              <label className="gym-membership-actions__toggle" htmlFor="gym-membership-autorenew">
                <input
                  id="gym-membership-autorenew"
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(event) => setAutoRenew(event.target.checked)}
                  disabled={isJoining}
                />
                <span>
                  {selectedPlanDurationMonths > 1
                    ? `Auto-renew every ${selectedPlanDurationMonths} months`
                    : selectedPlanDurationMonths === 1
                      ? 'Auto-renew every month'
                      : 'Auto-renew when the selected plan ends'}
                </span>
              </label>

              {localError ? <p className="gym-membership-actions__error">{localError}</p> : null}
              {error ? <p className="gym-membership-actions__error">{error}</p> : null}

              <div className="gym-membership-actions__buttons">
                <button
                  type="button"
                  className="cta-button"
                  onClick={handleJoinClick}
                  disabled={isJoining || !trainers.length || selectedPlanAmount === null}
                >
                  {isJoining ? 'Joining...' : 'Join this gym'}
                </button>
              </div>

              {selectedTrainerDetails ? (
                <div className="gym-membership-actions__trainer-card">
                  <header className="gym-membership-actions__trainer-header">
                    {selectedTrainerDetails.profilePicture ? (
                      <img
                        src={selectedTrainerDetails.profilePicture}
                        alt={selectedTrainerDetails.name}
                        className="gym-membership-actions__trainer-avatar"
                      />
                    ) : (
                      <div className="gym-membership-actions__trainer-avatar gym-membership-actions__trainer-avatar--placeholder">
                        {selectedTrainerDetails.name?.slice(0, 1) ?? 'T'}
                      </div>
                    )}
                    <div>
                      <strong>{selectedTrainerDetails.name}</strong>
                      {selectedTrainerDetails.headline ? (
                        <p className="gym-membership-actions__trainer-headline">{selectedTrainerDetails.headline}</p>
                      ) : null}
                      <div className="gym-membership-actions__trainer-tags">
                        {typeof selectedTrainerDetails.experienceYears === 'number' && selectedTrainerDetails.experienceYears > 0 ? (
                          <span>{selectedTrainerDetails.experienceYears} yrs experience</span>
                        ) : null}
                        {typeof selectedTrainerDetails.age === 'number' && selectedTrainerDetails.age > 0 ? (
                          <span>{selectedTrainerDetails.age} yrs old</span>
                        ) : null}
                        {typeof selectedTrainerDetails.height === 'number' && selectedTrainerDetails.height > 0 ? (
                          <span>{selectedTrainerDetails.height} cm</span>
                        ) : null}
                        {selectedTrainerGenderLabel ? <span>{selectedTrainerGenderLabel}</span> : null}
                        {typeof selectedTrainerDetails.mentoredCount === 'number' && selectedTrainerDetails.mentoredCount > 0 ? (
                          <span>{selectedTrainerDetails.mentoredCount} trainees mentored</span>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  {selectedTrainerDetails.specializations?.length ? (
                    <p className="gym-membership-actions__trainer-meta">
                      <strong>Specialisations:</strong> {selectedTrainerDetails.specializations.join(', ')}
                    </p>
                  ) : null}

                  {selectedTrainerDetails.certifications?.length ? (
                    <p className="gym-membership-actions__trainer-meta">
                      <strong>Certifications:</strong> {selectedTrainerDetails.certifications.join(', ')}
                    </p>
                  ) : null}

                  {selectedTrainerDetails.bio ? (
                    <p className="gym-membership-actions__trainer-bio">{selectedTrainerDetails.bio}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

GymMembershipActions.propTypes = {
  membership: PropTypes.shape({
    id: PropTypes.string,
    status: PropTypes.string,
    plan: PropTypes.string,
    autoRenew: PropTypes.bool,
    trainer: PropTypes.shape({
      id: PropTypes.string,
    }),
    trainerAccess: PropTypes.shape({
      status: PropTypes.string,
      approvedAt: PropTypes.string,
      requestedAt: PropTypes.string,
    }),
  }),
  isLoading: PropTypes.bool,
  canManage: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  onJoin: PropTypes.func,
  onLeave: PropTypes.func,
  isJoining: PropTypes.bool,
  isLeaving: PropTypes.bool,
  error: PropTypes.string,
  userRole: PropTypes.string,
  trainers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      activeTrainees: PropTypes.number,
      status: PropTypes.string,
      experienceYears: PropTypes.number,
      certifications: PropTypes.arrayOf(PropTypes.string),
      mentoredCount: PropTypes.number,
      specializations: PropTypes.arrayOf(PropTypes.string),
      headline: PropTypes.string,
      bio: PropTypes.string,
      profilePicture: PropTypes.string,
      gender: PropTypes.string,
    }),
  ),
  pricingPlans: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      label: PropTypes.string,
      durationMonths: PropTypes.number,
      mrp: PropTypes.number,
      price: PropTypes.number,
      currency: PropTypes.string,
    }),
  ),
  currency: PropTypes.string,
};

export default GymMembershipActions;
