import React, { Suspense } from 'react';
import { Route } from 'react-router-dom';
import RouteLoadingFallback from '../components/ui/RouteLoadingFallback';
import { ProtectedRoute } from '../components/ProtectedRoute';

const AdminAddOnServices = React.lazy(() => import('../pages/admin/AdminAddOnServices'));
const AdminAdvancedFeatures = React.lazy(() => import('../pages/admin/AdminAdvancedFeatures'));
const AdminBlacklist = React.lazy(() => import('../pages/admin/AdminBlacklist'));
const AdminCentralizedRates = React.lazy(() => import('../pages/admin/AdminCentralizedRates'));
const AdminCustomFields = React.lazy(() => import('../pages/admin/AdminCustomFields'));
const AdminDayUseManagement = React.lazy(() => import('../pages/admin/AdminDayUseManagement'));
const AdminDepartments = React.lazy(() => import('../pages/admin/AdminDepartments'));
const AdminGuestList = React.lazy(() => import('../pages/admin/AdminGuestList'));
const AdminGuestUpload = React.lazy(() => import('../pages/admin/AdminGuestUpload'));
const AdminHotelAreas = React.lazy(() => import('../pages/admin/AdminHotelAreas'));
const AdminLoginActivity = React.lazy(() => import('../pages/admin/AdminLoginActivity'));
const AdminOperationalManagement = React.lazy(() => import('../pages/admin/AdminOperationalManagement'));
const AdminPaymentMethods = React.lazy(() => import('../pages/admin/AdminPaymentMethods'));
const AdminPhoneExtensions = React.lazy(() => import('../pages/admin/AdminPhoneExtensions'));
const AdminPurchaseOrders = React.lazy(() => import('../pages/admin/AdminPurchaseOrders'));
const AdminReasons = React.lazy(() => import('../pages/admin/AdminReasons'));
const AdminRevenueAccounts = React.lazy(() => import('../pages/admin/AdminRevenueAccounts'));
const AdminReviewsManagement = React.lazy(() => import('../pages/admin/AdminReviewsManagement'));
const AdminRoomTaxes = React.lazy(() => import('../pages/admin/AdminRoomTaxes'));
const AdminSalutations = React.lazy(() => import('../pages/admin/AdminSalutations'));
const AdminSeasonalPricing = React.lazy(() => import('../pages/admin/AdminSeasonalPricing'));
const AdminUserAnalytics = React.lazy(() => import('../pages/admin/AdminUserAnalytics'));
const AdminUserManagement = React.lazy(() => import('../pages/admin/AdminUserManagement'));
const AdminVendorManagement = React.lazy(() => import('../pages/admin/AdminVendorManagement'));
const AdminVIP = React.lazy(() => import('../pages/admin/AdminVIP'));
const AdminWebOptimization = React.lazy(() => import('../pages/admin/AdminWebOptimization'));
const AlertsDashboard = React.lazy(() => import('../pages/admin/alerts/AlertsDashboard'));
const GuestSatisfaction = React.lazy(() => import('../pages/admin/analytics/GuestSatisfaction'));
const OccupancyAnalytics = React.lazy(() => import('../pages/admin/analytics/OccupancyAnalytics'));
const StaffPerformance = React.lazy(() => import('../pages/admin/analytics/StaffPerformance'));
const ReportBuilder = React.lazy(() => import('../pages/admin/reports/ReportBuilder'));
const ScheduledUpdates = React.lazy(() => import('../pages/admin/ScheduledUpdates'));
const BookingRulesSettings = React.lazy(() => import('../pages/admin/settings/BookingRulesSettings'));
const SettingsHistory = React.lazy(() => import('../pages/admin/SettingsHistory'));
const SystemHealth = React.lazy(() => import('../pages/admin/system/SystemHealth'));
const WalkInBooking = React.lazy(() => import('../pages/admin/WalkInBooking'));

function wrap(page: React.ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{page}</Suspense>;
}

function adminOnly(page: React.ReactNode) {
  return <ProtectedRoute allowedRoles={['admin']}>{wrap(page)}</ProtectedRoute>;
}

/**
 * Previously-unreferenced admin pages (see scripts/list-unrouted-admin-pages.cjs).
 * Must be a Fragment of `<Route>` nodes — use `{adminUnroutedRoutes}` inside a parent
 * `<Routes>`/`<Route>`; do not wrap in a custom component (React Router v6 rejects that).
 */
export const adminUnroutedRoutes = (
    <>
      <Route path="add-on-services" element={wrap(<AdminAddOnServices />)} />
      <Route path="advanced-features" element={wrap(<AdminAdvancedFeatures />)} />
      <Route path="blacklist" element={wrap(<AdminBlacklist />)} />
      <Route path="centralized-rates" element={wrap(<AdminCentralizedRates />)} />
      <Route path="custom-fields" element={wrap(<AdminCustomFields />)} />
      <Route path="day-use-management" element={wrap(<AdminDayUseManagement />)} />
      <Route path="departments" element={wrap(<AdminDepartments />)} />
      <Route path="guest-list" element={wrap(<AdminGuestList />)} />
      <Route path="guest-upload" element={wrap(<AdminGuestUpload />)} />
      <Route path="hotel-areas" element={wrap(<AdminHotelAreas />)} />
      <Route path="login-activity" element={wrap(<AdminLoginActivity />)} />
      <Route path="operational-management" element={wrap(<AdminOperationalManagement />)} />
      <Route path="payment-methods" element={wrap(<AdminPaymentMethods />)} />
      <Route path="phone-extensions" element={wrap(<AdminPhoneExtensions />)} />
      <Route path="purchase-orders" element={wrap(<AdminPurchaseOrders />)} />
      <Route path="reasons" element={wrap(<AdminReasons />)} />
      <Route path="revenue-accounts" element={wrap(<AdminRevenueAccounts />)} />
      <Route path="reviews-management" element={wrap(<AdminReviewsManagement />)} />
      <Route path="room-taxes" element={wrap(<AdminRoomTaxes />)} />
      <Route path="salutations" element={wrap(<AdminSalutations />)} />
      <Route path="seasonal-pricing" element={wrap(<AdminSeasonalPricing />)} />
      <Route path="user-analytics" element={wrap(<AdminUserAnalytics />)} />
      <Route path="user-management" element={wrap(<AdminUserManagement />)} />
      <Route path="vendor-management" element={wrap(<AdminVendorManagement />)} />
      <Route path="vip" element={wrap(<AdminVIP />)} />
      <Route path="web-optimization" element={wrap(<AdminWebOptimization />)} />
      <Route path="alerts" element={adminOnly(<AlertsDashboard />)} />
      <Route path="analytics/guest-satisfaction" element={adminOnly(<GuestSatisfaction />)} />
      <Route path="analytics/occupancy" element={adminOnly(<OccupancyAnalytics />)} />
      <Route path="analytics/staff-performance" element={adminOnly(<StaffPerformance />)} />
      <Route path="reports/builder" element={adminOnly(<ReportBuilder />)} />
      <Route path="scheduled-updates" element={wrap(<ScheduledUpdates />)} />
      <Route path="settings/booking-rules" element={wrap(<BookingRulesSettings />)} />
      <Route path="settings/history" element={wrap(<SettingsHistory />)} />
      <Route path="system/health" element={adminOnly(<SystemHealth />)} />
      <Route path="walk-in-booking" element={wrap(<WalkInBooking />)} />
    </>
);
