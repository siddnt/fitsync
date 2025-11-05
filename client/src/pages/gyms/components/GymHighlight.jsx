import PropTypes from 'prop-types';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';

const GymHighlight = ({ gym, isLoading }) => {
  if (isLoading && !gym) {
    return <SkeletonPanel lines={12} />;
  }

  if (!gym) {
    return (
      <div className="gym-highlight gym-highlight--empty">
        <p>Select a gym from the list to view its details.</p>
      </div>
    );
  }

  const isSponsored = gym.sponsorship?.status === 'active' && gym.sponsorship?.tier !== 'none';

  return (
    <article className="gym-highlight">
      {isSponsored && (
        <div className="gym-highlight__sponsored-banner">
          <span className="gym-highlight__sponsored-icon">⭐</span>
          <span>Sponsored Listing</span>
          <span className="gym-highlight__sponsored-tier">{gym.sponsorship.tier}</span>
        </div>
      )}
      <header className="gym-highlight__header">
        <div>
          <h1>{gym.name}</h1>
          <p>{gym.location?.address}</p>
        </div>
        <div className="gym-highlight__pricing">
          <span className="price">₹{gym.pricing?.discounted ?? gym.pricing?.mrp ?? 'N/A'}</span>
          {gym.pricing?.mrp && gym.pricing?.discounted && (
            <span className="price--mrp">₹{gym.pricing.mrp}</span>
          )}
        </div>
      </header>

      <section className="gym-highlight__meta">
        <div>
          <strong>Owner</strong>
          <span>{gym.owner?.name}</span>
        </div>
        <div>
          <strong>Contact</strong>
          <span>{gym.contact?.phone}</span>
        </div>
        <div>
          <strong>Working days</strong>
          <span>{gym.schedule?.days?.join(', ') ?? 'Mon - Sun'}</span>
        </div>
        <div>
          <strong>Timings</strong>
          <span>
            {gym.schedule?.open ?? '06:00'} - {gym.schedule?.close ?? '22:00'}
          </span>
        </div>
      </section>

      <section className="gym-highlight__features">
        <h2>Key features</h2>
        <div>
          {(gym.features?.length ? gym.features : ['AC', 'Locker rooms', 'Certified trainers']).map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
      </section>

      <section className="gym-highlight__about">
        <h2>About</h2>
        <p>{gym.description ?? 'Gym description coming soon.'}</p>
      </section>

      <section className="gym-highlight__reviews">
        <h2>Member reviews</h2>
        {(gym.reviews?.length ? gym.reviews : []).slice(0, 3).map((review) => (
          <article key={review.id}>
            <header>
              <strong>{review.authorName}</strong>
              <span>{'★'.repeat(review.rating)}</span>
            </header>
            <p>{review.comment}</p>
          </article>
        ))}
        {!gym.reviews?.length && <p>No reviews yet. Be the first to share your experience!</p>}
      </section>
    </article>
  );
};

GymHighlight.propTypes = {
  gym: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    pricing: PropTypes.shape({
      mrp: PropTypes.number,
      discounted: PropTypes.number,
    }),
    owner: PropTypes.shape({
      name: PropTypes.string,
    }),
    location: PropTypes.shape({
      address: PropTypes.string,
    }),
    contact: PropTypes.shape({
      phone: PropTypes.string,
    }),
    schedule: PropTypes.shape({
      days: PropTypes.arrayOf(PropTypes.string),
      open: PropTypes.string,
      close: PropTypes.string,
    }),
    features: PropTypes.arrayOf(PropTypes.string),
    description: PropTypes.string,
    reviews: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        authorName: PropTypes.string,
        rating: PropTypes.number,
        comment: PropTypes.string,
      }),
    ),
    sponsorship: PropTypes.shape({
      status: PropTypes.string,
      tier: PropTypes.string,
    }),
  }),
  isLoading: PropTypes.bool,
};

GymHighlight.defaultProps = {
  gym: null,
  isLoading: false,
};

export default GymHighlight;
