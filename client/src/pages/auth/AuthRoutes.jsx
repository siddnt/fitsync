import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';
import RegisterPage from './RegisterPage.jsx';
import RoleSelectPage from './RoleSelectPage.jsx';

const AuthRoutes = () => (
  <Routes>
    <Route index element={<Navigate to="login" replace />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="register" element={<RegisterPage />} />
    <Route path="roles" element={<RoleSelectPage />} />
  </Routes>
);

export default AuthRoutes;
