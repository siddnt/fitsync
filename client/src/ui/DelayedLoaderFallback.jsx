import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import AppLoader from './AppLoader.jsx';

const DelayedLoaderFallback = ({ delayMs, message }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setIsVisible(true);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [delayMs]);

  if (!isVisible) {
    return null;
  }

  return <AppLoader fullScreen message={message} />;
};

DelayedLoaderFallback.propTypes = {
  delayMs: PropTypes.number,
  message: PropTypes.string,
};

DelayedLoaderFallback.defaultProps = {
  delayMs: 200,
  message: 'Loading your workout space...',
};

export default DelayedLoaderFallback;
