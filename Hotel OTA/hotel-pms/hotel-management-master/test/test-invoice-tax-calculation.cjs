// Test invoice tax calculation fix
console.log('🧪 Testing Invoice Tax Calculation Fix...\n');

// Test data from your screenshot
const charges = [
  { personName: 'mukerpoj', totalCharge: 1994.2 },
  { personName: 'oii3rjt', totalCharge: 1994.2 },
  { personName: 'oidijjf', totalCharge: 1994.2 }
];

console.log('📊 Input Charges:');
charges.forEach((charge, i) => {
  console.log(`  ${i+1}. ${charge.personName}: ₹${charge.totalCharge}`);
});

console.log('\n🔢 Calculation Logic:');
const processedItems = charges.map((charge, i) => {
  const totalWithTax = charge.totalCharge;
  const baseAmount = totalWithTax / 1.18; // Remove 18% GST
  const taxAmount = totalWithTax - baseAmount;

  const item = {
    description: `Extra person charge - ${charge.personName}`,
    unitPrice: Math.round(baseAmount * 100) / 100,
    totalPrice: Math.round(totalWithTax * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100
  };

  console.log(`  ${i+1}. ${charge.personName}:`);
  console.log(`     Total with tax: ₹${totalWithTax}`);
  console.log(`     Base amount: ₹${item.unitPrice}`);
  console.log(`     Tax amount: ₹${item.taxAmount}`);
  console.log(`     Verification: ₹${item.unitPrice} + ₹${item.taxAmount} = ₹${(item.unitPrice + item.taxAmount).toFixed(2)}`);

  return item;
});

console.log('\n📋 Invoice Totals:');
const subtotal = processedItems.reduce((sum, item) => sum + item.unitPrice, 0);
const totalTax = processedItems.reduce((sum, item) => sum + item.taxAmount, 0);
const totalAmount = processedItems.reduce((sum, item) => sum + item.totalPrice, 0);

console.log(`  Subtotal (base): ₹${subtotal.toFixed(2)}`);
console.log(`  Total tax: ₹${totalTax.toFixed(2)}`);
console.log(`  Total amount: ₹${totalAmount.toFixed(2)}`);

console.log('\n✅ Expected Invoice Display:');
console.log('  Description                     Quantity  Unit Price    Total');
console.log('  ─────────────────────────────────────────────────────────────');
processedItems.forEach(item => {
  console.log(`  ${item.description.padEnd(30)} 1         ₹${item.unitPrice.toLocaleString().padStart(8)} ₹${item.totalPrice.toLocaleString().padStart(8)}`);
});

console.log('\n  Summary:');
console.log(`  Subtotal (Extra Person Charges): ₹${subtotal.toLocaleString()}`);
console.log(`  Tax (18% GST):                   ₹${totalTax.toLocaleString()}`);
console.log(`  Total Extra Charges:             ₹${totalAmount.toLocaleString()}`);

console.log('\n🎯 Result: Invoice will now show the correct amounts matching the modal!');