import { Link } from 'react-router-dom';

const Hero = () => (
  <section className="landing-hero">
    <div className="landing-hero__content">
      <span className="landing-hero__eyebrow">Unified gym management</span>
      <h1>Grow your fitness community with FitSync</h1>
      <p>
        FitSync connects gym owners, trainers, and trainees with subscription management,
        performance tracking, and a vibrant marketplace—all in one platform.
      </p>
      <div className="landing-hero__actions">
        <Link to="/gyms" className="primary-button">Browse gyms</Link>
        <Link to="/auth/register?role=gym-owner" className="ghost-button">List your gym</Link>
      </div>
    </div>
    <div className="landing-hero__stats">
      <div>
        <strong>320+</strong>
        <span>Gyms onboarded</span>
      </div>
      <div>
        <strong>18k</strong>
        <span>Monthly active trainees</span>
      </div>
      <div>
        <strong>12%</strong>
        <span>Revenue lift after sponsorship</span>
      </div>
    </div>
  </section>
);

export default Hero;
