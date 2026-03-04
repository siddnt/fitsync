import PropTypes from 'prop-types';
import SkeletonList from '../../../ui/SkeletonList.jsx';

const GymList = ({ gyms, isLoading, selectedGymId, onSelect }) => {
  if (isLoading) {
    return <SkeletonList rows={6} />;
  }

  if (!gyms.length) {
    return <p className="gym-list__empty">No gyms match your filters yet.</p>;
  }

  return (
    <ul className="gym-list">
      {gyms.map((gym) => {
        const isSponsored = gym.sponsorship?.status === 'active' && gym.sponsorship?.tier !== 'none';
        const rating = Number(gym.analytics?.rating ?? 0);
        const ratingCount = gym.analytics?.ratingCount ?? 0;
        const price = gym.pricing?.discounted ?? gym.pricing?.mrp;

        return (
          <li
            key={gym.id}
            className={gym.id === selectedGymId ? 'gym-list__item gym-list__item--active' : 'gym-list__item'}
          >
            <button type="button" onClick={() => onSelect(gym.id)}>
              <div className="gym-list__info">
                <div className="gym-list__name-row">
                  <strong>{gym.name}</strong>
                  {isSponsored && (
                    <span className="gym-list__sponsored-badge">
                      ★ Sponsored
                    </span>
                  )}
                </div>
                <span className="gym-list__location">
                  📍 {gym.city ?? 'Unknown'}{gym.state ? `, ${gym.state}` : ''}
                </span>
                <div className="gym-list__stats">
                  {rating > 0 && (
                    <span className="gym-list__rating">
                      {'★'.repeat(Math.round(rating))} {rating.toFixed(1)}
                      <small>({ratingCount})</small>
                    </span>
                  )}
                  {price && (
                    <span className="gym-list__price">₹{price}/mo</span>
                  )}
                </div>
              </div>
              <span className="gym-list__arrow">›</span>
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
      state: PropTypes.string,
      owner: PropTypes.shape({
        name: PropTypes.string,
      }),
      pricing: PropTypes.shape({
        mrp: PropTypes.number,
        discounted: PropTypes.number,
      }),
      analytics: PropTypes.shape({
        rating: PropTypes.number,
        ratingCount: PropTypes.number,
      }),
      sponsorship: PropTypes.shape({
        status: PropTypes.string,
        tier: PropTypes.string,
      }),
    }),
  ),
  isLoading: PropTypes.bool,
  selectedGymId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

GymList.defaultProps = {
  gyms: [],
  isLoading: false,
  selectedGymId: null,
};

export default GymList;
