import './AppFooter.css';

const AppFooter = () => (
  <footer className="app-footer">
    <p>© {new Date().getFullYear()} FitSync. All rights reserved.</p>
    <div className="app-footer__links">
      <a href="/contact">Contact Us</a>
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </div>
  </footer>
);

export default AppFooter;
