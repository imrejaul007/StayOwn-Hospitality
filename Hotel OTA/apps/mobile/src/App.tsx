import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { AppProvider } from './store/index';

// Auth screens
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PhoneInputScreen from './screens/PhoneInputScreen';
import OTPVerifyScreen from './screens/OTPVerifyScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';

// Main tab screens
import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import BookingsScreen from './screens/BookingsScreen';
import WalletScreen from './screens/WalletScreen';
import RewardsScreen from './screens/RewardsScreen';
import ProfileScreen from './screens/ProfileScreen';

// Bill Pay screens
import HotelBillPayScreen from './screens/HotelBillPayScreen';
import BillPayConfirmedScreen from './screens/BillPayConfirmedScreen';

// Modal / stack screens
import HotelDetailScreen from './screens/HotelDetailScreen';
import RoomSelectionScreen from './screens/RoomSelectionScreen';
import BookingReviewScreen from './screens/BookingReviewScreen';
import CoinApplyScreen from './screens/CoinApplyScreen';
import PaymentScreen from './screens/PaymentScreen';
import BookingConfirmedScreen from './screens/BookingConfirmedScreen';
import BookingDetailScreen from './screens/BookingDetailScreen';
import VoucherScreen from './screens/VoucherScreen';
import CancelBookingScreen from './screens/CancelBookingScreen';
import CoinHistoryScreen from './screens/CoinHistoryScreen';
import StayRegistrationScreen from './screens/StayRegistrationScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SupportScreen from './screens/SupportScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Search: '🔍',
  Trips: '🧳',
  Rewards: '🪙',
  Profile: '👤',
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {TAB_ICONS[label] || '•'}
    </Text>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Trips" component={BookingsScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <AppProvider>
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Auth Stack */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="PhoneInput" component={PhoneInputScreen} />
        <Stack.Screen
          name="OTPVerify"
          component={OTPVerifyScreen}
          options={{ headerShown: true, title: 'Verify Phone' }}
        />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

        {/* Main App */}
        <Stack.Screen name="Main" component={MainTabs} />

        {/* Hotel Booking Flow */}
        <Stack.Screen
          name="HotelDetail"
          component={HotelDetailScreen}
          options={{ headerShown: true, title: 'Hotel Details' }}
        />
        <Stack.Screen
          name="RoomSelection"
          component={RoomSelectionScreen}
          options={{ headerShown: true, title: 'Select Room' }}
        />
        <Stack.Screen
          name="BookingReview"
          component={BookingReviewScreen}
          options={{ headerShown: true, title: 'Review Booking' }}
        />
        <Stack.Screen
          name="CoinApply"
          component={CoinApplyScreen}
          options={{ headerShown: true, title: 'Apply Rewards' }}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ headerShown: true, title: 'Payment' }}
        />
        <Stack.Screen
          name="BookingConfirmed"
          component={BookingConfirmedScreen}
          options={{ headerShown: false }}
        />

        {/* Booking Management */}
        <Stack.Screen
          name="BookingDetail"
          component={BookingDetailScreen}
          options={{ headerShown: true, title: 'Booking Details' }}
        />
        <Stack.Screen
          name="Voucher"
          component={VoucherScreen}
          options={{ headerShown: true, title: 'Booking Voucher' }}
        />
        <Stack.Screen
          name="CancelBooking"
          component={CancelBookingScreen}
          options={{ headerShown: true, title: 'Cancel Booking' }}
        />

        {/* Rewards */}
        <Stack.Screen
          name="CoinHistory"
          component={CoinHistoryScreen}
          options={{ headerShown: true, title: 'Coin History' }}
        />
        <Stack.Screen
          name="StayRegistration"
          component={StayRegistrationScreen}
          options={{ headerShown: true, title: 'Register Stay' }}
        />

        {/* Profile */}
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ headerShown: true, title: 'Edit Profile' }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{ headerShown: true, title: 'Notifications' }}
        />
        <Stack.Screen
          name="Support"
          component={SupportScreen}
          options={{ headerShown: true, title: 'Support' }}
        />

        {/* Bill Pay */}
        <Stack.Screen
          name="HotelBillPay"
          component={HotelBillPayScreen}
          options={{ headerShown: true, title: 'Bill Pay' }}
        />
        <Stack.Screen
          name="BillPayConfirmed"
          component={BillPayConfirmedScreen}
          options={{ headerShown: true, title: 'Bill Pay Confirmed' }}
        />

        {/* Legacy compat — BookingConfirm alias */}
        <Stack.Screen
          name="BookingConfirm"
          component={BookingConfirmedScreen}
          options={{ headerShown: true, title: 'Confirm Booking' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
    </AppProvider>
  );
}
