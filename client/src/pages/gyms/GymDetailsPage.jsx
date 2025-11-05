import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { useGetGymByIdQuery, useRecordImpressionMutation } from '../../services/gymsApi.js';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import './GymDetailsPage.css';

const GymDetailsPage = () => {
  const { gymId } = useParams();
  const { data, isLoading } = useGetGymByIdQuery(gymId, { skip: !gymId });
  const [recordImpression] = useRecordImpressionMutation();

  useEffect(() => {
    if (gymId) {
      recordImpression(gymId);
    }
  }, [gymId, recordImpression]);

  if (isLoading) {
    return <SkeletonPanel lines={18} />;
  }

  if (!data?.gym) {
    return (
      <div className="gym-details__empty">
        <p>We could not find this gym. It might have been removed.</p>
      </div>
    );
  }

  const { gym } = data;

  return (
    <div className="gym-details">
      <header className="gym-details__header">
        <div>
          <h1>{gym.name}</h1>
          <p>{gym.location?.address}</p>
        </div>
        <div className="gym-details__pricing">
          <span className="price">₹{gym.pricing?.discounted ?? gym.pricing?.mrp ?? 'N/A'}</span>
          {gym.pricing?.mrp && gym.pricing?.discounted && (
            <span className="price--mrp">₹{gym.pricing.mrp}</span>
          )}
        </div>
      </header>

      <section className="gym-details__gallery">
        {gym.gallery?.length ? (
          gym.gallery.map((image) => <img key={image} src={image} alt={gym.name} />)
        ) : (
          <div className="gym-details__placeholder">Gallery coming soon</div>
        )}
      </section>

      <section className="gym-details__grid">
        <article>
          <h2>Contact</h2>
          <p>{gym.contact?.phone}</p>
          <p>{gym.contact?.email}</p>
        </article>
        <article>
          <h2>Schedule</h2>
          <p>{gym.schedule?.days?.join(', ')}</p>
          <p>
            {gym.schedule?.open ?? '06:00'} - {gym.schedule?.close ?? '22:00'}
          </p>
        </article>
        <article>
          <h2>Features</h2>
          <div className="gym-details__chips">
            {(gym.features?.length ? gym.features : ['AC', 'Lockers']).map((feature) => (
              <span key={feature}>{feature}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="gym-details__about">
        <h2>About this gym</h2>
        <p>{gym.description}</p>
      </section>

      <section className="gym-details__reviews">
        <h2>Reviews</h2>
        {gym.reviews?.length ? (
          gym.reviews.map((review) => (
            <article key={review.id}>
              <header>
                <strong>{review.authorName}</strong>
                <span>{'★'.repeat(review.rating)}</span>
              </header>
              <p>{review.comment}</p>
            </article>
          ))
        ) : (
          <p>No reviews yet.</p>
        )}
      </section>
    </div>
  );
};

export default GymDetailsPage;
