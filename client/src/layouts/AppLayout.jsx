import { Outlet } from 'react-router-dom';
import AppHeader from '../components/navigation/AppHeader.jsx';
import AppFooter from '../components/navigation/AppFooter.jsx';
import './AppLayout.css';

const AppLayout = () => (
  <div className="app-shell">
    <AppHeader />
    <main className="app-shell__content">
      <Outlet />
    </main>
    <AppFooter />
  </div>
);

export default AppLayout;
