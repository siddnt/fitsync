import { Link } from 'react-router-dom';
import Hero from './sections/Hero.jsx';
import RevenueStreams from './sections/RevenueStreams.jsx';
import RoleHighlights from './sections/RoleHighlights.jsx';
import './LandingPage.css';

const LandingPage = () => {
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
          <Link to="/auth/register" className="primary-button">
            Create an account
          </Link>
          <Link to="/gyms" className="secondary-button">
            Explore gyms
          </Link>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
