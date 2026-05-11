/**
 * Test file to check import issues for Advanced Reservations route
 * This will test each component in isolation to identify import/export problems
 */

console.log('🔧 Testing Advanced Reservations imports...\n');

async function testImports() {
  const results = {
    passed: [],
    failed: []
  };

  // Test 1: AdvancedReservation Model
  console.log('1️⃣ Testing AdvancedReservation model import...');
  try {
    const AdvancedReservation = await import('../backend/src/models/AdvancedReservation.js');
    console.log('✅ AdvancedReservation model imported successfully');
    results.passed.push('AdvancedReservation model');
  } catch (error) {
    console.error('❌ AdvancedReservation model import failed:', error.message);
    results.failed.push(`AdvancedReservation model: ${error.message}`);
  }

  // Test 2: RoomUpgrade Model
  console.log('\n2️⃣ Testing RoomUpgrade model import...');
  try {
    const RoomUpgrade = await import('../backend/src/models/RoomUpgrade.js');
    console.log('✅ RoomUpgrade model imported successfully');
    results.passed.push('RoomUpgrade model');
  } catch (error) {
    console.error('❌ RoomUpgrade model import failed:', error.message);
    results.failed.push(`RoomUpgrade model: ${error.message}`);
  }

  // Test 3: WaitingList Model
  console.log('\n3️⃣ Testing WaitingList model import...');
  try {
    const WaitingList = await import('../backend/src/models/WaitingList.js');
    console.log('✅ WaitingList model imported successfully');
    results.passed.push('WaitingList model');
  } catch (error) {
    console.error('❌ WaitingList model import failed:', error.message);
    results.failed.push(`WaitingList model: ${error.message}`);
  }

  // Test 4: VIPGuest Model
  console.log('\n4️⃣ Testing VIPGuest model import...');
  try {
    const VIPGuest = await import('../backend/src/models/VIPGuest.js');
    console.log('✅ VIPGuest model imported successfully');
    results.passed.push('VIPGuest model');
  } catch (error) {
    console.error('❌ VIPGuest model import failed:', error.message);
    results.failed.push(`VIPGuest model: ${error.message}`);
  }

  // Test 5: Booking Model (dependency)
  console.log('\n5️⃣ Testing Booking model import...');
  try {
    const Booking = await import('../backend/src/models/Booking.js');
    console.log('✅ Booking model imported successfully');
    results.passed.push('Booking model');
  } catch (error) {
    console.error('❌ Booking model import failed:', error.message);
    results.failed.push(`Booking model: ${error.message}`);
  }

  // Test 6: Room Model (dependency)
  console.log('\n6️⃣ Testing Room model import...');
  try {
    const Room = await import('../backend/src/models/Room.js');
    console.log('✅ Room model imported successfully');
    results.passed.push('Room model');
  } catch (error) {
    console.error('❌ Room model import failed:', error.message);
    results.failed.push(`Room model: ${error.message}`);
  }

  // Test 7: Auth Middleware
  console.log('\n7️⃣ Testing auth middleware import...');
  try {
    const auth = await import('../backend/src/middleware/auth.js');
    console.log('✅ Auth middleware imported successfully');
    results.passed.push('Auth middleware');
  } catch (error) {
    console.error('❌ Auth middleware import failed:', error.message);
    results.failed.push(`Auth middleware: ${error.message}`);
  }

  // Test 8: CatchAsync Utility
  console.log('\n8️⃣ Testing catchAsync utility import...');
  try {
    const catchAsync = await import('../backend/src/utils/catchAsync.js');
    console.log('✅ CatchAsync utility imported successfully');
    results.passed.push('CatchAsync utility');
  } catch (error) {
    console.error('❌ CatchAsync utility import failed:', error.message);
    results.failed.push(`CatchAsync utility: ${error.message}`);
  }

  // Test 9: Advanced Reservations Controller
  console.log('\n9️⃣ Testing advancedReservationsController import...');
  try {
    const controller = await import('../backend/src/controllers/advancedReservationsController.js');
    console.log('✅ AdvancedReservationsController imported successfully');
    results.passed.push('AdvancedReservationsController');
  } catch (error) {
    console.error('❌ AdvancedReservationsController import failed:', error.message);
    results.failed.push(`AdvancedReservationsController: ${error.message}`);
  }

  // Test 10: Advanced Reservations Routes
  console.log('\n🔟 Testing advancedReservations routes import...');
  try {
    const routes = await import('../backend/src/routes/advancedReservations.js');
    console.log('✅ AdvancedReservations routes imported successfully');
    results.passed.push('AdvancedReservations routes');
  } catch (error) {
    console.error('❌ AdvancedReservations routes import failed:', error.message);
    results.failed.push(`AdvancedReservations routes: ${error.message}`);
  }

  // Test 11: Test controller methods exist
  console.log('\n1️⃣1️⃣ Testing controller methods...');
  try {
    const controller = await import('../backend/src/controllers/advancedReservationsController.js');
    const controllerInstance = controller.default;

    const requiredMethods = [
      'getAdvancedReservationsStats',
      'getAdvancedReservations',
      'getAdvancedReservation',
      'createAdvancedReservation',
      'updateAdvancedReservation',
      'assignRoom',
      'addUpgrade',
      'addReservationFlag',
      'getAvailableBookings',
      'deleteAdvancedReservation'
    ];

    const missingMethods = [];
    requiredMethods.forEach(method => {
      if (typeof controllerInstance[method] !== 'function') {
        missingMethods.push(method);
      }
    });

    if (missingMethods.length === 0) {
      console.log('✅ All required controller methods exist');
      results.passed.push('Controller methods');
    } else {
      console.error('❌ Missing controller methods:', missingMethods);
      results.failed.push(`Controller methods: Missing ${missingMethods.join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Controller methods test failed:', error.message);
    results.failed.push(`Controller methods: ${error.message}`);
  }

  // Summary
  console.log('\n📊 TEST SUMMARY');
  console.log('================');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.passed.length > 0) {
    console.log('\n✅ PASSED TESTS:');
    results.passed.forEach(test => console.log(`  - ${test}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(test => console.log(`  - ${test}`));
  }

  if (results.failed.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The Advanced Reservations route should work.');
  } else {
    console.log('\n🚨 SOME TESTS FAILED! These need to be fixed before the route will work.');
  }

  return results;
}

// Run tests
testImports().catch(error => {
  console.error('🚨 Test runner failed:', error);
  process.exit(1);
});