import { Link } from 'react-router-dom';
import './AppFooter.css';

const AppFooter = () => (
  <footer className="app-footer">
    <p>© {new Date().getFullYear()} FitSync. All rights reserved.</p>
    <div className="app-footer__links">
      <Link to="/privacy">Privacy</Link>
      <Link to="/terms">Terms</Link>
      <Link to="/support">Support</Link>
    </div>
  </footer>
);

export default AppFooter;
