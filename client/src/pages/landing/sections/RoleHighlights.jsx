const highlightCards = [
  {
    title: 'Gym owners',
    description:
      'Manage listings, track subscriptions, and visualise performance metrics with sponsorship boosts.',
    cta: 'Owner dashboard',
    href: '/dashboard/gym-owner',
  },
  {
    title: 'Trainers',
    description:
      'Stay on top of trainee progress, diet plans, attendance, and feedback in one console.',
    cta: 'Trainer tools',
    href: '/dashboard/trainer',
  },
  {
    title: 'Trainees',
    description:
      'Discover gyms, manage memberships, and monitor your fitness journey with real-time updates.',
    cta: 'Trainee dashboard',
    href: '/dashboard/trainee',
  },
];

const RoleHighlights = () => (
  <section className="landing-roles">
    <h2>Purpose-built experiences for every role</h2>
    <div className="landing-roles__grid">
      {highlightCards.map((card) => (
        <a key={card.title} href={card.href} className="landing-roles__card">
          <h3>{card.title}</h3>
          <p>{card.description}</p>
          <span>{card.cta} →</span>
        </a>
      ))}
    </div>
  </section>
);

export default RoleHighlights;
