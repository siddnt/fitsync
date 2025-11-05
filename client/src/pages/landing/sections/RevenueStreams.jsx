const streams = [
  {
    title: 'Gym listing subscriptions',
    body: 'Recurring plans for each location with pricing controls, MRP vs discount display, and renewal reminders.',
  },
  {
    title: 'Sponsorship placements',
    body: 'Boost visibility across search results with tagged sponsored slots and performance reporting.',
  },
  {
    title: 'Marketplace sales',
    body: 'Keep track of seller catalogues, orders, and commissions without leaving the platform.',
  },
];

const RevenueStreams = () => (
  <section className="landing-streams">
    <div>
      <h2>Clear monetisation model</h2>
      <p>
        Drive predictable revenue through listing subscriptions, sponsorship placements, and product marketplace fees.
      </p>
    </div>
    <div className="landing-streams__list">
      {streams.map((stream) => (
        <article key={stream.title}>
          <h3>{stream.title}</h3>
          <p>{stream.body}</p>
        </article>
      ))}
    </div>
  </section>
);

export default RevenueStreams;
