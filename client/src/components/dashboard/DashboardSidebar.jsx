import { NavLink } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks.js';
import './DashboardSidebar.css';

const dashboardLinksByRole = {
  trainee: [
    { to: '/dashboard/trainee', label: 'Overview' },
    { to: '/dashboard/trainee/progress', label: 'Progress' },
    { to: '/dashboard/trainee/diet', label: 'Diet Plan' },
    { to: '/dashboard/trainee/attendance', label: 'Attendance' },
    { to: '/dashboard/trainee/orders', label: 'Orders' },
  ],
  'gym-owner': [
    { to: '/dashboard/gym-owner', label: 'Overview' },
    { to: '/dashboard/gym-owner/gyms', label: 'My Gyms' },
    { to: '/dashboard/gym-owner/subscriptions', label: 'Listing Subscription' },
    { to: '/dashboard/gym-owner/sponsorship', label: 'Sponsorship' },
    { to: '/dashboard/gym-owner/analytics', label: 'Analytics' },
  ],
  trainer: [
    { to: '/dashboard/trainer', label: 'Overview' },
    { to: '/dashboard/trainer/trainees', label: 'Assigned Trainees' },
    { to: '/dashboard/trainer/updates', label: 'Update Records' },
  ],
  seller: [
    { to: '/dashboard/seller', label: 'Overview' },
    { to: '/dashboard/seller/inventory', label: 'Inventory' },
    { to: '/dashboard/seller/orders', label: 'Orders' },
  ],
  admin: [
    { to: '/dashboard/admin', label: 'Overview' },
    { to: '/dashboard/admin/users', label: 'Users' },
    { to: '/dashboard/admin/gyms', label: 'Gyms' },
    { to: '/dashboard/admin/revenue', label: 'Revenue' },
    { to: '/dashboard/admin/marketplace', label: 'Marketplace' },
    { to: '/dashboard/admin/settings', label: 'Settings' },
  ],
};

const DashboardSidebar = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? 'trainee');
  const links = dashboardLinksByRole[role] ?? dashboardLinksByRole.trainee;

  return (
    <aside className="dashboard-sidebar">
      <h2 className="dashboard-sidebar__title">Dashboard</h2>
      <nav className="dashboard-sidebar__nav">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end className="dashboard-sidebar__link">
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
