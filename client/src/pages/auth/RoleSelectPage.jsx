import './AuthPage.css';

const roles = [
  {
    key: 'trainee',
    title: 'Trainee',
    description: 'Discover gyms, track your progress, and manage your subscriptions.',
  },
  {
    key: 'trainer',
    title: 'Trainer',
    description: 'Assign plans, monitor attendance, and support your trainees.',
  },
  {
    key: 'gym-owner',
    title: 'Gym owner',
    description: 'List gyms, manage listings, sponsorships, and view analytics.',
  },
  {
    key: 'seller',
    title: 'Seller',
    description: 'List products in the marketplace and review order analytics.',
  },
];

const RoleSelectPage = () => (
  <div className="auth-page auth-page--compact">
    <div className="auth-card">
      <h1>Select your role</h1>
      <p className="auth-card__subtitle">Choose how you want to use FitSync.</p>
      <div className="role-grid">
        {roles.map((role) => (
          <a key={role.key} href={`/auth/register?role=${role.key}`} className="role-card">
            <h2>{role.title}</h2>
            <p>{role.description}</p>
            <span>Continue →</span>
          </a>
        ))}
      </div>
    </div>
  </div>
);

export default RoleSelectPage;
