import { Outlet } from 'react-router-dom';
import { useAppSelector } from '../app/hooks.js';
import DashboardSidebar from '../components/dashboard/DashboardSidebar.jsx';
import SuspendedOverlay from '../components/dashboard/SuspendedOverlay.jsx';
import AppHeader from '../components/navigation/AppHeader.jsx';
import './DashboardLayout.css';

const DashboardLayout = () => {
  const user = useAppSelector((state) => state.auth.user);
  const isSuspended = user?.status === 'suspended';

  return (
    <div className="dashboard-shell">
      <AppHeader />
      <div className="dashboard-shell__body">
        {isSuspended ? (
          <SuspendedOverlay userName={user?.firstName || user?.name} />
        ) : (
          <>
            <DashboardSidebar />
            <main className="dashboard-shell__content">
              <Outlet />
            </main>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardLayout;
