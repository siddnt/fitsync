import { Outlet } from 'react-router-dom';
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import AppHeader from '../components/navigation/AppHeader.jsx';
import './DashboardLayout.css';

const DashboardLayout = () => (
  <div className="dashboard-shell">
    <AppHeader />
    <div className="dashboard-shell__body">
      <DashboardSidebar />
      <main className="dashboard-shell__content">
        <Outlet />
      </main>
    </div>
  </div>
);

export default DashboardLayout;
