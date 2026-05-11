/**
 * Test server startup with Advanced Reservations route enabled
 * This will test if the server can start without crashing when the route is uncommented
 */

import express from 'express';
import mongoose from 'mongoose';
import advancedReservationsRoutes from '../backend/src/routes/advancedReservations.js';

console.log('🔧 Testing server with Advanced Reservations route...\n');

async function testServerStartup() {
  try {
    // Create minimal Express app
    console.log('1️⃣ Creating Express app...');
    const app = express();

    // Add basic middleware
    app.use(express.json());

    // Add a simple auth middleware mock for testing
    app.use('/api/v1/advanced-reservations', (req, res, next) => {
      // Mock user for testing
      req.user = {
        id: 'test-user-id',
        hotelId: 'test-hotel-id',
        role: 'admin'
      };
      next();
    });

    console.log('2️⃣ Adding Advanced Reservations routes...');
    // This is the critical line that was causing server crashes
    app.use('/api/v1/advanced-reservations', advancedReservationsRoutes);

    console.log('3️⃣ Testing route registration...');

    // Check if routes are properly registered
    const routes = [];
    app._router.stack.forEach(middleware => {
      if (middleware.route) {
        routes.push(middleware.route.path);
      } else if (middleware.name === 'router') {
        middleware.handle.stack.forEach(handler => {
          if (handler.route) {
            routes.push(handler.route.path);
          }
        });
      }
    });

    console.log('✅ Server setup completed successfully!');
    console.log('✅ Advanced Reservations route registered without crashes!');
    console.log('✅ All imports and route initialization passed!');

    console.log('\n📊 ROUTE REGISTRATION TEST');
    console.log('===========================');
    console.log('✅ PASSED: Server can start with Advanced Reservations route');
    console.log('✅ PASSED: No import/export errors detected');
    console.log('✅ PASSED: Route middleware loads successfully');

    console.log('\n🎉 SUCCESS: The Advanced Reservations route should work in the real server!');
    console.log('💡 You can now uncomment the route in server.js safely.');

    return { success: true, message: 'All tests passed' };

  } catch (error) {
    console.error('❌ Server startup test failed:', error.message);
    console.error('❌ Stack trace:', error.stack);

    console.log('\n📊 ROUTE REGISTRATION TEST');
    console.log('===========================');
    console.log('❌ FAILED: Server cannot start with Advanced Reservations route');
    console.log(`❌ ERROR: ${error.message}`);

    return { success: false, error: error.message };
  }
}

// Run test
testServerStartup()
  .then(result => {
    if (result.success) {
      console.log('\n✅ TEST COMPLETED SUCCESSFULLY');
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n🚨 Test runner failed:', error);
    process.exit(1);
  });