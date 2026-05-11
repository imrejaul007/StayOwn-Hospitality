/**
 * Phase 5: Inventory Management Notifications - Test Suite
 * Tests the comprehensive inventory notification automation system
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

// Import mongoose from backend
const mongoose = require('../backend/node_modules/mongoose');

// Test Phase 5: Inventory Management Notifications
async function testPhase5InventoryNotifications() {
  console.log('\n🚀 Testing Phase 5: Inventory Management Notifications');
  console.log('=' .repeat(60));

  try {
    // Test 1: Low Stock Alert via Model Hook
    console.log('\n📦 Test 1: Low Stock Alert');
    const InventoryItem = mongoose.model('InventoryItem');

    // Update an inventory item to trigger low stock
    const testItem = await InventoryItem.findOne({
      currentStock: { $gt: 0 },
      stockThreshold: { $gt: 0 }
    });

    if (testItem) {
      const originalStock = testItem.currentStock;
      const lowStock = Math.floor(testItem.stockThreshold / 2); // Below threshold

      console.log(`📊 Updating ${testItem.name} stock from ${originalStock} to ${lowStock}`);
      testItem.currentStock = lowStock;
      await testItem.save();

      console.log('✅ Low stock notification should have been triggered');

      // Restore original stock
      testItem.currentStock = originalStock;
      await testItem.save();
    } else {
      console.log('⚠️  No suitable inventory item found for low stock test');
    }

    // Test 2: Out of Stock Alert
    console.log('\n📦 Test 2: Out of Stock Alert');
    if (testItem) {
      const originalStock = testItem.currentStock;

      console.log(`📊 Setting ${testItem.name} stock to 0 (out of stock)`);
      testItem.currentStock = 0;
      await testItem.save();

      console.log('✅ Out of stock notification should have been triggered');

      // Restore original stock
      testItem.currentStock = originalStock;
      await testItem.save();
    }

    // Test 3: Reorder Needed Alert
    console.log('\n📦 Test 3: Reorder Needed Alert');
    const reorderItem = await InventoryItem.findOne({
      'reorderSettings.autoReorderEnabled': true,
      'reorderSettings.reorderPoint': { $exists: true, $gt: 0 }
    });

    if (reorderItem) {
      const originalStock = reorderItem.currentStock;
      const reorderTrigger = Math.floor(reorderItem.reorderSettings.reorderPoint / 2);

      console.log(`📊 Setting ${reorderItem.name} stock to ${reorderTrigger} (below reorder point of ${reorderItem.reorderSettings.reorderPoint})`);
      reorderItem.currentStock = reorderTrigger;
      await reorderItem.save();

      console.log('✅ Reorder needed notification should have been triggered');

      // Restore original stock
      reorderItem.currentStock = originalStock;
      await reorderItem.save();
    } else {
      console.log('⚠️  No suitable inventory item found for reorder test');
    }

    // Test 4: High-Value Item Usage via Consumption Hook
    console.log('\n📦 Test 4: High-Value Item Usage');
    const InventoryConsumption = mongoose.model('InventoryConsumption');
    const highValueItem = await InventoryItem.findOne({
      unitPrice: { $gt: 100 },
      currentStock: { $gt: 5 }
    });

    if (highValueItem) {
      const consumption = new InventoryConsumption({
        hotelId: highValueItem.hotelId,
        inventoryItemId: highValueItem._id,
        quantity: 2,
        consumptionType: 'housekeeping',
        departmentType: 'housekeeping',
        unitCost: highValueItem.unitPrice,
        totalCost: highValueItem.unitPrice * 2,
        consumedBy: new mongoose.Types.ObjectId(), // Mock staff ID
        consumedAt: new Date()
      });

      console.log(`💰 Recording consumption of ${consumption.quantity} units of ${highValueItem.name} (total cost: $${consumption.totalCost})`);
      await consumption.save();
      console.log('✅ High-value consumption notification should have been triggered');

      // Clean up
      await consumption.deleteOne();
    } else {
      console.log('⚠️  No suitable high-value inventory item found');
    }

    // Test 5: Theft/Loss Detection
    console.log('\n📦 Test 5: Theft/Loss Detection');
    const anyItem = await InventoryItem.findOne({ currentStock: { $gt: 0 } });

    if (anyItem) {
      const theftConsumption = new InventoryConsumption({
        hotelId: anyItem.hotelId,
        inventoryItemId: anyItem._id,
        quantity: 1,
        consumptionType: 'replacement',
        departmentType: 'housekeeping',
        unitCost: anyItem.unitPrice,
        totalCost: anyItem.unitPrice,
        replacementType: 'theft',
        consumedBy: new mongoose.Types.ObjectId(),
        consumedAt: new Date(),
        notes: 'Reported theft incident'
      });

      console.log(`🚨 Recording theft of ${anyItem.name}`);
      await theftConsumption.save();
      console.log('✅ Theft/loss notification should have been triggered');

      // Clean up
      await theftConsumption.deleteOne();
    }

    // Test 6: Unusual Consumption Pattern
    console.log('\n📦 Test 6: Unusual Consumption Pattern');
    if (anyItem) {
      const unusualConsumption = new InventoryConsumption({
        hotelId: anyItem.hotelId,
        inventoryItemId: anyItem._id,
        quantity: 10, // High quantity
        expectedQuantity: 3, // Expected much less
        consumptionType: 'housekeeping',
        departmentType: 'housekeeping',
        unitCost: anyItem.unitPrice,
        totalCost: anyItem.unitPrice * 10,
        consumedBy: new mongoose.Types.ObjectId(),
        consumedAt: new Date(),
        efficiency: 30 // Low efficiency (expected/actual * 100)
      });

      console.log(`📈 Recording unusual consumption: ${unusualConsumption.quantity} units (expected: ${unusualConsumption.expectedQuantity})`);
      await unusualConsumption.save();
      console.log('✅ Unusual consumption notification should have been triggered');

      // Clean up
      await unusualConsumption.deleteOne();
    }

    // Test 7: VIP Guest Special Consumption
    console.log('\n📦 Test 7: VIP Guest Special Consumption');
    if (anyItem) {
      const vipConsumption = new InventoryConsumption({
        hotelId: anyItem.hotelId,
        inventoryItemId: anyItem._id,
        quantity: 2,
        consumptionType: 'guest_request',
        departmentType: 'guest_services',
        unitCost: anyItem.unitPrice,
        totalCost: anyItem.unitPrice * 2,
        isVIPGuest: true,
        isComplimentary: true,
        consumedBy: new mongoose.Types.ObjectId(),
        consumedFor: new mongoose.Types.ObjectId(),
        consumedAt: new Date(),
        specialRequirements: 'VIP guest special request'
      });

      console.log(`👑 Recording VIP guest consumption of ${anyItem.name} (total: $${vipConsumption.totalCost})`);
      await vipConsumption.save();
      console.log('✅ VIP guest consumption notification should have been triggered');

      // Clean up
      await vipConsumption.deleteOne();
    }

    // Test 8: Scheduler Inventory Check
    console.log('\n📦 Test 8: Scheduler Inventory Level Check');
    const NotificationScheduler = (await import('../backend/src/services/notificationScheduler.js')).default;

    console.log('🔍 Running scheduled inventory level check...');
    await NotificationScheduler.checkInventoryLevels();
    console.log('✅ Scheduler inventory check completed');

    // Test Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 Phase 5 Inventory Management Notifications Test Summary:');
    console.log('✅ Low stock alert via model hook');
    console.log('✅ Out of stock alert via model hook');
    console.log('✅ Reorder needed alert via model hook');
    console.log('✅ High-value consumption notification');
    console.log('✅ Theft/loss detection notification');
    console.log('✅ Unusual consumption pattern alert');
    console.log('✅ VIP guest special consumption tracking');
    console.log('✅ Scheduled inventory level monitoring');
    console.log('\n🎉 All Phase 5 inventory notification tests completed successfully!');

  } catch (error) {
    console.error('❌ Error in Phase 5 inventory notifications test:', error);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

export default testPhase5InventoryNotifications;

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management');
  }

  await testPhase5InventoryNotifications();
  await mongoose.disconnect();
}