import { Link } from 'react-router-dom';
import './NotFoundPage.css';

const NotFoundPage = () => (
  <div className="not-found">
    <h1>404</h1>
    <p>The page you are looking for does not exist.</p>
    <Link to="/" className="primary-button">Back to home</Link>
  </div>
);

export default NotFoundPage;
