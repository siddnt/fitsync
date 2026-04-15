import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks.js';

const roleToPath = {
  trainee: 'trainee',
  'gym-owner': 'gym-owner',
  trainer: 'trainer',
  seller: 'seller',
  manager: 'manager',
  admin: 'admin',
};

const DashboardLanding = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? 'trainee');
  const path = roleToPath[role] ?? 'trainee';

  return <Navigate to={path} replace />;
};

export default DashboardLanding;
