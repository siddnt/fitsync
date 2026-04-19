import PropTypes from 'prop-types';
import SkeletonList from '../../../ui/SkeletonList.jsx';

const parseAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
};

const GymList = ({
  gyms = [],
  isLoading = false,
  selectedGymId = null,
  onSelect,
}) => {
  if (isLoading) {
    return <SkeletonList rows={6} />;
  }

  if (!gyms.length) {
    return <p className="gym-list__empty">No gyms match your filters yet.</p>;
  }

  return (
    <ul className="gym-list">
      {gyms.map((gym) => {
        const discoveryTone = gym.discovery?.tone ?? 'standard';
        const discoveryLabel = gym.discovery?.label ?? 'Published';
        const ownerLabel = gym.owner?.name ?? 'Unknown owner';
        const startingAmount = parseAmount(gym.pricing?.startingAt ?? gym.pricing?.discounted ?? gym.pricing?.mrp);
        const priceLabel = startingAmount !== null
          ? `From Rs ${startingAmount.toLocaleString('en-IN')}`
          : 'Pricing unavailable';
        const ratingCount = Number(gym.analytics?.ratingCount ?? 0);
        const ratingValue = Number(gym.analytics?.rating ?? 0);
        const ratingLabel = ratingCount > 0
          ? `${ratingValue.toFixed(1)} / 5 (${ratingCount})`
          : 'New listing';

        return (
          <li
            key={gym.id}
            className={gym.id === selectedGymId ? 'gym-list__item gym-list__item--active' : 'gym-list__item'}
          >
            <button type="button" onClick={() => onSelect(gym.id)}>
              <div className="gym-list__content">
                <div className="gym-list__headline">
                  <strong>{gym.name}</strong>
                  <span className={`gym-list__badge gym-list__badge--${discoveryTone}`}>
                    {discoveryLabel}
                  </span>
                </div>
                <span className="gym-list__subline">{ownerLabel}</span>
                <span className="gym-list__reason">
                  {gym.discovery?.reason ?? 'Published and ready for new memberships.'}
                </span>
              </div>
              <div className="gym-list__stats">
                <span>{gym.city ?? 'Location pending'}</span>
                <strong>{priceLabel}</strong>
                <span>{ratingLabel}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

GymList.propTypes = {
  gyms: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      city: PropTypes.string,
      owner: PropTypes.shape({
        name: PropTypes.string,
      }),
      sponsorship: PropTypes.shape({
        status: PropTypes.string,
        tier: PropTypes.string,
      }),
      pricing: PropTypes.shape({
        mrp: PropTypes.number,
        discounted: PropTypes.number,
        startingAt: PropTypes.number,
      }),
      analytics: PropTypes.shape({
        rating: PropTypes.number,
        ratingCount: PropTypes.number,
      }),
      discovery: PropTypes.shape({
        tone: PropTypes.string,
        label: PropTypes.string,
        reason: PropTypes.string,
      }),
    }),
  ),
  isLoading: PropTypes.bool,
  selectedGymId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

export default GymList;
