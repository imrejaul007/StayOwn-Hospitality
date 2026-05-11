const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/v1';

async function testMultiPaymentExtraPerson() {
  try {
    console.log('🧪 Testing Multi-Payment Extra Person System...\n');

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

    // Step 2: Add extra person
    console.log('\n2. Adding extra person...');
    const addPersonData = {
      name: 'Test Multi-Payment Person',
      type: 'adult',
      age: 30,
      autoCalculateCharges: true
    };

    const addResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons`,
      addPersonData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`, // Replace with actual token if needed
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Extra person added successfully!');
    const extraPersonCharges = addResponse.data.data.booking.extraPersonCharges;
    console.log('Extra person charges:', extraPersonCharges.map(c => ({
      personId: c.personId,
      totalCharge: c.totalCharge,
      description: c.description
    })));

    // Step 3: Test multi-payment processing
    console.log('\n3. Testing multi-payment processing...');

    const totalChargeAmount = extraPersonCharges.reduce((sum, charge) => sum + charge.totalCharge, 0);

    const multiPaymentData = {
      paymentMethods: [
        {
          method: 'cash',
          amount: Math.floor(totalChargeAmount * 0.6), // 60% cash
          reference: 'CASH-TEST-001',
          notes: 'Cash payment for extra person'
        },
        {
          method: 'upi',
          amount: Math.ceil(totalChargeAmount * 0.4), // 40% UPI
          reference: 'UPI-TEST-123456789',
          notes: 'UPI payment via PhonePe'
        }
      ],
      extraPersonCharges: extraPersonCharges.map(charge => ({
        personId: charge.personId,
        amount: charge.totalCharge,
        description: charge.description
      })),
      totalAmount: totalChargeAmount
    };

    const paymentResponse = await axios.post(
      `${API_BASE}/bookings/${testBooking._id}/extra-persons/payment`,
      multiPaymentData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`, // Replace with actual token if needed
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Multi-payment processed successfully!');
    console.log('\n📊 Payment Summary:');
    console.log('- Total Charge Amount:', totalChargeAmount);
    console.log('- Payment Methods Used:');
    multiPaymentData.paymentMethods.forEach(payment => {
      console.log(`  • ${payment.method.toUpperCase()}: ₹${payment.amount} (Ref: ${payment.reference})`);
    });

    const paymentSummary = paymentResponse.data.data.paymentSummary;
    console.log('\n📋 Backend Response:');
    console.log('- Total Paid:', paymentSummary.totalPaid);
    console.log('- Updated Booking Total:', paymentSummary.updatedBookingTotal);
    console.log('- Updated Total Paid:', paymentSummary.updatedTotalPaid);
    console.log('- Remaining Amount:', paymentSummary.remainingAmount);
    console.log('- Payment Status:', paymentSummary.paymentStatus);

    console.log('\n🎉 Multi-payment system test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\n💡 Note: You may need to add proper authentication headers for this test to work fully.');
      console.log('💡 The frontend should work with proper authentication.');
    }
  }
}

testMultiPaymentExtraPerson();