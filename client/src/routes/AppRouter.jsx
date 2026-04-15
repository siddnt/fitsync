import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
const LandingPage = lazy(() => import('../pages/landing/LandingPage.jsx'));
const GymExplorerPage = lazy(() => import('../pages/gyms/GymExplorerPage.jsx'));
const GymDetailsPage = lazy(() => import('../pages/gyms/GymDetailsPage.jsx'));
const AuthRoutes = lazy(() => import('../pages/auth/AuthRoutes.jsx'));
const MarketplacePage = lazy(() => import('../pages/marketplace/MarketplacePage.jsx'));
const MarketplaceProductPage = lazy(() => import('../pages/marketplace/MarketplaceProductPage.jsx'));
const CartPage = lazy(() => import('../pages/marketplace/CartPage.jsx'));
const CheckoutPage = lazy(() => import('../pages/marketplace/CheckoutPage.jsx'));
const CheckoutSuccessPage = lazy(() => import('../pages/marketplace/CheckoutSuccessPage.jsx'));
const CheckoutCancelPage = lazy(() => import('../pages/marketplace/CheckoutCancelPage.jsx'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage.jsx'));
const TraineeDashboard = lazy(() => import('../pages/dashboards/TraineeDashboard.jsx'));
const GymOwnerDashboard = lazy(() => import('../pages/dashboards/GymOwnerDashboard.jsx'));
const TrainerDashboard = lazy(() => import('../pages/dashboards/TrainerDashboard.jsx'));
const AdminDashboard = lazy(() => import('../pages/dashboards/AdminDashboard.jsx'));
const SellerDashboard = lazy(() => import('../pages/dashboards/SellerDashboard.jsx'));
const ManagerDashboard = lazy(() => import('../pages/dashboards/ManagerDashboard.jsx'));
const ManagerMessagesPage = lazy(() => import('../pages/dashboards/admin/MessagesPage.jsx'));
const InternalCommunicationsPage = lazy(() => import('../pages/dashboards/shared/InternalCommunicationsPage.jsx'));
const TraineeProgressPage = lazy(() => import('../pages/dashboards/trainee/ProgressPage.jsx'));
const TraineeDietPage = lazy(() => import('../pages/dashboards/trainee/DietPage.jsx'));
const TraineeOrdersPage = lazy(() => import('../pages/dashboards/trainee/OrdersPage.jsx'));
const GymOwnerGymsPage = lazy(() => import('../pages/dashboards/gymOwner/GymsPage.jsx'));
const GymOwnerSubscriptionsPage = lazy(() => import('../pages/dashboards/gymOwner/SubscriptionsPage.jsx'));
const GymOwnerSponsorshipPage = lazy(() => import('../pages/dashboards/gymOwner/SponsorshipPage.jsx'));
const GymOwnerAnalyticsPage = lazy(() => import('../pages/dashboards/gymOwner/AnalyticsPage.jsx'));
const GymOwnerRosterPage = lazy(() => import('../pages/dashboards/gymOwner/RosterPage.jsx'));
const TrainerTraineesPage = lazy(() => import('../pages/dashboards/trainer/TraineesPage.jsx'));
const TrainerUpdatesPage = lazy(() => import('../pages/dashboards/trainer/UpdatesPage.jsx'));
const AdminUsersPage = lazy(() => import('../pages/dashboards/admin/UsersPage.jsx'));
const AdminUserDetailsPage = lazy(() => import('../pages/dashboards/admin/UserDetailsPage.jsx'));
const AdminGymsPage = lazy(() => import('../pages/dashboards/admin/GymsPage.jsx'));
const AdminGymDetailsPage = lazy(() => import('../pages/dashboards/admin/GymDetailsPage.jsx'));
const AdminRevenuePage = lazy(() => import('../pages/dashboards/admin/RevenuePage.jsx'));
const AdminMarketplacePage = lazy(() => import('../pages/dashboards/admin/MarketplacePage.jsx'));
const AdminMessagesPage = lazy(() => import('../pages/dashboards/admin/MessagesPage.jsx'));
const AdminAuditLogsPage = lazy(() => import('../pages/dashboards/admin/AuditLogsPage.jsx'));
const SellerInventoryPage = lazy(() => import('../pages/dashboards/seller/InventoryPage.jsx'));
const SellerOrdersPage = lazy(() => import('../pages/dashboards/seller/OrdersPage.jsx'));
const DashboardLanding = lazy(() => import('../pages/dashboards/DashboardLanding.jsx'));
const NotFoundPage = lazy(() => import('../pages/errors/NotFoundPage.jsx'));
const AboutPage = lazy(() => import('../pages/about/AboutPage.jsx'));
const ContactPage = lazy(() => import('../pages/contact/ContactPage.jsx'));
const PrivacyPage = lazy(() => import('../pages/privacy/PrivacyPage.jsx'));
const TermsPage = lazy(() => import('../pages/terms/TermsPage.jsx'));

const routeFallback = (
  <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
);

const AppRouter = () => (
  <BrowserRouter>
    <Suspense fallback={routeFallback}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="gyms" element={<GymExplorerPage />} />
          <Route path="gyms/:gymId" element={<GymDetailsPage />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route path="marketplace/products/:productId" element={<MarketplaceProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="marketplace/checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="marketplace/checkout/cancel" element={<CheckoutCancelPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="auth/*" element={<AuthRoutes />} />
        </Route>
        <Route path="dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardLanding />} />
          <Route path="trainee">
            <Route index element={<TraineeDashboard />} />
            <Route path="progress" element={<TraineeProgressPage />} />
            <Route path="diet" element={<TraineeDietPage />} />
            <Route path="orders" element={<TraineeOrdersPage />} />
          </Route>
          <Route path="gym-owner">
            <Route index element={<GymOwnerDashboard />} />
            <Route path="gyms" element={<GymOwnerGymsPage />} />
            <Route path="people" element={<GymOwnerRosterPage />} />
            <Route path="communications" element={<InternalCommunicationsPage />} />
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
          <Route path="manager">
            <Route index element={<ManagerDashboard />} />
            <Route path="communications" element={<InternalCommunicationsPage />} />
            <Route path="messages" element={<ManagerMessagesPage />} />
          </Route>
          <Route path="admin">
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:userId" element={<AdminUserDetailsPage />} />
            <Route path="gyms" element={<AdminGymsPage />} />
            <Route path="gyms/:gymId" element={<AdminGymDetailsPage />} />
            <Route path="revenue" element={<AdminRevenuePage />} />
            <Route path="marketplace" element={<AdminMarketplacePage />} />
            <Route path="communications" element={<InternalCommunicationsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default AppRouter;
