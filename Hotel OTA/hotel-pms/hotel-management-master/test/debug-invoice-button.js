// Simple test to debug the invoice generation issue
// Open browser console and paste this code to test the API directly

async function testInvoiceGeneration() {
  try {
    console.log('🧪 Testing invoice generation API directly...');

    // Get auth token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ No auth token found. Please log in first.');
      return;
    }

    // Example data - replace with actual booking ID and charges
    const testData = {
      bookingId: "REPLACE_WITH_ACTUAL_BOOKING_ID", // Get from URL or booking modal
      extraPersonCharges: [
        {
          personId: "test-person-1",
          personName: "Test Person",
          description: "Extra adult charge for Test Person",
          baseCharge: 1400,
          totalCharge: 2147.6,
          addedAt: new Date().toISOString()
        }
      ]
    };

    console.log('📤 Sending request with data:', testData);

    const response = await fetch('/api/v1/invoices/supplementary/extra-person-charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testData)
    });

    console.log('📥 Response status:', response.status);

    const result = await response.json();
    console.log('📄 Response data:', result);

    if (response.ok) {
      console.log('✅ API call successful!');
      console.log('📋 Invoice created:', result.data);
    } else {
      console.log('❌ API call failed:', result.error);
    }

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

console.log('To test invoice generation:');
console.log('1. Replace REPLACE_WITH_ACTUAL_BOOKING_ID with a real booking ID');
console.log('2. Run: testInvoiceGeneration()');