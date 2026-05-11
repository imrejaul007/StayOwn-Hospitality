// Test script for Notifications System
const axios = require('axios');

const BASE_URL = 'http://localhost:4000/api/v1';
const testUser = {
  email: 'test@example.com',
  password: 'password123'
};

let authToken = '';

async function testNotificationsSystem() {
  try {
    console.log('🧪 Testing Notifications System...\n');

    // 1. Login to get auth token
    console.log('1. Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, testUser);
    authToken = loginResponse.data.data.token;
    console.log('✅ Login successful\n');

    // Set up axios with auth header
    const api = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 2. Get notification types
    console.log('2. Getting notification types...');
    const typesResponse = await api.get('/notifications/types');
    console.log('✅ Notification types:', typesResponse.data.data.notificationTypes.length, 'types found\n');

    // 3. Get notification channels
    console.log('3. Getting notification channels...');
    const channelsResponse = await api.get('/notifications/channels');
    console.log('✅ Notification channels:', channelsResponse.data.data.channels.length, 'channels found\n');

    // 4. Get notification preferences
    console.log('4. Getting notification preferences...');
    const preferencesResponse = await api.get('/notifications/preferences');
    console.log('✅ Preferences loaded for user\n');

    // 5. Update notification preferences
    console.log('5. Updating notification preferences...');
    const updatePrefsResponse = await api.patch('/notifications/preferences', {
      channel: 'email',
      settings: {
        enabled: true,
        frequency: 'immediate'
      }
    });
    console.log('✅ Email preferences updated\n');

    // 6. Update specific notification type setting
    console.log('6. Updating notification type setting...');
    const updateTypeResponse = await api.patch('/notifications/preferences/email/booking_confirmation', {
      enabled: true
    });
    console.log('✅ Booking confirmation setting updated\n');

    // 7. Get notifications (should be empty initially)
    console.log('7. Getting notifications...');
    const notificationsResponse = await api.get('/notifications');
    console.log('✅ Notifications loaded:', notificationsResponse.data.data.notifications.length, 'notifications\n');

    // 8. Get unread count
    console.log('8. Getting unread count...');
    const unreadCountResponse = await api.get('/notifications/unread-count');
    console.log('✅ Unread count:', unreadCountResponse.data.data.unreadCount, '\n');

    // 9. Send test notification
    console.log('9. Sending test notification...');
    const testNotificationResponse = await api.post('/notifications/test', {
      channel: 'in_app',
      type: 'system_alert'
    });
    console.log('✅ Test notification sent\n');

    // 10. Get notifications again (should have the test notification)
    console.log('10. Getting notifications after test...');
    const notificationsAfterResponse = await api.get('/notifications');
    console.log('✅ Notifications after test:', notificationsAfterResponse.data.data.notifications.length, 'notifications\n');

    // 11. Mark notification as read
    if (notificationsAfterResponse.data.data.notifications.length > 0) {
      const notificationId = notificationsAfterResponse.data.data.notifications[0]._id;
      console.log('11. Marking notification as read...');
      await api.patch(`/notifications/${notificationId}/read`);
      console.log('✅ Notification marked as read\n');
    }

    // 12. Mark multiple notifications as read
    console.log('12. Marking multiple notifications as read...');
    const markMultipleResponse = await api.post('/notifications/mark-read', {
      notificationIds: notificationsAfterResponse.data.data.notifications.map(n => n._id)
    });
    console.log('✅ Multiple notifications marked as read:', markMultipleResponse.data.data.modifiedCount, 'notifications\n');

    // 13. Mark all notifications as read
    console.log('13. Marking all notifications as read...');
    const markAllResponse = await api.post('/notifications/mark-all-read');
    console.log('✅ All notifications marked as read:', markAllResponse.data.data.modifiedCount, 'notifications\n');

    // 14. Get notifications with filters
    console.log('14. Getting notifications with filters...');
    const filteredResponse = await api.get('/notifications?status=read&limit=5');
    console.log('✅ Filtered notifications:', filteredResponse.data.data.notifications.length, 'notifications\n');

    // 15. Get unread count again
    console.log('15. Getting unread count after marking all as read...');
    const finalUnreadResponse = await api.get('/notifications/unread-count');
    console.log('✅ Final unread count:', finalUnreadResponse.data.data.unreadCount, '\n');

    // 16. Test pagination
    console.log('16. Testing pagination...');
    const paginationResponse = await api.get('/notifications?page=1&limit=10');
    console.log('✅ Pagination info:', {
      currentPage: paginationResponse.data.data.pagination.currentPage,
      totalPages: paginationResponse.data.data.pagination.totalPages,
      totalItems: paginationResponse.data.data.pagination.totalItems,
      itemsPerPage: paginationResponse.data.data.pagination.itemsPerPage
    }, '\n');

    console.log('🎉 All notification system tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Make sure you have a valid user account with email: test@example.com and password: password123');
    }
  }
}

// Run the tests
testNotificationsSystem();
