import { Link } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks.js';
import Hero from './sections/Hero.jsx';
import RevenueStreams from './sections/RevenueStreams.jsx';
import RoleHighlights from './sections/RoleHighlights.jsx';
import './LandingPage.css';

const LandingPage = () => {
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="landing">
      <div className="noise-overlay"></div>
      <Hero />
      <RoleHighlights />
      <RevenueStreams />
      <section className="landing__cta">
        <h2>Ready to power your gym business?</h2>
        <p>Join FitSync to connect gym owners, trainers, and trainees in one platform.</p>
        <div className="landing__cta-buttons">
          {user ? (
            <Link to={`/dashboard/${user.role === 'user' ? 'trainee' : user.role}`} className="primary-button">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/auth/register" className="primary-button">
              Create an account
            </Link>
          )}
          <Link to="/gyms" className="secondary-button">
            Explore gyms
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
