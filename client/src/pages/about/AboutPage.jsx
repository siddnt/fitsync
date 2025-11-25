import React from 'react';
import missionImg from '../../assets/about-mission.png';
import trainerImg from '../../assets/about-trainer.png';
import gymImg from '../../assets/about-gym.png';
import './AboutPage.css';

const AboutPage = () => {
    return (
        <div className="about-page">
            <div className="about-hero">
                <div className="about-hero__bg" style={{ backgroundImage: `url(${gymImg})` }}></div>
                <div className="about-hero__content">
                    <h1>Empowering Your <span className="text-gradient">Fitness Journey</span></h1>
                    <p>FitSync is the ultimate platform connecting trainees, trainers, and gym owners in one seamless ecosystem.</p>
                </div>
            </div>

            <div className="about-section">
                <div className="mission-statement">
                    <div className="mission-content">
                        <h2>Our Mission</h2>
                        <p>
                            To revolutionize the fitness industry by bridging the gap between goals and guidance.
                            We believe everyone deserves access to top-tier training, and every fitness professional
                            deserves the tools to scale their impact.
                        </p>
                    </div>
                    <div className="mission-image">
                        <img src={missionImg} alt="Diverse group training" />
                    </div>
                </div>

                <div className="about-story">
                    <div className="story-content">
                        <h2>Our Story</h2>
                        <p>
                            FitSync began with a simple question: <strong>Why is fitness so fragmented?</strong>
                        </p>
                        <p>
                            We noticed that trainees struggled to find the right guidance, trainers spent more time on admin than coaching,
                            and gym owners lacked the tools to truly connect with their members.
                        </p>
                        <p>
                            We built FitSync to be the bridge. By combining advanced scheduling, progress tracking, and
                            community features into one intuitive platform, we're creating a world where fitness is
                            accessible, efficient, and inspiring for everyone.
                        </p>
                    </div>
                    <div className="story-image">
                        <img src={gymImg} alt="FitSync Origins" />
                    </div>
                </div>

                <div className="about-values">
                    <h2>Core Values</h2>
                    <div className="values-grid">
                        <div className="value-card">
                            <h3>Innovation</h3>
                            <p>We leverage cutting-edge technology to solve real-world fitness challenges.</p>
                        </div>
                        <div className="value-card">
                            <h3>Community</h3>
                            <p>We believe fitness is better together. We build tools that foster connection.</p>
                        </div>
                        <div className="value-card">
                            <h3>Excellence</h3>
                            <p>We commit to quality in every line of code and every workout plan.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
