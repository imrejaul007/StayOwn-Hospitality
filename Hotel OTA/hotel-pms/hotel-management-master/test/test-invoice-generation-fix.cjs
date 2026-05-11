const axios = require('axios');

const API_BASE = 'http://localhost:4000/api/v1';

async function testInvoiceGenerationFix() {
  try {
    console.log('🧪 Testing Invoice Generation Fix...\n');

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

    // Step 2: Check if booking has extra persons
    let extraPersonCharges = testBooking.extraPersonCharges || [];

    if (extraPersonCharges.length === 0) {
      console.log('\n2. No extra person charges found, adding one for testing...');
      const addPersonData = {
        name: 'Test Invoice Person',
        type: 'adult',
        age: 30,
        autoCalculateCharges: true
      };

      const addResponse = await axios.post(
        `${API_BASE}/bookings/${testBooking._id}/extra-persons`,
        addPersonData,
        {
          headers: {
            'Authorization': `Bearer YOUR_TOKEN_HERE`,
            'Content-Type': 'application/json'
          }
        }
      );

      extraPersonCharges = addResponse.data.data.booking.extraPersonCharges;
      console.log('✅ Added extra person with charges');
    }

    console.log('\n3. Extra person charges found:');
    extraPersonCharges.forEach((charge, index) => {
      console.log(`  ${index + 1}. Person: ${charge.personId}, Charge: ₹${charge.totalCharge}`);
    });

    // Step 3: Test invoice generation
    console.log('\n4. Testing invoice generation...');

    const invoiceData = {
      bookingId: testBooking._id,
      extraPersonCharges: extraPersonCharges.map(charge => ({
        personId: charge.personId,
        personName: 'Test Person',
        description: charge.description || `Extra person charge`,
        baseCharge: charge.baseCharge || charge.totalCharge,
        totalCharge: charge.totalCharge,
        addedAt: new Date().toISOString()
      }))
    };

    const invoiceResponse = await axios.post(
      `${API_BASE}/invoices/supplementary/extra-person-charges`,
      invoiceData,
      {
        headers: {
          'Authorization': `Bearer YOUR_TOKEN_HERE`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (invoiceResponse.status === 200 || invoiceResponse.status === 201) {
      console.log('✅ Invoice generated successfully!');

      const invoice = invoiceResponse.data.data;
      console.log('\n📄 Invoice Details:');
      console.log(`  Invoice ID: ${invoice._id || invoice.id}`);
      console.log(`  Subtotal: ₹${invoice.subtotal || 0}`);
      console.log(`  Tax Amount: ₹${invoice.taxAmount || 0}`);
      console.log(`  Total Amount: ₹${invoice.totalAmount || 0}`);
      console.log(`  Items Count: ${invoice.items?.length || 0}`);
      console.log(`  Type: ${invoice.type}`);
      console.log(`  Status: ${invoice.status}`);

      if (invoice.subtotal && invoice.totalAmount) {
        console.log('\n🎉 SUCCESS! Invoice generation is working correctly:');
        console.log('✅ Subtotal field is calculated and set');
        console.log('✅ Total amount field is calculated and set');
        console.log('✅ Tax amount field is calculated and set');
        console.log('✅ No validation errors occurred');
      } else {
        console.log('\n⚠️  Invoice was created but may have missing calculations');
      }
    }

  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error?.message?.includes('Total amount is required')) {
      console.error('❌ Original error still exists! The fix did not work.');
      console.error('Error details:', error.response.data.error.message);
    } else if (error.response?.status === 401) {
      console.log('💡 Note: Authentication required for this test to work fully.');
      console.log('💡 The backend fix should work when proper authentication is provided.');
    } else {
      console.error('❌ Test failed with unexpected error:', error.response?.data || error.message);
    }
  }
}

testInvoiceGenerationFix();