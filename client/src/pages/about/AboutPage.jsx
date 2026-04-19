import missionImg from '../../assets/about-mission.png';
import trainerImg from '../../assets/about-trainer.png';
import gymImg from '../../assets/about-gym.png';
import './AboutPage.css';

const AboutPage = () => {
  return (
    <div className="about-page">
      <div className="about-hero">
        <div className="about-hero__bg" style={{ backgroundImage: `url(${gymImg})` }} />
        <div className="about-hero__content">
          <h1>Empowering Your <span className="text-gradient">Fitness Journey</span></h1>
          <p>FitSync connects trainees, trainers, gym owners, sellers, and operations teams in one fitness commerce platform.</p>
        </div>
      </div>

      <div className="about-section">
        <div className="about-trust-strip">
          <div className="about-trust-card">
            <small>Connected roles</small>
            <strong>6 workflows</strong>
            <span>Members, coaches, owners, sellers, managers, and admins operate in one system.</span>
          </div>
          <div className="about-trust-card">
            <small>Operational focus</small>
            <strong>Bookings to revenue</strong>
            <span>Scheduling, memberships, support, marketplace, sponsorship, and audit trails stay linked.</span>
          </div>
          <div className="about-trust-card">
            <small>Demo-ready</small>
            <strong>Seeded evaluation</strong>
            <span>Role accounts and realistic dashboards make the product understandable fast during review.</span>
          </div>
        </div>

        <div className="mission-statement">
          <div className="mission-content">
            <h2>Our Mission</h2>
            <p>
              To reduce the friction between coaching, operations, and member outcomes.
              Everyone in a fitness business should be able to move from discovery to retention
              without juggling disconnected tools.
            </p>
          </div>
          <div className="mission-image">
            <img src={missionImg} alt="Diverse group training" loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="about-story">
          <div className="story-content">
            <h2>Our Story</h2>
            <p>
              FitSync started with a basic observation: fitness businesses were forced to stitch together
              messaging apps, spreadsheets, payment links, and disconnected member records.
            </p>
            <p>
              That fragmentation hurts everyone. Trainees lose continuity, trainers spend less time coaching,
              owners lose visibility, and support teams operate without context.
            </p>
            <p>
              We built FitSync so the same platform can handle discovery, memberships, booking,
              fulfilment, support, and analytics in a way that still feels practical for day-to-day use.
            </p>
          </div>
          <div className="story-image">
            <img src={gymImg} alt="FitSync platform story" loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="about-story">
          <div className="story-content">
            <h2>Who FitSync Helps</h2>
            <p>
              Owners get listing performance, retention analytics, and operational visibility.
              Trainers get structured member context and booking flow. Trainees get memberships,
              progress, diet, and order tracking in one place.
            </p>
            <p>
              On the business side, managers and admins get support workflows, audit logs, exports,
              and ops monitoring so the product feels like a real platform rather than isolated CRUD screens.
            </p>
          </div>
          <div className="story-image">
            <img src={trainerImg} alt="FitSync users and coaches" loading="lazy" decoding="async" />
          </div>
        </div>

        <div className="about-values">
          <h2>Core Values</h2>
          <div className="values-grid">
            <div className="value-card">
              <h3>Operational clarity</h3>
              <p>We build for the messy parts too: escalations, backlog, renewals, returns, and platform oversight.</p>
            </div>
            <div className="value-card">
              <h3>Member confidence</h3>
              <p>Clear bookings, visible support, transparent orders, and rich profiles help members trust the experience.</p>
            </div>
            <div className="value-card">
              <h3>Practical depth</h3>
              <p>FitSync is designed to connect workflows, not just make dashboards look busy.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
