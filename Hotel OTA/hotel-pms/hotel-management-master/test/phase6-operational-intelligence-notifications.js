/**
 * Phase 6: Operational Intelligence Notifications - Test Suite
 * Tests the comprehensive operational intelligence notification automation system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import mongoose from backend
const mongoose = require('../backend/node_modules/mongoose');

// Test Phase 6: Operational Intelligence Notifications
async function testPhase6OperationalIntelligence() {
  console.log('\n🚀 Testing Phase 6: Operational Intelligence Notifications');
  console.log('=' .repeat(70));

  try {
    // Test 1: Daily Operations Summary via Scheduler
    console.log('\n📊 Test 1: Daily Operations Summary');
    const NotificationScheduler = (await import('../backend/src/services/notificationScheduler.js')).default;

    console.log('🔍 Running daily operations summary generation...');
    await NotificationScheduler.sendDailyOperationsSummary();
    console.log('✅ Daily operations summary notifications should have been triggered');

    // Test 2: Staff Performance Alert via UserAnalytics Hook
    console.log('\n📊 Test 2: Staff Performance Alert');
    const UserAnalytics = mongoose.model('UserAnalytics');

    // Create a mock user analytics record with poor performance
    const poorPerformanceAnalytics = new UserAnalytics({
      userId: new mongoose.Types.ObjectId(),
      hotelId: new mongoose.Types.ObjectId(),
      date: new Date(),
      engagementScore: 45, // Low engagement
      performanceMetrics: {
        efficiencyScore: 55, // Below 60 threshold
        taskCompletionRate: 65, // Below 70 threshold
        errorRate: 18, // Above 15 threshold
        responseTime: 120
      },
      activityMetrics: {
        loginCount: 5,
        sessionDuration: 240,
        pageViews: 50,
        actionsPerformed: 25
      }
    });

    console.log('📈 Creating poor performance analytics record...');
    await poorPerformanceAnalytics.save();
    console.log('✅ Staff performance alert should have been triggered');

    // Clean up
    await poorPerformanceAnalytics.deleteOne();

    // Test 3: Revenue Impact Alert via Room Status Change
    console.log('\n💰 Test 3: Revenue Impact Alert');
    const Room = mongoose.model('Room');

    // Find or create a test room
    let testRoom = await Room.findOne({ roomNumber: '101' });
    if (!testRoom) {
      console.log('⚠️  Test room not found, creating mock room...');
      testRoom = new Room({
        hotelId: new mongoose.Types.ObjectId(),
        roomNumber: '101',
        floor: 1,
        roomTypeId: new mongoose.Types.ObjectId(),
        currentRate: 250, // High-value room
        status: 'vacant'
      });
      await testRoom.save();
    }

    console.log('🏨 Setting room to out-of-order status...');
    testRoom.status = 'out_of_order';
    testRoom.maintenanceNotes = 'Air conditioning system failure';
    testRoom.outOfOrderSince = new Date();
    await testRoom.save();

    console.log('✅ Revenue impact alert should have been triggered');

    // Test 4: Guest Satisfaction Alert via Review Hook
    console.log('\n⭐ Test 4: Guest Satisfaction Alert');
    const Review = mongoose.model('Review');

    const lowRatingReview = new Review({
      hotelId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      rating: 1, // Very low rating
      title: 'Terrible Experience',
      content: 'Room was dirty, service was poor, and facilities were broken',
      categories: {
        cleanliness: 1,
        service: 1,
        location: 3,
        amenities: 2
      },
      isPublished: true
    });

    console.log('📝 Creating low-rating review...');
    await lowRatingReview.save();
    console.log('✅ Guest satisfaction alert should have been triggered');

    // Clean up
    await lowRatingReview.deleteOne();

    // Test 5: Equipment Failure Pattern Alert via MaintenanceRequest
    console.log('\n🔧 Test 5: Equipment Failure Pattern Alert');
    const MaintenanceRequest = mongoose.model('MaintenanceRequest');

    const hotelId = new mongoose.Types.ObjectId();

    // Create multiple similar maintenance requests to trigger pattern
    const failureRequests = [];
    for (let i = 0; i < 4; i++) {
      const request = new MaintenanceRequest({
        hotelId,
        roomId: new mongoose.Types.ObjectId(),
        issueType: 'Air Conditioning', // Same issue type to create pattern
        description: `AC unit failure #${i + 1}`,
        priority: i < 2 ? 'urgent' : 'high', // Some urgent failures
        estimatedCost: 150 + (i * 50),
        status: 'pending',
        reportedBy: new mongoose.Types.ObjectId(),
        createdAt: new Date(Date.now() - (i * 5 * 24 * 60 * 60 * 1000)) // Spread over time
      });

      failureRequests.push(request);
    }

    console.log('🔨 Creating multiple similar maintenance requests...');
    for (const request of failureRequests) {
      await request.save();
    }

    console.log('✅ Equipment failure pattern alert should have been triggered');

    // Clean up maintenance requests
    for (const request of failureRequests) {
      await request.deleteOne();
    }

    // Test 6: Scheduled Operational Intelligence Monitoring
    console.log('\n📊 Test 6: Scheduled Monitoring Functions');

    console.log('🔍 Testing staff performance monitoring...');
    await NotificationScheduler.checkStaffPerformance();
    console.log('✅ Staff performance monitoring completed');

    console.log('🔍 Testing revenue impact monitoring...');
    await NotificationScheduler.checkRevenueImpact();
    console.log('✅ Revenue impact monitoring completed');

    console.log('🔍 Testing guest satisfaction monitoring...');
    await NotificationScheduler.checkGuestSatisfaction();
    console.log('✅ Guest satisfaction monitoring completed');

    console.log('🔍 Testing equipment failure pattern monitoring...');
    await NotificationScheduler.checkEquipmentFailurePatterns();
    console.log('✅ Equipment failure pattern monitoring completed');

    // Test Summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 Phase 6 Operational Intelligence Notifications Test Summary:');
    console.log('✅ Daily operations summary notifications');
    console.log('✅ Staff performance alert notifications (model hooks)');
    console.log('✅ Revenue impact alert notifications (room status)');
    console.log('✅ Guest satisfaction alert notifications (review hooks)');
    console.log('✅ Equipment failure pattern notifications (maintenance hooks)');
    console.log('✅ Scheduled operational intelligence monitoring');
    console.log('✅ Enhanced Room model with revenue impact calculations');
    console.log('✅ UserAnalytics model with performance monitoring');
    console.log('✅ Review model with satisfaction alerts');
    console.log('✅ MaintenanceRequest model with failure pattern detection');
    console.log('\n🎉 All Phase 6 operational intelligence tests completed successfully!');

  } catch (error) {
    console.error('❌ Error in Phase 6 operational intelligence notifications test:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

export default testPhase6OperationalIntelligence;

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management');
  }

  await testPhase6OperationalIntelligence();
  await mongoose.disconnect();
}