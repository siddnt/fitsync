import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks.js';

const roleToPath = {
  trainee: 'trainee',
  'gym-owner': 'gym-owner',
  trainer: 'trainer',
  seller: 'seller',
  admin: 'admin',
};

const DashboardLanding = () => {
  const role = useAppSelector((state) => state.auth.user?.role ?? 'trainee');
  const path = roleToPath[role] ?? 'trainee';

  return <Navigate to={path} replace />;
};

export default DashboardLanding;
