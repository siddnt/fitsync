import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '../pages/landing/LandingPage.jsx';
import GymExplorerPage from '../pages/gyms/GymExplorerPage.jsx';
import GymDetailsPage from '../pages/gyms/GymDetailsPage.jsx';
import AuthRoutes from '../pages/auth/AuthRoutes.jsx';
import MarketplacePage from '../pages/marketplace/MarketplacePage.jsx';
import CartPage from '../pages/marketplace/CartPage.jsx';
import CheckoutPage from '../pages/marketplace/CheckoutPage.jsx';
import ProfilePage from '../pages/profile/ProfilePage.jsx';
import TraineeDashboard from '../pages/dashboards/TraineeDashboard.jsx';
import GymOwnerDashboard from '../pages/dashboards/GymOwnerDashboard.jsx';
import TrainerDashboard from '../pages/dashboards/TrainerDashboard.jsx';
import AdminDashboard from '../pages/dashboards/AdminDashboard.jsx';
import SellerDashboard from '../pages/dashboards/SellerDashboard.jsx';
import TraineeProgressPage from '../pages/dashboards/trainee/ProgressPage.jsx';
import TraineeDietPage from '../pages/dashboards/trainee/DietPage.jsx';
import TraineeAttendancePage from '../pages/dashboards/trainee/AttendancePage.jsx';
import TraineeOrdersPage from '../pages/dashboards/trainee/OrdersPage.jsx';
import GymOwnerGymsPage from '../pages/dashboards/gymOwner/GymsPage.jsx';
import GymOwnerSubscriptionsPage from '../pages/dashboards/gymOwner/SubscriptionsPage.jsx';
import GymOwnerSponsorshipPage from '../pages/dashboards/gymOwner/SponsorshipPage.jsx';
import GymOwnerAnalyticsPage from '../pages/dashboards/gymOwner/AnalyticsPage.jsx';
import GymOwnerRosterPage from '../pages/dashboards/gymOwner/RosterPage.jsx';
import TrainerTraineesPage from '../pages/dashboards/trainer/TraineesPage.jsx';
import TrainerUpdatesPage from '../pages/dashboards/trainer/UpdatesPage.jsx';
import AdminUsersPage from '../pages/dashboards/admin/UsersPage.jsx';
import AdminGymsPage from '../pages/dashboards/admin/GymsPage.jsx';
import AdminRevenuePage from '../pages/dashboards/admin/RevenuePage.jsx';
import AdminMarketplacePage from '../pages/dashboards/admin/MarketplacePage.jsx';
import AdminSettingsPage from '../pages/dashboards/admin/SettingsPage.jsx';
import SellerInventoryPage from '../pages/dashboards/seller/InventoryPage.jsx';
import SellerOrdersPage from '../pages/dashboards/seller/OrdersPage.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import DashboardLanding from '../pages/dashboards/DashboardLanding.jsx';
import NotFoundPage from '../pages/errors/NotFoundPage.jsx';
import AboutPage from '../pages/about/AboutPage.jsx';
import ContactPage from '../pages/contact/ContactPage.jsx';
import PrivacyPage from '../pages/privacy/PrivacyPage.jsx';
import TermsPage from '../pages/terms/TermsPage.jsx';
import SupportPage from '../pages/support/SupportPage.jsx';

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="support" element={<SupportPage />} />
        <Route path="gyms" element={<GymExplorerPage />} />
        <Route path="gyms/:gymId" element={<GymDetailsPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="auth/*" element={<AuthRoutes />} />
      </Route>
      <Route path="dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardLanding />} />
        <Route path="trainee">
          <Route index element={<TraineeDashboard />} />
          <Route path="progress" element={<TraineeProgressPage />} />
          <Route path="diet" element={<TraineeDietPage />} />
          <Route path="attendance" element={<TraineeAttendancePage />} />
          <Route path="orders" element={<TraineeOrdersPage />} />
        </Route>
        <Route path="gym-owner">
          <Route index element={<GymOwnerDashboard />} />
          <Route path="gyms" element={<GymOwnerGymsPage />} />
          <Route path="people" element={<GymOwnerRosterPage />} />
          <Route path="subscriptions" element={<GymOwnerSubscriptionsPage />} />
          <Route path="sponsorship" element={<GymOwnerSponsorshipPage />} />
          <Route path="analytics" element={<GymOwnerAnalyticsPage />} />
        </Route>
        <Route path="seller">
          <Route index element={<SellerDashboard />} />
          <Route path="inventory" element={<SellerInventoryPage />} />
          <Route path="orders" element={<SellerOrdersPage />} />
        </Route>
        <Route path="trainer">
          <Route index element={<TrainerDashboard />} />
          <Route path="trainees" element={<TrainerTraineesPage />} />
          <Route path="updates" element={<TrainerUpdatesPage />} />
        </Route>
        <Route path="admin">
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="gyms" element={<AdminGymsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="marketplace" element={<AdminMarketplacePage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
