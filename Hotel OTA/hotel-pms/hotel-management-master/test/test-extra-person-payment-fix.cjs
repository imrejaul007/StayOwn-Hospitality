const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/v1';

async function testExtraPersonPaymentFix() {
  try {
    console.log('🧪 Testing Extra Person Payment Status Fix...\\n');

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

    // Step 2: Add extra person if not already present
    if (!testBooking.extraPersons || testBooking.extraPersons.length === 0) {
      console.log('\\n2. Adding extra person...');
      const addPersonData = {
        name: 'Test Payment Fix Person',
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
      console.log('Extra person charges:');
      const extraPersonCharges = addResponse.data.data.booking.extraPersonCharges;
      extraPersonCharges.forEach(charge => {
        console.log(`  - Person: ${charge.personId}, Charge: ₹${charge.totalCharge}, Paid: ${charge.isPaid || false}`);
      });
    }

    // Step 3: Get updated booking details
    console.log('\\n3. Fetching updated booking details...');
    const updatedBookingResponse = await axios.get(`${API_BASE}/bookings/${testBooking._id}`);
    const updatedBooking = updatedBookingResponse.data.data;

    const extraPersonCharges = updatedBooking.extraPersonCharges || [];
    console.log('\\n📊 Current Extra Person Charges Status:');
    extraPersonCharges.forEach((charge, index) => {
      console.log(`  ${index + 1}. Person ID: ${charge.personId}`);
      console.log(`     Total Charge: ₹${charge.totalCharge}`);
      console.log(`     Paid Amount: ₹${charge.paidAmount || 0}`);
      console.log(`     Is Paid: ${charge.isPaid || false}`);
      console.log(`     Remaining: ₹${charge.totalCharge - (charge.paidAmount || 0)}`);
    });

    // Step 4: Test payment processing
    if (extraPersonCharges.length > 0) {
      console.log('\\n4. Testing payment processing...');

      const totalChargeAmount = extraPersonCharges.reduce((sum, charge) => sum + (charge.totalCharge - (charge.paidAmount || 0)), 0);

      if (totalChargeAmount > 0) {
        const paymentData = {
          paymentMethods: [{
            method: 'cash',
            amount: Math.min(1000, totalChargeAmount), // Pay partial or full amount
            reference: 'TEST-PAYMENT-001',
            notes: 'Test payment for extra person charges'
          }],
          extraPersonCharges: extraPersonCharges.map(charge => ({
            personId: charge.personId,
            amount: charge.totalCharge - (charge.paidAmount || 0),
            description: `Extra person charge for ${charge.personId}`
          })),
          totalAmount: Math.min(1000, totalChargeAmount)
        };

        const paymentResponse = await axios.post(
          `${API_BASE}/bookings/${testBooking._id}/extra-persons/payment`,
          paymentData,
          {
            headers: {
              'Authorization': `Bearer YOUR_TOKEN_HERE`, // Replace with actual token if needed
              'Content-Type': 'application/json'
            }
          }
        );

        console.log('✅ Payment processed successfully!');
        console.log('Payment Summary:', paymentResponse.data.data.paymentSummary);

        // Step 5: Verify payment status update
        console.log('\\n5. Verifying payment status update...');
        const finalBookingResponse = await axios.get(`${API_BASE}/bookings/${testBooking._id}`);
        const finalBooking = finalBookingResponse.data.data;

        console.log('\\n📋 Final Extra Person Charges Status:');
        finalBooking.extraPersonCharges.forEach((charge, index) => {
          console.log(`  ${index + 1}. Person ID: ${charge.personId}`);
          console.log(`     Total Charge: ₹${charge.totalCharge}`);
          console.log(`     Paid Amount: ₹${charge.paidAmount || 0}`);
          console.log(`     Is Paid: ${charge.isPaid || false}`);
          console.log(`     Remaining: ₹${charge.totalCharge - (charge.paidAmount || 0)}`);
          console.log(`     Paid At: ${charge.paidAt || 'Not set'}`);
        });

        // Check if the "Proceed Payment" button should show or hide
        const unpaidCharges = finalBooking.extraPersonCharges.filter(charge => !charge.isPaid);
        const totalUnpaid = unpaidCharges.reduce((sum, charge) => sum + (charge.totalCharge - (charge.paidAmount || 0)), 0);

        console.log('\\n🎯 Frontend Display Logic:');
        console.log(`Unpaid charges count: ${unpaidCharges.length}`);
        console.log(`Total unpaid amount: ₹${totalUnpaid}`);
        console.log(`Should show "Proceed Payment" button: ${unpaidCharges.length > 0 && totalUnpaid > 0 ? 'YES' : 'NO'}`);

        if (unpaidCharges.length === 0 || totalUnpaid <= 0) {
          console.log('\\n🎉 SUCCESS! Payment fix is working correctly - no unpaid charges remaining.');
        } else {
          console.log('\\n⚠️  Some charges are still unpaid. This is expected for partial payments.');
        }

      } else {
        console.log('\\n✅ All extra person charges are already paid!');
      }
    } else {
      console.log('\\n📝 No extra person charges found for this booking.');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);

    if (error.response?.status === 401) {
      console.log('\\n💡 Note: You may need to add proper authentication headers for this test to work fully.');
    }
  }
}

testExtraPersonPaymentFix();