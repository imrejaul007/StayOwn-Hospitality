import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { PropertyProvider } from './context/PropertyContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider } from './context/ThemeContext';
import { LocalizationProvider } from './context/LocalizationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import RouteLoadingFallback from './components/ui/RouteLoadingFallback';
import PageWrapper from './components/PageWrapper';
import { adminUnroutedRoutes } from './routes/AdminUnroutedRoutes';

// Public Pages
import HomePage from './pages/public/HomePage';
import RoomsPage from './pages/public/RoomsPage';
import RoomDetailPage from './pages/public/RoomDetailPage';
import BookingPage from './pages/public/BookingPage';
import ContactPage from './pages/public/ContactPage';
import ReviewsPage from './pages/public/ReviewsPage';
import AboutPage from './pages/public/AboutPage';
import ForHotelsPage from './pages/public/ForHotelsPage';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import RezCallbackPage from './pages/auth/RezCallbackPage';

// Admin Login (kept synchronous)
import AdminLogin from './pages/admin/AdminLogin';

// Layout Components
import PublicLayout from './layouts/PublicLayout';
import GuestLayout from './layouts/GuestLayout';
import TravelAgentLayout from './layouts/TravelAgentLayout';
import AdminLayout from './layouts/AdminLayout';
import StaffLayout from './layouts/StaffLayout';
import FrontDeskLayout from './layouts/FrontDeskLayout';

// Guest App Pages (lazy loaded)
const GuestDashboard = React.lazy(() => import('./pages/guest/GuestDashboard'));
const GuestBookings = React.lazy(() => import('./pages/guest/GuestBookings'));
const GuestBookingDetail = React.lazy(() => import('./pages/guest/GuestBookingDetail'));
const GuestProfile = React.lazy(() => import('./pages/guest/GuestProfile'));
const GuestRequests = React.lazy(() => import('./pages/guest/GuestRequests'));
const InventoryRequests = React.lazy(() => import('./pages/guest/InventoryRequests'));
const LoyaltyDashboard = React.lazy(() => import('./pages/guest/LoyaltyDashboard'));
const AllOffers = React.lazy(() => import('./pages/guest/AllOffers'));
const LoyaltyTransactions = React.lazy(() => import('./pages/guest/LoyaltyTransactions'));
const FavoritesPage = React.lazy(() => import('./pages/guest/FavoritesPage'));
const RecommendationsPage = React.lazy(() => import('./pages/guest/RecommendationsPage'));
const ContactlessGuestApp = React.lazy(() => import('./components/guest/ContactlessGuestApp'));
const HotelServicesDashboard = React.lazy(() => import('./pages/guest/HotelServicesDashboard'));
const ServiceDetailsPage = React.lazy(() => import('./pages/guest/ServiceDetailsPage'));
const ServiceBookingPage = React.lazy(() => import('./pages/guest/ServiceBookingPage'));
const ServiceBookingConfirmation = React.lazy(() => import('./pages/guest/ServiceBookingConfirmation'));
const MyServiceBookings = React.lazy(() => import('./pages/guest/MyServiceBookings'));
const NotificationsDashboard = React.lazy(() => import('./pages/guest/NotificationsDashboard'));
const DigitalKeysDashboard = React.lazy(() => import('./pages/guest/DigitalKeysDashboard'));
const MeetUpRequestsDashboard = React.lazy(() => import('./pages/guest/MeetUpRequestsDashboard'));
const GuestBillingHistory = React.lazy(() => import('./pages/guest/GuestBillingHistory'));
const GuestFeedback = React.lazy(() => import('./pages/guest/GuestFeedback'));
const GuestDocuments = React.lazy(() => import('./pages/guest/GuestDocuments'));
const ProfileSettings = React.lazy(() => import('./pages/guest/ProfileSettings'));
const PreferencesSettings = React.lazy(() => import('./pages/guest/PreferencesSettings'));
const PrivacySettings = React.lazy(() => import('./pages/guest/PrivacySettings'));
const GuestSettings = React.lazy(() => import('./pages/guest/GuestSettings'));
const ImprovedBookingPage = React.lazy(() => import('./pages/public/ImprovedBookingPage'));
const RoomHub = React.lazy(() => import('./pages/guest/RoomHub'));
const QRScanner = React.lazy(() => import('./pages/guest/QRScanner'));

