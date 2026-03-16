import PropTypes from 'prop-types';
import './AppLoader.css';

const loaderDots = [
  { colorClass: 'app-loader__dot--pink', angle: '228deg', delay: '-0.3s' },
  { colorClass: 'app-loader__dot--blue', angle: '140deg', delay: '-0.1s' },
  { colorClass: 'app-loader__dot--gold', angle: '34deg', delay: '-0.45s' },
  { colorClass: 'app-loader__dot--coral', angle: '320deg', delay: '-0.2s' },
];

const AppLoader = ({ fullScreen, message }) => (
  <div className={`app-loader ${fullScreen ? 'app-loader--fullscreen' : ''}`} role="status" aria-live="polite">
    <div className="app-loader__panel">
      <div className="app-loader__preview" aria-hidden="true">
        <div className="app-loader__spinner">
          {loaderDots.map((dot) => (
            <span
              key={`${dot.colorClass}-${dot.angle}`}
              className={`app-loader__dot ${dot.colorClass}`}
              style={{
                '--app-loader-angle': dot.angle,
                '--app-loader-delay': dot.delay,
              }}
            />
          ))}
        </div>
      </div>
      <div className="app-loader__copy">
        <p className="app-loader__eyebrow">FitSync</p>
        <p className="app-loader__message">{message}</p>
      </div>
    </div>
  </div>
);

AppLoader.propTypes = {
  fullScreen: PropTypes.bool,
  message: PropTypes.string,
};

AppLoader.defaultProps = {
  fullScreen: false,
  message: 'Loading your workout space...',
};

export default AppLoader;
