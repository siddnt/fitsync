import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from '../pages/landing/LandingPage.jsx';
import GymExplorerPage from '../pages/gyms/GymExplorerPage.jsx';
import GymDetailsPage from '../pages/gyms/GymDetailsPage.jsx';
import AuthRoutes from '../pages/auth/AuthRoutes.jsx';
import MarketplacePage from '../pages/marketplace/MarketplacePage.jsx';
import MarketplaceProductPage from '../pages/marketplace/MarketplaceProductPage.jsx';
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
import TraineeOrdersPage from '../pages/dashboards/trainee/OrdersPage.jsx';
import GymOwnerGymsPage from '../pages/dashboards/gymOwner/GymsPage.jsx';
import GymOwnerSubscriptionsPage from '../pages/dashboards/gymOwner/SubscriptionsPage.jsx';
import GymOwnerSponsorshipPage from '../pages/dashboards/gymOwner/SponsorshipPage.jsx';
import GymOwnerAnalyticsPage from '../pages/dashboards/gymOwner/AnalyticsPage.jsx';
import GymOwnerRosterPage from '../pages/dashboards/gymOwner/RosterPage.jsx';
import TrainerTraineesPage from '../pages/dashboards/trainer/TraineesPage.jsx';
import TrainerUpdatesPage from '../pages/dashboards/trainer/UpdatesPage.jsx';
import AdminUsersPage from '../pages/dashboards/admin/UsersPage.jsx';
import AdminUserDetailPage from '../pages/dashboards/admin/UserDetailPage.jsx';
import AdminGymsPage from '../pages/dashboards/admin/GymsPage.jsx';
import AdminGymDetailPage from '../pages/dashboards/admin/GymDetailPage.jsx';
import AdminRevenuePage from '../pages/dashboards/admin/RevenuePage.jsx';
import AdminMarketplacePage from '../pages/dashboards/admin/MarketplacePage.jsx';
import AdminMessagesPage from '../pages/dashboards/admin/MessagesPage.jsx';
import AdminMembershipsPage from '../pages/dashboards/admin/MembershipsPage.jsx';
import AdminProductsPage from '../pages/dashboards/admin/ProductsPage.jsx';
import AdminProductBuyersPage from '../pages/dashboards/admin/ProductBuyersPage.jsx';
import AdminReviewsPage from '../pages/dashboards/admin/ReviewsPage.jsx';
import AdminSubscriptionsPage from '../pages/dashboards/admin/SubscriptionsPage.jsx';
import AdminSettingsPage from '../pages/dashboards/admin/SettingsPage.jsx';
import SellerInventoryPage from '../pages/dashboards/seller/InventoryPage.jsx';
import SellerOrdersPage from '../pages/dashboards/seller/OrdersPage.jsx';
import ManagerDashboard from '../pages/dashboards/ManagerDashboard.jsx';
import ManagerApprovalsPage from '../pages/dashboards/manager/ApprovalsPage.jsx';
import ManagerSellersPage from '../pages/dashboards/manager/SellersPage.jsx';
import ManagerGymOwnersPage from '../pages/dashboards/manager/GymOwnersPage.jsx';
import ManagerGymsPage from '../pages/dashboards/manager/GymsPage.jsx';
import ManagerMarketplacePage from '../pages/dashboards/manager/MarketplacePage.jsx';
import ManagerProductsPage from '../pages/dashboards/manager/ProductsPage.jsx';
import ManagerGymDetailPage from '../pages/dashboards/manager/GymDetailPage.jsx';
import ManagerProductBuyersPage from '../pages/dashboards/manager/ProductBuyersPage.jsx';
import ManagerMessagesPage from '../pages/dashboards/manager/MessagesPage.jsx';
import ManagerUserDetailPage from '../pages/dashboards/manager/UserDetailPage.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import DashboardLayout from '../layouts/DashboardLayout.jsx';
import DashboardLanding from '../pages/dashboards/DashboardLanding.jsx';
import NotFoundPage from '../pages/errors/NotFoundPage.jsx';
import AboutPage from '../pages/about/AboutPage.jsx';
import ContactPage from '../pages/contact/ContactPage.jsx';
import PrivacyPage from '../pages/privacy/PrivacyPage.jsx';
import TermsPage from '../pages/terms/TermsPage.jsx';

const AppRouter = () => (
  <BrowserRouter>
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
          <Route path="approvals" element={<ManagerApprovalsPage />} />
          <Route path="sellers" element={<ManagerSellersPage />} />
          <Route path="gym-owners" element={<ManagerGymOwnersPage />} />
          <Route path="gyms" element={<ManagerGymsPage />} />
          <Route path="gyms/:gymId" element={<ManagerGymDetailPage />} />
          <Route path="products" element={<ManagerProductsPage />} />
          <Route path="products/:productId" element={<ManagerProductBuyersPage />} />
          <Route path="marketplace" element={<ManagerMarketplacePage />} />
          <Route path="messages" element={<ManagerMessagesPage />} />
          <Route path="users/:userId" element={<ManagerUserDetailPage />} />
        </Route>
        <Route path="admin">
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="gyms" element={<AdminGymsPage />} />
          <Route path="gyms/:gymId" element={<AdminGymDetailPage />} />
          <Route path="memberships" element={<AdminMembershipsPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/:productId" element={<AdminProductBuyersPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="marketplace" element={<AdminMarketplacePage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
          <Route path="messages" element={<AdminMessagesPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
