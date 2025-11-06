import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import './GymMembershipActions.css';

const statusCopy = {
  active: 'Active membership',
  paused: 'Membership paused',
  cancelled: 'Membership cancelled',
  expired: 'Membership expired',
};

const GymMembershipActions = ({
  membership,
  isLoading,
  canManage,
  isAuthenticated,
  onJoin,
  onLeave,
  isJoining,
  isLeaving,
  error,
  userRole,
  trainers,
  monthlyFee,
  currency,
}) => {
  const [selectedTrainer, setSelectedTrainer] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [autoRenew, setAutoRenew] = useState(true);
  const [localError, setLocalError] = useState(null);

  const isTrainerAccount = userRole === 'trainer';
  const isTrainerMembership = isTrainerAccount && membership?.plan === 'trainer-access';
  const trainerMembershipStatus = isTrainerMembership ? membership?.status ?? null : null;
  const isTrainerPending = trainerMembershipStatus === 'pending';

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

  const numericMonthlyFee = (() => {
    if (typeof monthlyFee === 'number' && Number.isFinite(monthlyFee)) {
      return monthlyFee;
    }
    const parsed = Number(monthlyFee);
    return Number.isFinite(parsed) ? parsed : null;
  })();

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
  }, [selectedTrainer, paymentReference, isTrainerAccount]);

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
        <p className="gym-membership-actions__hint">Checking membership status…</p>
      </div>
    );
  }

  const status = membership?.status;
  const hasActiveMembership = status === 'active' || status === 'paused';
  const canRejoin = !status || status === 'cancelled' || status === 'expired';
  const showTrainerLeaveButton = isTrainerMembership && Boolean(membership?.id) && status && status !== 'cancelled' && status !== 'expired';

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

    if (!selectedTrainer) {
      setLocalError('Select a trainer to continue.');
      return;
    }

    if (!paymentReference.trim()) {
      setLocalError('Enter the payment reference received after payment.');
      return;
    }

    try {
      await onJoin?.({
        trainerId: selectedTrainer,
        paymentReference: paymentReference.trim(),
        autoRenew,
      });
      setPaymentReference('');
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
                    ? 'Withdrawing…'
                    : 'Leaving…'
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
                {isJoining ? 'Joining…' : 'Join as trainer'}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {numericMonthlyFee !== null ? (
            <p className="gym-membership-actions__price">
              Monthly fee: <strong>{currency}{numericMonthlyFee.toLocaleString('en-IN')}</strong>
            </p>
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
                {isLeaving ? 'Leaving…' : 'Leave gym'}
              </button>
            </div>
          ) : null}

          {canRejoin ? (
            <div className="gym-membership-actions__form">
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
                      .join(' · ');

                    return (
                      <option key={trainer.id} value={trainer.id}>
                        {trainer.name}
                        {summary ? ` · ${summary}` : ''}
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

              <label className="gym-membership-actions__label" htmlFor="gym-membership-payment">
                Payment reference
                <input
                  id="gym-membership-payment"
                  type="text"
                  value={paymentReference}
                  placeholder="Txn-123456"
                  onChange={(event) => setPaymentReference(event.target.value)}
                  disabled={isJoining}
                />
              </label>

              <label className="gym-membership-actions__toggle" htmlFor="gym-membership-autorenew">
                <input
                  id="gym-membership-autorenew"
                  type="checkbox"
                  checked={autoRenew}
                  onChange={(event) => setAutoRenew(event.target.checked)}
                  disabled={isJoining}
                />
                <span>Auto-renew every month</span>
              </label>

              {localError ? <p className="gym-membership-actions__error">{localError}</p> : null}
              {error ? <p className="gym-membership-actions__error">{error}</p> : null}

              <div className="gym-membership-actions__buttons">
                <button
                  type="button"
                  className="cta-button"
                  onClick={handleJoinClick}
                  disabled={isJoining || !trainers.length || numericMonthlyFee === null}
                >
                  {isJoining ? 'Joining…' : 'Join this gym'}
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
  monthlyFee: PropTypes.number,
  currency: PropTypes.string,
};

GymMembershipActions.defaultProps = {
  membership: null,
  isLoading: false,
  canManage: false,
  isAuthenticated: false,
  onJoin: undefined,
  onLeave: undefined,
  isJoining: false,
  isLeaving: false,
  error: null,
  userRole: null,
  trainers: [],
  monthlyFee: null,
  currency: '₹',
};

export default GymMembershipActions;
