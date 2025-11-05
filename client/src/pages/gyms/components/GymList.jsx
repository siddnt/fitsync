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
        return (
          <li
            key={gym.id}
            className={gym.id === selectedGymId ? 'gym-list__item gym-list__item--active' : 'gym-list__item'}
          >
            <button type="button" onClick={() => onSelect(gym.id)}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong>{gym.name}</strong>
                  {isSponsored && (
                    <span className="gym-list__sponsored-badge">
                      Sponsored
                    </span>
                  )}
                </div>
                <span>{gym.owner?.name ?? 'Unknown owner'}</span>
              </div>
              <span>{gym.city}</span>
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
