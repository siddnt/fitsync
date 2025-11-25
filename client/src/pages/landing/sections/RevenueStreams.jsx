import useIntersectionObserver from '../../../hooks/useIntersectionObserver';

const streams = [
  {
    title: 'Gym listing subscriptions',
    body: 'Recurring plans for each location with pricing controls, MRP vs discount display, and renewal reminders.',
    icon: '📋',
  },
  {
    title: 'Sponsorship placements',
    body: 'Boost visibility across search results with tagged sponsored slots and performance reporting.',
    icon: '🚀',
  },
  {
    title: 'Marketplace sales',
    body: 'Keep track of seller catalogues, orders, and commissions without leaving the platform.',
    icon: '🛍️',
  },
];

const RevenueStreams = () => {
  return (
    <section className="landing-streams">
      <div className="landing-streams__header">
        <h2>Clear monetisation model</h2>
        <p>
          Drive predictable revenue through listing subscriptions, sponsorship placements, and product marketplace fees.
        </p>
      </div>
      <div className="landing-streams__grid">
        {streams.map((stream, index) => (
          <article key={stream.title} className="stream-card" style={{ transitionDelay: `${index * 100}ms` }}>
            <div className="stream-icon-wrapper">
              <div className="stream-icon">{stream.icon}</div>
            </div>
            <div className="stream-content">
              <h3>{stream.title}</h3>
              <p>{stream.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default RevenueStreams;
