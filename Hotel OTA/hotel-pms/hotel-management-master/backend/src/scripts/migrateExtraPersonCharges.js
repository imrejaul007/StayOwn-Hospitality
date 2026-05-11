/**
 * Migration Script: Add Manual Approval Workflow Fields to Extra Person Charges
 *
 * Purpose: Updates existing extra person charges to support the new manual approval workflow
 *
 * Changes Applied:
 * - Adds `status: 'pending'` to charges without a status field
 * - Sets `calculatedAmount` to the existing `totalCharge` value
 * - Preserves all existing data
 *
 * Safe to run multiple times (idempotent)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hotel-management';

const migrateExtraPersonCharges = async () => {
  console.log('🔄 Starting Extra Person Charges Migration...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const bookingsCollection = db.collection('bookings');

    // Step 1: Find all bookings with extra person charges that need migration
    console.log('🔍 Step 1: Finding bookings with extra person charges...');
    const bookingsWithCharges = await bookingsCollection.find({
      'extraPersonCharges.0': { $exists: true } // Has at least one extra person charge
    }).toArray().lean().limit(1000);

    console.log(`📊 Found ${bookingsWithCharges.length} bookings with extra person charges\n`);

    if (bookingsWithCharges.length === 0) {
      console.log('✅ No bookings to migrate. All done!\n');
      return;
    }

    // Step 2: Analyze charges that need migration
    let totalCharges = 0;
    let chargesToMigrate = 0;
    let alreadyMigrated = 0;

    bookingsWithCharges.forEach(booking => {
      booking.extraPersonCharges.forEach(charge => {
        totalCharges++;
        if (!charge.status) {
          chargesToMigrate++;
        } else {
          alreadyMigrated++;
        }
      });
    });

    console.log('📈 Migration Analysis:');
    console.log(`   Total extra person charges: ${totalCharges}`);
    console.log(`   Charges needing migration: ${chargesToMigrate}`);
    console.log(`   Already migrated: ${alreadyMigrated}\n`);

    if (chargesToMigrate === 0) {
      console.log('✅ All charges already have the new fields. No migration needed!\n');
      return;
    }

    // Step 3: Perform migration
    console.log('🔧 Step 2: Migrating charges...');
    console.log('   Adding fields: status, calculatedAmount\n');

    let migratedBookings = 0;
    let migratedCharges = 0;
    let errors = [];

    for (const booking of bookingsWithCharges) {
      try {
        let bookingModified = false;
        const updatedCharges = booking.extraPersonCharges.map(charge => {
          // Only migrate charges that don't have status field
          if (!charge.status) {
            bookingModified = true;
            migratedCharges++;

            return {
              ...charge,
              status: 'pending', // Default to pending for existing charges
              calculatedAmount: charge.totalCharge || 0, // Use existing totalCharge
              // Don't add adjustedAmount, adjustmentReason, etc. unless already present
            };
          }
          return charge;
        });

        if (bookingModified) {
          // Update the booking with migrated charges
          await bookingsCollection.updateOne(
            { _id: booking._id },
            { $set: { extraPersonCharges: updatedCharges } }
          );
          migratedBookings++;

          console.log(`   ✅ Booking ${booking._id}: Migrated ${updatedCharges.filter(c => c.status === 'pending').length} charge(s)`);
        }
      } catch (error) {
        errors.push({
          bookingId: booking._id,
          error: error.message
        });
        console.error(`   ❌ Error migrating booking ${booking._id}: ${error.message}`);
      }
    }

    console.log('\n📊 Migration Results:');
    console.log(`   ✅ Bookings updated: ${migratedBookings}`);
    console.log(`   ✅ Charges migrated: ${migratedCharges}`);
    if (errors.length > 0) {
      console.log(`   ❌ Errors encountered: ${errors.length}`);
      errors.forEach(err => {
        console.log(`      - Booking ${err.bookingId}: ${err.error}`);
      });
    }

    // Step 4: Verification
    console.log('\n🔍 Step 3: Verifying migration...');
    const verification = await bookingsCollection.find({
      'extraPersonCharges.0': { $exists: true },
      'extraPersonCharges.status': { $exists: false }
    }).toArray().lean().limit(1000);

    if (verification.length === 0) {
      console.log('✅ Verification PASSED: All charges now have required fields\n');
    } else {
      console.log(`⚠️  Verification WARNING: ${verification.length} booking(s) still have charges without status field\n`);
    }

    // Step 5: Show sample migrated data
    console.log('📋 Sample Migrated Data:');
    const sample = await bookingsCollection.findOne({
      'extraPersonCharges.0': { $exists: true }
    }).lean();

    if (sample && sample.extraPersonCharges && sample.extraPersonCharges.length > 0) {
      const sampleCharge = sample.extraPersonCharges[0];
      console.log('   Booking ID:', sample._id);
      console.log('   Sample Charge:');
      console.log('   - Person Name:', sampleCharge.personName);
      console.log('   - Status:', sampleCharge.status || 'NOT SET');
      console.log('   - Calculated Amount:', sampleCharge.calculatedAmount || 'NOT SET');
      console.log('   - Total Charge:', sampleCharge.totalCharge);
      console.log('   - Adjusted Amount:', sampleCharge.adjustedAmount || 'Not adjusted yet');
    }

    console.log('\n✅ Migration completed successfully!\n');
    console.log('📌 Next Steps:');
    console.log('   1. Restart backend server to apply changes');
    console.log('   2. Test editing prices for previously existing extra persons');
    console.log('   3. Verify payment calculations are correct\n');

  } catch (error) {
    console.error('\n❌ Migration failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run migration
console.log('═══════════════════════════════════════════════════════════════');
console.log('  EXTRA PERSON CHARGES MIGRATION - Manual Approval Workflow');
console.log('═══════════════════════════════════════════════════════════════\n');

migrateExtraPersonCharges()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Migration Process Completed');
    console.log('═══════════════════════════════════════════════════════════════\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
