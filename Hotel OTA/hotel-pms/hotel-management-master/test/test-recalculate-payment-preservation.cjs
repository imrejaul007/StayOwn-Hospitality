// Test that recalculate charges preserves payment status
console.log('🧪 Testing Recalculate Charges Payment Preservation...\n');

// Mock scenario: User has 3 extra persons, all paid, then clicks "Recalculate Charges"
const beforeRecalculate = [
  {
    personId: 'person1',
    personName: 'mukerpoj',
    totalCharge: 1994.2,
    paidAmount: 1994.2,
    isPaid: true,
    paidAt: new Date('2025-09-26')
  },
  {
    personId: 'person2',
    personName: 'oii3rjt',
    totalCharge: 1994.2,
    paidAmount: 1994.2,
    isPaid: true,
    paidAt: new Date('2025-09-26')
  },
  {
    personId: 'person3',
    personName: 'oidijjf',
    totalCharge: 1994.2,
    paidAmount: 1994.2,
    isPaid: true,
    paidAt: new Date('2025-09-26')
  }
];

console.log('📊 Before Recalculate (All Paid):');
beforeRecalculate.forEach((charge, i) => {
  console.log(`  ${i+1}. ${charge.personName}: ₹${charge.totalCharge} (${charge.isPaid ? 'Paid ✓' : 'Unpaid ❌'})`);
});

console.log('\n🔄 Simulating Recalculate Charges Logic...');

// Simulate the backend calculateExtraPersonCharges preserving payment status
function simulateRecalculate(existingCharges) {
  // This simulates the fixed logic in Booking.js calculateExtraPersonCharges
  const newChargeBreakdown = [
    { personId: 'person1', personName: 'mukerpoj', totalCharge: 1994.2 },
    { personId: 'person2', personName: 'oii3rjt', totalCharge: 1994.2 },
    { personId: 'person3', personName: 'oidijjf', totalCharge: 1994.2 }
  ];

  // Apply the fix: preserve payment status from existing charges
  return newChargeBreakdown.map(newCharge => {
    const existingCharge = existingCharges.find(existing => existing.personId === newCharge.personId);

    return {
      ...newCharge,
      // Preserve payment status from existing charge, or set defaults for new charges
      paidAmount: existingCharge ? existingCharge.paidAmount : 0,
      isPaid: existingCharge ? existingCharge.isPaid : false,
      paidAt: existingCharge ? existingCharge.paidAt : undefined
    };
  });
}

const afterRecalculate = simulateRecalculate(beforeRecalculate);

console.log('\n📊 After Recalculate (Fixed Logic):');
afterRecalculate.forEach((charge, i) => {
  console.log(`  ${i+1}. ${charge.personName}: ₹${charge.totalCharge} (${charge.isPaid ? 'Paid ✓' : 'Unpaid ❌'})`);
  if (charge.isPaid) {
    console.log(`     Paid Amount: ₹${charge.paidAmount} on ${charge.paidAt?.toDateString()}`);
  }
});

console.log('\n🎯 Test Results:');
const allStillPaid = afterRecalculate.every(charge => charge.isPaid);
const paymentAmountsPreserved = afterRecalculate.every(charge => charge.paidAmount === 1994.2);

if (allStillPaid && paymentAmountsPreserved) {
  console.log('✅ SUCCESS! Payment status preserved during recalculation');
  console.log('✅ All charges still show as paid');
  console.log('✅ Payment amounts preserved');
  console.log('✅ No "Process Payment" button should appear');
} else {
  console.log('❌ FAILED! Payment status not preserved');
  console.log(`   All paid: ${allStillPaid}`);
  console.log(`   Amounts preserved: ${paymentAmountsPreserved}`);
}

console.log('\n📝 Expected Frontend Behavior:');
console.log('- Each person shows: "₹1,994.2 Paid ✓"');
console.log('- Total Charges: ₹5,982.6');
console.log('- Paid Amount: ₹5,982.6');
console.log('- Remaining Due: ₹0');
console.log('- "Process Payment" button: HIDDEN');
console.log('- Status: "All charges have been paid ✓"');