// Admin Pages (lazy loaded)
const AdminDashboardWrapper = React.lazy(() => import('./pages/admin/AdminDashboardWrapper'));
const AdminDailyCheckManagement = React.lazy(() => import('./pages/admin/AdminDailyCheckManagement'));
const AdminRooms = React.lazy(() => import('./pages/admin/AdminRooms'));
const RoomDetailsPage = React.lazy(() => import('./pages/admin/RoomDetailsPage'));
const RoomBookingsPage = React.lazy(() => import('./pages/admin/RoomBookingsPage'));
const AdminBookings = React.lazy(() => import('./pages/admin/AdminBookings'));
const AdminUpcomingBookings = React.lazy(() => import('./pages/admin/AdminUpcomingBookings'));
const AdminStaffManagement = React.lazy(() => import('./pages/admin/AdminStaffManagement'));
const AdminHousekeeping = React.lazy(() => import('./pages/admin/AdminHousekeeping'));
const AdminInventory = React.lazy(() => import('./pages/admin/AdminInventory'));
const AdminLaundryManagement = React.lazy(() => import('./pages/admin/AdminLaundryManagement'));
const AdminMaintenance = React.lazy(() => import('./pages/admin/AdminMaintenance'));
const AdminGuestServices = React.lazy(() => import('./pages/admin/AdminGuestServices'));
const AdminSupplyRequests = React.lazy(() => import('./pages/admin/AdminSupplyRequests'));
const AdminReports = React.lazy(() => import('./pages/admin/AdminReports'));
const AdminOTA = React.lazy(() => import('./pages/admin/AdminOTA'));
const BillingHistory = React.lazy(() => import('./pages/admin/BillingHistory'));
const AdminBypassCheckoutPage = React.lazy(() => import('./pages/admin/AdminBypassCheckout'));
const AdminBypassApprovalsPage = React.lazy(() => import('./pages/admin/AdminBypassApprovals'));
const AdminSecurityDashboardPage = React.lazy(() => import('./pages/admin/AdminSecurityDashboard'));
const AdminFinancialAnalyticsPage = React.lazy(() => import('./pages/admin/AdminFinancialAnalytics'));
const AdminCorporateDashboard = React.lazy(() => import('./pages/admin/AdminCorporateDashboard'));
const AdminTapeChart = React.lazy(() => import('./pages/admin/AdminTapeChart'));
const AdminPOS = React.lazy(() => import('./pages/admin/AdminPOS'));
const AdminRevenueManagement = React.lazy(() => import('./pages/admin/AdminRevenueManagement'));
const AdminBookingEngine = React.lazy(() => import('./pages/admin/AdminBookingEngine'));
const AdminFinancial = React.lazy(() => import('./pages/admin/AdminFinancial'));
const AdminMultiProperty = React.lazy(() => import('./pages/admin/AdminMultiProperty'));
const AdminMobileApps = React.lazy(() => import('./pages/admin/AdminMobileApps'));
const AdminRoomQRManagement = React.lazy(() => import('./pages/admin/AdminRoomQRManagement'));
const AdminAPIManagement = React.lazy(() => import('./pages/admin/AdminAPIManagement'));
const AdminPOSTaxes = React.lazy(() => import('./pages/admin/AdminPOSTaxes'));
const AdminMeasurementUnits = React.lazy(() => import('./pages/admin/AdminMeasurementUnits'));
const AdminPOSAttributes = React.lazy(() => import('./pages/admin/AdminPOSAttributes'));
const AdminBillMessages = React.lazy(() => import('./pages/admin/AdminBillMessages'));
const AdminRoomTypes = React.lazy(() => import('./pages/admin/AdminRoomTypes'));
const AdminRoomPricing = React.lazy(() => import('./pages/admin/AdminRoomPricing'));
const AdminRoomTypeAllotments = React.lazy(() => import('./pages/admin/AdminRoomTypeAllotments'));
const AdminRoomAllotmentCreate = React.lazy(() => import('./pages/admin/AdminRoomAllotmentCreate'));
const AdminInventoryManagement = React.lazy(() => import('./pages/admin/AdminInventoryManagement'));
const CorporateCreditManagement = React.lazy(() => import('./components/admin/CorporateCreditManagement'));
const GSTManagement = React.lazy(() => import('./components/admin/GSTManagement'));
const CorporateUserRegistration = React.lazy(() => import('./components/admin/CorporateUserRegistration'));
const InventoryTemplateManagement = React.lazy(() => import('./components/admin/InventoryTemplateManagement').then(m => ({ default: m.InventoryTemplateManagement })));
const AIDashboard = React.lazy(() => import('./components/analytics/AIDashboard'));
const NotificationAnalyticsDashboard = React.lazy(() => import('./components/analytics/NotificationAnalyticsDashboard').then(m => ({ default: m.NotificationAnalyticsDashboard })));
const OverbookingConfiguration = React.lazy(() => import('./components/admin/OverbookingConfiguration'));
const AdminWebSettings = React.lazy(() => import('./pages/admin/AdminWebSettings'));
const AdminBookingFormBuilder = React.lazy(() => import('./pages/admin/AdminBookingFormBuilder'));
const AdminAutomation = React.lazy(() => import('./pages/admin/AdminAutomation'));
const AdminOfferManagement = React.lazy(() => import('./pages/admin/AdminOfferManagement'));
const AdminServiceManagement = React.lazy(() => import('./pages/admin/AdminServiceManagement'));
const AdminDigitalKeyManagement = React.lazy(() => import('./pages/admin/AdminDigitalKeyManagement'));
const AdminMeetUpManagement = React.lazy(() => import('./pages/admin/AdminMeetUpManagement'));
const AdminInventoryRequests = React.lazy(() => import('./pages/admin/AdminInventoryRequests'));
const AdminServiceRequests = React.lazy(() => import('./pages/admin/AdminServiceRequests'));
const AdminCheckoutInventoryManagement = React.lazy(() => import('./pages/admin/AdminCheckoutInventoryManagement'));
const AdminTravelDashboard = React.lazy(() => import('./pages/admin/AdminTravelDashboard'));
const TravelAgentForm = React.lazy(() => import('./pages/admin/TravelAgentForm'));
const TravelAgentDetail = React.lazy(() => import('./pages/admin/TravelAgentDetail'));
const AdminDocumentVerification = React.lazy(() => import('./pages/admin/AdminDocumentVerification'));
const AdminDocumentAnalytics = React.lazy(() => import('./pages/admin/AdminDocumentAnalytics'));
const AdminNotifications = React.lazy(() => import('./pages/admin/AdminNotifications'));
const AdminGuestManagement = React.lazy(() => import('./pages/admin/AdminGuestManagement'));
const PortfolioDashboard = React.lazy(() => import('./pages/admin/PortfolioDashboard'));
const ApprovalManagement = React.lazy(() => import('./pages/admin/ApprovalManagement'));
const AdminAuditLogPage = React.lazy(() => import('./pages/admin/AuditLog'));
const AdminSettingsHubPage = React.lazy(() => import('./pages/admin/AdminSettings'));
const AdminRevenueAnalyticsPage = React.lazy(() => import('./pages/admin/analytics/RevenueAnalytics'));
const AdminLoyaltyManager = React.lazy(() => import('./pages/admin/AdminLoyaltyManager'));
const AdminChat = React.lazy(() => import('./pages/admin/AdminChat'));

