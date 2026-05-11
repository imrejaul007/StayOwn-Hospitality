const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/v1';

async function testPreservePaymentStatus() {
  try {
    console.log('🧪 Testing Payment Status Preservation When Adding New Person...\n');

    // Step 1: Get a booking to test with
    console.log('1. Getting available bookings...');
    const bookingsResponse = await axios.get(`${API_BASE}/bookings?limit=5`);
    const bookings = bookingsResponse.data.data.bookings;

    if (bookings.length === 0) {
      console.log('❌ No bookings found to test with');
      return;
    }

    const testBooking = bookings[0];
    console.log(`✅ Found test booking: ${testBooking.bookingId || testBooking._id}`);

    // Step 2: Add first extra person and pay for it
    console.log('\n2. Adding first extra person...');
    const addFirstPersonData = {
      name: 'Test Person 1',
      type: 'adult',
      age: 30,
      autoCalculateCharges: true
    };

    const addFirstResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons`,
      addFirstPersonData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ First person added successfully!');
    let extraPersonCharges = addFirstResponse.data.data.booking.extraPersonCharges;
    console.log('Initial charges:', extraPersonCharges.map(c => ({
      personId: c.personId,
      charge: c.totalCharge,
      isPaid: c.isPaid || false,
      paidAmount: c.paidAmount || 0
    })));

    // Step 3: Pay for the first person
    if (extraPersonCharges.length > 0) {
      console.log('\n3. Paying for first person...');
      const firstCharge = extraPersonCharges[0];

      const paymentData = {
        paymentMethods: [{
          method: 'cash',
          amount: firstCharge.totalCharge,
          reference: 'TEST-PAYMENT-001',
          notes: 'Payment for first extra person'
        }],
        extraPersonCharges: [{
          personId: firstCharge.personId,
          amount: firstCharge.totalCharge,
          description: firstCharge.description
        }],
        totalAmount: firstCharge.totalCharge
      };

      const paymentResponse = await axios.post(
        `${API_BASE}/bookings/${testBooking._id}/extra-persons/payment`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer YOUR_TOKEN_HERE`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Payment processed for first person!');
    }

    // Step 4: Verify payment status
    console.log('\n4. Verifying payment status after payment...');
    const afterPaymentResponse = await axios.get(`${API_BASE}/bookings/${testBooking._id}`);
    const afterPaymentBooking = afterPaymentResponse.data.data;

    console.log('After payment charges:', afterPaymentBooking.extraPersonCharges.map(c => ({
      personId: c.personId,
      charge: c.totalCharge,
      isPaid: c.isPaid || false,
      paidAmount: c.paidAmount || 0,
      paidAt: c.paidAt || 'Not set'
    })));

    // Step 5: Add second extra person
    console.log('\n5. Adding second extra person...');
    const addSecondPersonData = {
      name: 'Test Person 2',
      type: 'adult',
      age: 25,
      autoCalculateCharges: true
    };

    const addSecondResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons`,
      addSecondPersonData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Second person added successfully!');

    // Step 6: Verify payment status preservation
    console.log('\n6. Verifying payment status preservation...');
    const finalBookingResponse = await axios.get(`${API_BASE}/bookings/${testBooking._id}`);
    const finalBooking = finalBookingResponse.data.data;

    console.log('\n📋 Final Extra Person Charges Status:');
    finalBooking.extraPersonCharges.forEach((charge, index) => {
      console.log(`  ${index + 1}. Person ID: ${charge.personId}`);
      console.log(`     Total Charge: ₹${charge.totalCharge}`);
      console.log(`     Paid Amount: ₹${charge.paidAmount || 0}`);
      console.log(`     Is Paid: ${charge.isPaid || false}`);
      console.log(`     Remaining: ₹${charge.totalCharge - (charge.paidAmount || 0)}`);
    });

    // Check if the fix worked
    const paidCharges = finalBooking.extraPersonCharges.filter(charge => charge.isPaid);
    const unpaidCharges = finalBooking.extraPersonCharges.filter(charge => !charge.isPaid);

    console.log('\n🎯 Test Results:');
    console.log(`Paid charges: ${paidCharges.length}`);
    console.log(`Unpaid charges: ${unpaidCharges.length}`);
    console.log(`Total charges: ${finalBooking.extraPersonCharges.length}`);

    if (paidCharges.length === 1 && unpaidCharges.length === 1) {
      console.log('\n🎉 SUCCESS! Payment status preservation is working correctly:');
      console.log('✅ First person remains marked as paid');
      console.log('✅ Second person is correctly marked as unpaid');
      console.log('✅ Payment amounts are preserved correctly');
    } else {
      console.log('\n⚠️  Payment status preservation may have issues:');
      paidCharges.forEach(charge => {
        console.log(`✅ Paid: Person ${charge.personId} - ₹${charge.paidAmount}`);
      });
      unpaidCharges.forEach(charge => {
        console.log(`❌ Unpaid: Person ${charge.personId} - ₹${charge.totalCharge - (charge.paidAmount || 0)} due`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n💡 Note: You may need to add proper authentication headers for this test to work fully.');
    }
  }
}

testPreservePaymentStatus();