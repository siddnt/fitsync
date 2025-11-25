import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import heroCollageImg from '../../../assets/hero-collage.png';

const Hero = () => {
  const [text, setText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const statsRef = useRef(null);

  const words = ["Community", "Business", "Success"];

  useEffect(() => {
    const handleTyping = () => {
      const i = loopNum % words.length;
      const fullText = words[i];

      setText(isDeleting
        ? fullText.substring(0, text.length - 1)
        : fullText.substring(0, text.length + 1)
      );

      setTypingSpeed(isDeleting ? 30 : 150);

      if (!isDeleting && text === fullText) {
        setTimeout(() => setIsDeleting(true), 1500);
      } else if (isDeleting && text === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [text, isDeleting, loopNum, typingSpeed, words]);

  const handleMouseMove = (e) => {
    if (!statsRef.current) return;
    const { left, top, width, height } = statsRef.current.getBoundingClientRect();
    const x = (e.clientX - left - width / 2) / 25;
    const y = (e.clientY - top - height / 2) / 25;
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <section className="landing-hero">
      <div className="landing-hero__content">
        <span className="landing-hero__eyebrow">Unified gym management</span>
        <h1>
          Grow your fitness <br />
          <span style={{ color: 'var(--brand-red)' }}>
            {text}
            <span className="typewriter-cursor">&nbsp;</span>
          </span>
        </h1>
        <p>
          FitSync connects gym owners, trainers, and trainees with subscription management,
          performance tracking, and a vibrant marketplace—all in one platform.
        </p>
        <div className="landing-hero__actions">
          <Link to="/gyms" className="primary-button">Browse gyms</Link>
          <Link to="/auth/register?role=gym-owner" className="ghost-button">List your gym</Link>
        </div>
      </div>
      <div
        className="landing-hero__image-container"
        ref={statsRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateY(${mousePosition.x}deg) rotateX(${-mousePosition.y}deg)`,
          transition: 'transform 0.1s ease-out'
        }}
      >
        <img src={heroCollageImg} alt="FitSync Platform" className="hero-image" />
      </div>
    </section>
  );
};

export default Hero;
