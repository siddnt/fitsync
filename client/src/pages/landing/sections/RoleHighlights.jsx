import useIntersectionObserver from '../../../hooks/useIntersectionObserver';

import roleOwnerImg from '../../../assets/role-owner.png';
import roleTrainerImg from '../../../assets/role-trainer.png';
import roleTraineeImg from '../../../assets/role-trainee.png';

const RoleHighlights = () => {
  const [ref, isVisible] = useIntersectionObserver({ triggerOnce: true, threshold: 0.1 });

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const { left, top, width, height } = card.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 20;
    const y = (e.clientY - top - height / 2) / 20;
    card.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${-y}deg) translateY(-10px)`;
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.transform = 'perspective(1000px) rotateY(0) rotateX(0) translateY(0)';
  };

  const highlightCards = [
    {
      title: 'Gym owners',
      image: roleOwnerImg,
      description:
        'Manage listings, track subscriptions, and visualise performance metrics with sponsorship boosts.',
      href: '/dashboard/gym-owner',
    },
    {
      title: 'Trainers',
      image: roleTrainerImg,
      description:
        'Stay on top of trainee progress, diet plans, attendance, and feedback in one console.',
      href: '/dashboard/trainer',
    },
    {
      title: 'Trainees',
      image: roleTraineeImg,
      description:
        'Discover gyms, manage memberships, and monitor your fitness journey with real-time updates.',
      href: '/dashboard/trainee',
    },
  ];

  return (
    <section className="landing-roles" ref={ref}>
      <h2>Purpose-built experiences for every role</h2>
      <div className="landing-roles__grid">
        {highlightCards.map((card, index) => (
          <div
            key={card.title}
            className={`landing-roles__card animate-on-scroll animate-fade-up ${isVisible ? 'animate-visible' : ''}`}
            style={{ transitionDelay: `${index * 150}ms`, transition: 'transform 0.1s ease-out' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <div className="role-image-container">
              <img src={card.image} alt={card.title} className="role-image" />
            </div>
            <div className="landing-roles__content">
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </div>

          </div>
        ))}
      </div>
    </section>
  );
};

export default RoleHighlights;