// Admin Settings Pages (lazy loaded)
const AdminProfileSettings = React.lazy(() => import('./pages/admin/settings/ProfileSettings'));
const AdminNotificationSettings = React.lazy(() => import('./pages/admin/settings/NotificationSettings'));
const AdminDisplaySettings = React.lazy(() => import('./pages/admin/settings/DisplaySettings'));
const AdminHotelSettings = React.lazy(() => import('./pages/admin/settings/HotelSettings'));
const AdminSystemSettings = React.lazy(() => import('./pages/admin/settings/SystemSettings'));
const AdminIntegrationSettings = React.lazy(() => import('./pages/admin/settings/IntegrationSettings'));

// Travel Agent Pages (lazy loaded)
const TravelAgentDashboard = React.lazy(() => import('./pages/travel-agent/TravelAgentDashboard'));
const TravelAgentNotifications = React.lazy(() => import('./pages/travel-agent/TravelAgentNotifications'));
const BookingCreate = React.lazy(() => import('./pages/travel-agent/BookingCreate'));
const ViewRates = React.lazy(() => import('./pages/travel-agent/ViewRates'));
const ProfileEdit = React.lazy(() => import('./pages/travel-agent/ProfileEdit'));
const MultiBooking = React.lazy(() => import('./pages/travel-agent/MultiBooking'));
const TravelAgentSettings = React.lazy(() => import('./pages/travel-agent/TravelAgentSettings'));

// Staff Pages (lazy loaded)
const StaffDashboard = React.lazy(() => import('./pages/staff/StaffDashboard'));
const StaffUpcomingBookings = React.lazy(() => import('./pages/staff/StaffUpcomingBookings'));
const StaffNotifications = React.lazy(() => import('./pages/staff/StaffNotifications'));
const StaffHousekeeping = React.lazy(() => import('./pages/staff/StaffHousekeeping'));
const StaffMaintenance = React.lazy(() => import('./pages/staff/StaffMaintenance'));
const StaffGuestServices = React.lazy(() => import('./pages/staff/StaffGuestServices'));
const StaffInventoryRequests = React.lazy(() => import('./pages/staff/StaffInventoryRequests'));
const StaffServiceRequests = React.lazy(() => import('./pages/staff/StaffServiceRequests'));
const StaffSupplyRequests = React.lazy(() => import('./pages/staff/StaffSupplyRequests'));
const StaffRooms = React.lazy(() => import('./pages/staff/StaffRooms'));
const StaffInventory = React.lazy(() => import('./pages/staff/StaffInventory'));
const StaffReports = React.lazy(() => import('./pages/staff/StaffReports'));
const StaffAlertCenter = React.lazy(() => import('./pages/staff/StaffAlertCenter'));
const StaffMeetUpSupervision = React.lazy(() => import('./pages/staff/StaffMeetUpSupervision'));
const CheckoutInventory = React.lazy(() => import('./pages/staff/CheckoutInventory'));
const DailyRoutineCheck = React.lazy(() => import('./pages/staff/DailyRoutineCheck'));
const StaffDocuments = React.lazy(() => import('./pages/staff/StaffDocuments'));
const DailyInventoryCheckForm = React.lazy(() => import('./components/staff/DailyInventoryCheckForm').then(m => ({ default: m.DailyInventoryCheckForm })));
const StaffGuestManagement = React.lazy(() => import('./pages/staff/StaffGuestManagement'));
const StaffBilling = React.lazy(() => import('./pages/staff/StaffBilling'));

// Staff Settings Pages (lazy loaded)
const StaffProfileSettings = React.lazy(() => import('./pages/staff/settings/StaffProfileSettings'));
const StaffNotificationSettings = React.lazy(() => import('./pages/staff/settings/StaffNotificationSettings'));
const StaffDisplaySettings = React.lazy(() => import('./pages/staff/settings/StaffDisplaySettings'));
const StaffAvailabilitySettings = React.lazy(() => import('./pages/staff/settings/StaffAvailabilitySettings'));

// FrontDesk Pages (lazy loaded)
const FrontDeskDashboard = React.lazy(() => import('./pages/frontdesk/FrontDeskDashboard'));
const FrontDeskRooms = React.lazy(() => import('./pages/frontdesk/FrontDeskRooms'));
const FrontDeskRoomTypes = React.lazy(() => import('./pages/frontdesk/FrontDeskRoomTypes'));
const FrontDeskTapeChart = React.lazy(() => import('./pages/frontdesk/FrontDeskTapeChart'));
const FrontDeskBookings = React.lazy(() => import('./pages/frontdesk/FrontDeskBookings'));
const FrontDeskUpcomingBookings = React.lazy(() => import('./pages/frontdesk/FrontDeskUpcomingBookings'));
const FrontDeskCorporate = React.lazy(() => import('./pages/frontdesk/FrontDeskCorporate'));
const FrontDeskTravelAgents = React.lazy(() => import('./pages/frontdesk/FrontDeskTravelAgents'));
const FrontDeskStaffManagement = React.lazy(() => import('./pages/frontdesk/FrontDeskStaffManagement'));
const FrontDeskBilling = React.lazy(() => import('./pages/frontdesk/FrontDeskBilling'));
const FrontDeskBookingEngine = React.lazy(() => import('./pages/frontdesk/FrontDeskBookingEngine'));
const FrontDeskHousekeeping = React.lazy(() => import('./pages/frontdesk/FrontDeskHousekeeping'));
const FrontDeskDailyCheck = React.lazy(() => import('./pages/frontdesk/FrontDeskDailyCheck'));
const FrontDeskMaintenance = React.lazy(() => import('./pages/frontdesk/FrontDeskMaintenance'));
const FrontDeskGuestServices = React.lazy(() => import('./pages/frontdesk/FrontDeskGuestServices'));
const FrontDeskServiceRequests = React.lazy(() => import('./pages/frontdesk/FrontDeskServiceRequests'));
const FrontDeskInventoryRequests = React.lazy(() => import('./pages/frontdesk/FrontDeskInventoryRequests'));
const FrontDeskHotelServices = React.lazy(() => import('./pages/frontdesk/FrontDeskHotelServices'));
const FrontDeskMeetUp = React.lazy(() => import('./pages/frontdesk/FrontDeskMeetUp'));
const FrontDeskSupply = React.lazy(() => import('./pages/frontdesk/FrontDeskSupply'));
const FrontDeskInventory = React.lazy(() => import('./pages/frontdesk/FrontDeskInventory'));
const FrontDeskCheckout = React.lazy(() => import('./pages/frontdesk/FrontDeskCheckout'));
const FrontDeskInventoryAutomation = React.lazy(() => import('./pages/frontdesk/FrontDeskInventoryAutomation'));
const MyApprovalRequests = React.lazy(() => import('./pages/frontdesk/MyApprovalRequests'));
const FrontDeskAlertCenter = React.lazy(() => import('./pages/frontdesk/FrontDeskAlertCenter'));
const FrontDeskSettings = React.lazy(() => import('./pages/frontdesk/FrontDeskSettings'));
const FrontDeskReports = React.lazy(() => import('./pages/frontdesk/FrontDeskReports'));
const FrontDeskNotifications = React.lazy(() => import('./pages/frontdesk/FrontDeskNotifications'));
const FrontDeskNightAudit = React.lazy(() => import('./pages/frontdesk/FrontDeskNightAudit'));
const FrontDeskLostFound = React.lazy(() => import('./pages/frontdesk/FrontDeskLostFound'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SocketProvider>
          <PropertyProvider>
            <KeyboardShortcutsProvider>
              <ThemeProvider>
                <LocalizationProvider>
                <ErrorBoundary showErrorDetails>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
              <Routes>
              {/* Public Routes - Accessible to all users */}
              <Route path="/" element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="rooms/:type" element={<RoomDetailPage />} />
                <Route path="booking" element={<BookingPage />} />
                <Route path="improved-booking" element={<Suspense fallback={<RouteLoadingFallback />}><ImprovedBookingPage /></Suspense>} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="for-hotels" element={<ForHotelsPage />} />
                {/* QR Code Room Hub - accessible via room QR codes */}
                <Route path="room-hub" element={<Suspense fallback={<RouteLoadingFallback />}><RoomHub /></Suspense>} />
                <Route path="scan" element={<Suspense fallback={<RouteLoadingFallback />}><QRScanner /></Suspense>} />
              </Route>

              {/* Auth Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/rez-callback" element={<RezCallbackPage />} />

              {/* Guest App Routes */}
              <Route path="/app" element={
                <ProtectedRoute allowedRoles={['guest']}>
                  <GuestLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Suspense fallback={<RouteLoadingFallback />}><GuestDashboard /></Suspense>} />
                <Route path="bookings" element={<Suspense fallback={<RouteLoadingFallback />}><GuestBookings /></Suspense>} />
                <Route path="bookings/:id" element={<Suspense fallback={<RouteLoadingFallback />}><GuestBookingDetail /></Suspense>} />
                <Route path="billing" element={<Suspense fallback={<RouteLoadingFallback />}><GuestBillingHistory /></Suspense>} />
                <Route path="loyalty" element={<Suspense fallback={<RouteLoadingFallback />}><LoyaltyDashboard /></Suspense>} />
                <Route path="loyalty/offers" element={<Suspense fallback={<RouteLoadingFallback />}><AllOffers /></Suspense>} />
                <Route path="loyalty/favorites" element={<Suspense fallback={<RouteLoadingFallback />}><FavoritesPage /></Suspense>} />
                <Route path="loyalty/recommendations" element={<Suspense fallback={<RouteLoadingFallback />}><RecommendationsPage /></Suspense>} />
                <Route path="loyalty/transactions" element={<Suspense fallback={<RouteLoadingFallback />}><LoyaltyTransactions /></Suspense>} />
                <Route path="services" element={<Suspense fallback={<RouteLoadingFallback />}><HotelServicesDashboard /></Suspense>} />
                <Route path="services/:serviceId" element={<Suspense fallback={<RouteLoadingFallback />}><ServiceDetailsPage /></Suspense>} />
                <Route path="services/:serviceId/book" element={<Suspense fallback={<RouteLoadingFallback />}><ServiceBookingPage /></Suspense>} />
                <Route path="services/bookings" element={<Suspense fallback={<RouteLoadingFallback />}><MyServiceBookings /></Suspense>} />
                <Route path="services/bookings/confirmation/:bookingId" element={<Suspense fallback={<RouteLoadingFallback />}><ServiceBookingConfirmation /></Suspense>} />
                <Route path="notifications" element={<Suspense fallback={<RouteLoadingFallback />}><NotificationsDashboard /></Suspense>} />
                <Route path="keys" element={<Suspense fallback={<RouteLoadingFallback />}><DigitalKeysDashboard /></Suspense>} />
                <Route path="meet-ups" element={<Suspense fallback={<RouteLoadingFallback />}><MeetUpRequestsDashboard /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<RouteLoadingFallback />}><GuestProfile /></Suspense>} />
                <Route path="requests" element={<Suspense fallback={<RouteLoadingFallback />}><GuestRequests /></Suspense>} />
                <Route path="inventory-requests" element={<Suspense fallback={<RouteLoadingFallback />}><InventoryRequests /></Suspense>} />
                <Route path="documents" element={<Suspense fallback={<RouteLoadingFallback />}><GuestDocuments /></Suspense>} />
                <Route path="feedback" element={<Suspense fallback={<RouteLoadingFallback />}><GuestFeedback /></Suspense>} />
                <Route path="settings/profile" element={<Suspense fallback={<RouteLoadingFallback />}><ProfileSettings /></Suspense>} />
                <Route path="settings/preferences" element={<Suspense fallback={<RouteLoadingFallback />}><PreferencesSettings /></Suspense>} />
                <Route path="settings/privacy" element={<Suspense fallback={<RouteLoadingFallback />}><PrivacySettings /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<RouteLoadingFallback />}><GuestSettings /></Suspense>} />
                <Route path="mobile-app" element={<Suspense fallback={<RouteLoadingFallback />}><ContactlessGuestApp /></Suspense>} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<PageWrapper><AdminDashboardWrapper /></PageWrapper>} />
                <Route path="portfolio" element={<PageWrapper><PortfolioDashboard /></PageWrapper>} />
                <Route path="rooms" element={<PageWrapper><AdminRooms /></PageWrapper>} />
                <Route path="rooms/:roomId" element={<PageWrapper><RoomDetailsPage /></PageWrapper>} />
                <Route path="rooms/:roomId/bookings" element={<PageWrapper><RoomBookingsPage /></PageWrapper>} />
                <Route path="bookings" element={<PageWrapper><AdminBookings /></PageWrapper>} />
                <Route path="upcoming-bookings" element={<PageWrapper><AdminUpcomingBookings /></PageWrapper>} />
                <Route path="staff" element={<PageWrapper><AdminStaffManagement /></PageWrapper>} />
                <Route path="guest-management" element={<PageWrapper><AdminGuestManagement /></PageWrapper>} />
                <Route path="corporate" element={<PageWrapper><AdminCorporateDashboard /></PageWrapper>} />
                <Route path="corporate/credit" element={<Suspense fallback={<RouteLoadingFallback />}><CorporateCreditManagement /></Suspense>} />
                <Route path="corporate/gst" element={<Suspense fallback={<RouteLoadingFallback />}><GSTManagement /></Suspense>} />
                <Route path="corporate/users" element={<Suspense fallback={<RouteLoadingFallback />}><CorporateUserRegistration /></Suspense>} />
                <Route path="housekeeping" element={<Suspense fallback={<RouteLoadingFallback />}><AdminHousekeeping /></Suspense>} />
                <Route path="daily-check-management" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDailyCheckManagement /></Suspense>} />
                <Route path="maintenance" element={<Suspense fallback={<RouteLoadingFallback />}><AdminMaintenance /></Suspense>} />
                <Route path="guest-services" element={<Suspense fallback={<RouteLoadingFallback />}><AdminGuestServices /></Suspense>} />
                <Route path="inventory-requests" element={<Suspense fallback={<RouteLoadingFallback />}><AdminInventoryRequests /></Suspense>} />
                <Route path="service-requests" element={<Suspense fallback={<RouteLoadingFallback />}><AdminServiceRequests /></Suspense>} />
                <Route path="guest-chat" element={<Suspense fallback={<RouteLoadingFallback />}><AdminChat /></Suspense>} />
                <Route path="supply-requests" element={<Suspense fallback={<RouteLoadingFallback />}><AdminSupplyRequests /></Suspense>} />
                <Route path="inventory" element={<Suspense fallback={<RouteLoadingFallback />}><AdminInventory /></Suspense>} />
                <Route
                  path="checkout-inventory"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<RouteLoadingFallback />}><AdminCheckoutInventoryManagement /></Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route path="inventory/templates" element={<Suspense fallback={<RouteLoadingFallback />}><InventoryTemplateManagement /></Suspense>} />
                <Route path="inventory-management" element={<Suspense fallback={<RouteLoadingFallback />}><AdminInventoryManagement /></Suspense>} />
                <Route path="laundry" element={<Suspense fallback={<RouteLoadingFallback />}><AdminLaundryManagement /></Suspense>} />
                <Route path="room-types" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomTypes /></Suspense>} />
                <Route path="room-pricing" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomPricing /></Suspense>} />
                <Route path="room-allotments/create" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomAllotmentCreate /></Suspense>} />
                <Route path="room-allotments/:id/edit" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomAllotmentCreate /></Suspense>} />
                <Route path="room-allotments" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomTypeAllotments /></Suspense>} />
                <Route
                  path="reports"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<RouteLoadingFallback />}><AdminReports /></Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="bypass-checkout"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <Suspense fallback={<RouteLoadingFallback />}><AdminBypassCheckoutPage /></Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route path="bypass-approvals" element={<Suspense fallback={<RouteLoadingFallback />}><AdminBypassApprovalsPage /></Suspense>} />
                <Route path="security-dashboard" element={<Suspense fallback={<RouteLoadingFallback />}><AdminSecurityDashboardPage /></Suspense>} />
                <Route path="financial-analytics" element={<Suspense fallback={<RouteLoadingFallback />}><AdminFinancialAnalyticsPage /></Suspense>} />
                <Route path="analytics/revenue" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRevenueAnalyticsPage /></Suspense>} />
                <Route path="audit-log" element={<Suspense fallback={<RouteLoadingFallback />}><AdminAuditLogPage /></Suspense>} />
                <Route path="configuration" element={<Suspense fallback={<RouteLoadingFallback />}><AdminSettingsHubPage /></Suspense>} />
                <Route path="ota" element={<Suspense fallback={<RouteLoadingFallback />}><AdminOTA /></Suspense>} />
                <Route path="billing" element={<Suspense fallback={<RouteLoadingFallback />}><BillingHistory /></Suspense>} />
                <Route path="tape-chart" element={<Suspense fallback={<RouteLoadingFallback />}><AdminTapeChart /></Suspense>} />
                <Route path="pos/taxes" element={<Suspense fallback={<RouteLoadingFallback />}><AdminPOSTaxes /></Suspense>} />
                <Route path="pos/measurement-units" element={<Suspense fallback={<RouteLoadingFallback />}><AdminMeasurementUnits /></Suspense>} />
                <Route path="pos/attributes" element={<Suspense fallback={<RouteLoadingFallback />}><AdminPOSAttributes /></Suspense>} />
                <Route path="pos/bill-messages" element={<Suspense fallback={<RouteLoadingFallback />}><AdminBillMessages /></Suspense>} />
                <Route path="pos" element={<Suspense fallback={<RouteLoadingFallback />}><AdminPOS /></Suspense>} />
                <Route path="revenue" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRevenueManagement /></Suspense>} />
                <Route path="overbooking" element={<Suspense fallback={<RouteLoadingFallback />}><OverbookingConfiguration /></Suspense>} />
                <Route path="booking-engine" element={<Suspense fallback={<RouteLoadingFallback />}><AdminBookingEngine /></Suspense>} />
                <Route path="booking-forms" element={<Suspense fallback={<RouteLoadingFallback />}><AdminBookingFormBuilder /></Suspense>} />
                <Route path="web-settings" element={<Suspense fallback={<RouteLoadingFallback />}><AdminWebSettings /></Suspense>} />
                <Route path="financial" element={<Suspense fallback={<RouteLoadingFallback />}><AdminFinancial /></Suspense>} />
                <Route path="multi-property" element={<Suspense fallback={<RouteLoadingFallback />}><AdminMultiProperty /></Suspense>} />
                <Route path="mobile-apps" element={<Suspense fallback={<RouteLoadingFallback />}><AdminMobileApps /></Suspense>} />
                <Route path="api-management" element={<Suspense fallback={<RouteLoadingFallback />}><AdminAPIManagement /></Suspense>} />
                <Route path="ai-dashboard" element={<Suspense fallback={<RouteLoadingFallback />}><AIDashboard /></Suspense>} />
                <Route path="automation" element={<Suspense fallback={<RouteLoadingFallback />}><AdminAutomation /></Suspense>} />
                <Route path="offers" element={<Suspense fallback={<RouteLoadingFallback />}><AdminOfferManagement /></Suspense>} />
                <Route path="loyalty-manager" element={<Suspense fallback={<RouteLoadingFallback />}><AdminLoyaltyManager /></Suspense>} />
                <Route path="services" element={<Suspense fallback={<RouteLoadingFallback />}><AdminServiceManagement /></Suspense>} />
                <Route path="digital-keys" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDigitalKeyManagement /></Suspense>} />
                <Route path="room-qr" element={<Suspense fallback={<RouteLoadingFallback />}><AdminRoomQRManagement /></Suspense>} />
                <Route path="meet-up-management" element={<Suspense fallback={<RouteLoadingFallback />}><AdminMeetUpManagement /></Suspense>} />
                <Route path="documents" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDocumentVerification /></Suspense>} />
                <Route path="documents/analytics" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDocumentAnalytics /></Suspense>} />
                <Route path="notifications" element={<Suspense fallback={<RouteLoadingFallback />}><AdminNotifications /></Suspense>} />
                <Route path="notification-analytics" element={<Suspense fallback={<RouteLoadingFallback />}><NotificationAnalyticsDashboard /></Suspense>} />
                <Route path="travel-dashboard" element={<Suspense fallback={<RouteLoadingFallback />}><AdminTravelDashboard /></Suspense>} />
                <Route path="travel-agents/new" element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentForm /></Suspense>} />
                <Route path="travel-agents/:id" element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentDetail /></Suspense>} />
                <Route path="travel-agents/:id/edit" element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentForm /></Suspense>} />
                <Route path="approval-management" element={<Suspense fallback={<RouteLoadingFallback />}><ApprovalManagement /></Suspense>} />

                {/* Admin Settings Routes */}
                <Route path="settings/profile" element={<Suspense fallback={<RouteLoadingFallback />}><AdminProfileSettings /></Suspense>} />
                <Route path="settings/notifications" element={<Suspense fallback={<RouteLoadingFallback />}><AdminNotificationSettings /></Suspense>} />
                <Route path="settings/display" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDisplaySettings /></Suspense>} />
                <Route path="settings/hotel" element={<Suspense fallback={<RouteLoadingFallback />}><AdminHotelSettings /></Suspense>} />
                <Route path="settings/system" element={<Suspense fallback={<RouteLoadingFallback />}><AdminSystemSettings /></Suspense>} />
                <Route path="settings/integrations" element={<Suspense fallback={<RouteLoadingFallback />}><AdminIntegrationSettings /></Suspense>} />

                {adminUnroutedRoutes}
              </Route>

              {/* FrontDesk Routes */}
              <Route path="/frontdesk" element={
                <ProtectedRoute allowedRoles={['frontdesk']}>
                  <FrontDeskLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskDashboard /></Suspense>} />
                <Route path="rooms" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskRooms /></Suspense>} />
                <Route path="room-types" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskRoomTypes /></Suspense>} />
                <Route path="tape-chart" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskTapeChart /></Suspense>} />
                <Route path="bookings" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskBookings /></Suspense>} />
                <Route path="upcoming-bookings" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskUpcomingBookings /></Suspense>} />
                <Route path="corporate" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskCorporate /></Suspense>} />
                <Route path="travel-agents" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskTravelAgents /></Suspense>} />
                <Route path="staff" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskStaffManagement /></Suspense>} />
                <Route path="billing" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskBilling /></Suspense>} />
                <Route path="booking-engine" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskBookingEngine /></Suspense>} />
                <Route path="housekeeping" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskHousekeeping /></Suspense>} />
                <Route path="daily-check-management" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskDailyCheck /></Suspense>} />
                <Route path="maintenance" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskMaintenance /></Suspense>} />
                <Route path="guest-services" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskGuestServices /></Suspense>} />
                <Route path="service-requests" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskServiceRequests /></Suspense>} />
                <Route path="guest-chat" element={<Suspense fallback={<RouteLoadingFallback />}><AdminChat /></Suspense>} />
                <Route path="inventory-requests" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskInventoryRequests /></Suspense>} />
                <Route path="hotel-services" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskHotelServices /></Suspense>} />
                <Route path="meet-up-management" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskMeetUp /></Suspense>} />
                <Route path="supply-requests" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskSupply /></Suspense>} />
                <Route path="inventory" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskInventory /></Suspense>} />
                <Route path="checkout" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskCheckout /></Suspense>} />
                <Route path="inventory-automation" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskInventoryAutomation /></Suspense>} />
                <Route path="my-approvals" element={<Suspense fallback={<RouteLoadingFallback />}><MyApprovalRequests /></Suspense>} />
                <Route path="digital-keys" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDigitalKeyManagement /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskAlertCenter /></Suspense>} />
                <Route path="night-audit" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskNightAudit /></Suspense>} />
                <Route path="lost-found" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskLostFound /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskSettings /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskReports /></Suspense>} />
                <Route path="notifications" element={<Suspense fallback={<RouteLoadingFallback />}><FrontDeskNotifications /></Suspense>} />
              </Route>

              {/* Travel Agent Routes */}
              <Route path="/travel-agent" element={
                <ProtectedRoute allowedRoles={['travel_agent']}>
                  <TravelAgentLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentDashboard /></Suspense>} />
                <Route path="dashboard" element={<Navigate to="/travel-agent" replace />} />
                <Route path="notifications" element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentNotifications /></Suspense>} />
                <Route path="bookings" element={<Navigate to="/travel-agent" replace />} />
                <Route path="booking/new" element={<Suspense fallback={<RouteLoadingFallback />}><BookingCreate /></Suspense>} />
                <Route path="new-booking" element={<Suspense fallback={<RouteLoadingFallback />}><BookingCreate /></Suspense>} />
                <Route path="multi-booking" element={<Suspense fallback={<RouteLoadingFallback />}><MultiBooking /></Suspense>} />
                <Route path="rates" element={<Suspense fallback={<RouteLoadingFallback />}><ViewRates /></Suspense>} />
                <Route path="profile/edit" element={<Suspense fallback={<RouteLoadingFallback />}><ProfileEdit /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<RouteLoadingFallback />}><TravelAgentSettings /></Suspense>} />
              </Route>

              {/* Staff Routes */}
              <Route path="/staff" element={
                <ProtectedRoute allowedRoles={['staff']}>
                  <StaffLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Suspense fallback={<RouteLoadingFallback />}><StaffDashboard /></Suspense>} />
                <Route path="upcoming-bookings" element={<Suspense fallback={<RouteLoadingFallback />}><StaffUpcomingBookings /></Suspense>} />
                <Route path="notifications" element={<Suspense fallback={<RouteLoadingFallback />}><StaffNotifications /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={<RouteLoadingFallback />}><StaffAlertCenter /></Suspense>} />
                <Route path="meetup-supervision" element={<Suspense fallback={<RouteLoadingFallback />}><StaffMeetUpSupervision /></Suspense>} />
                <Route path="inventory-check/:roomId" element={<Suspense fallback={<RouteLoadingFallback />}><DailyInventoryCheckForm /></Suspense>} />
                <Route path="inventory-check" element={<Suspense fallback={<RouteLoadingFallback />}><DailyInventoryCheckForm /></Suspense>} />
                <Route path="housekeeping" element={<Suspense fallback={<RouteLoadingFallback />}><StaffHousekeeping /></Suspense>} />
                <Route path="maintenance" element={<Suspense fallback={<RouteLoadingFallback />}><StaffMaintenance /></Suspense>} />
                <Route path="guest-services" element={<Suspense fallback={<RouteLoadingFallback />}><StaffGuestServices /></Suspense>} />
                <Route path="guest-management" element={<Suspense fallback={<RouteLoadingFallback />}><StaffGuestManagement /></Suspense>} />
                <Route path="billing" element={<Suspense fallback={<RouteLoadingFallback />}><StaffBilling /></Suspense>} />
                <Route path="inventory-requests" element={<Suspense fallback={<RouteLoadingFallback />}><StaffInventoryRequests /></Suspense>} />
                <Route path="service-requests" element={<Suspense fallback={<RouteLoadingFallback />}><StaffServiceRequests /></Suspense>} />
                <Route path="guest-chat" element={<Suspense fallback={<RouteLoadingFallback />}><AdminChat /></Suspense>} />
                <Route path="supply-requests" element={<Suspense fallback={<RouteLoadingFallback />}><StaffSupplyRequests /></Suspense>} />
                <Route path="rooms" element={<Suspense fallback={<RouteLoadingFallback />}><StaffRooms /></Suspense>} />
                <Route path="inventory" element={<Suspense fallback={<RouteLoadingFallback />}><StaffInventory /></Suspense>} />
                <Route path="daily-routine-check" element={<Suspense fallback={<RouteLoadingFallback />}><DailyRoutineCheck /></Suspense>} />
                <Route path="checkout-inventory" element={<Suspense fallback={<RouteLoadingFallback />}><CheckoutInventory /></Suspense>} />
                <Route path="documents" element={<Suspense fallback={<RouteLoadingFallback />}><StaffDocuments /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<RouteLoadingFallback />}><StaffReports /></Suspense>} />
                <Route path="digital-keys" element={<Suspense fallback={<RouteLoadingFallback />}><AdminDigitalKeyManagement /></Suspense>} />

                {/* Staff Settings Routes */}
                <Route path="settings/profile" element={<Suspense fallback={<RouteLoadingFallback />}><StaffProfileSettings /></Suspense>} />
                <Route path="settings/notifications" element={<Suspense fallback={<RouteLoadingFallback />}><StaffNotificationSettings /></Suspense>} />
                <Route path="settings/display" element={<Suspense fallback={<RouteLoadingFallback />}><StaffDisplaySettings /></Suspense>} />
                <Route path="settings/availability" element={<Suspense fallback={<RouteLoadingFallback />}><StaffAvailabilitySettings /></Suspense>} />
              </Route>

                            {/* Catch all route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#363636',
                  color: '#fff',
              },
            }}
          />
              </div>
              </ErrorBoundary>
                </LocalizationProvider>
              </ThemeProvider>
            </KeyboardShortcutsProvider>
          </PropertyProvider>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
