import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Migration Script: Fix Payment Data Structure
 *
 * This script migrates bookings from the old payment structure to the new one:
 *
 * OLD STRUCTURE (INCORRECT):
 * - booking.totalPaid
 * - booking.paymentMethods
 * - booking.remainingAmount
 *
 * NEW STRUCTURE (CORRECT):
 * - booking.paymentDetails.totalPaid
 * - booking.paymentDetails.paymentMethods
 * - booking.paymentDetails.remainingAmount
 */

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

console.log('\n🔄 Payment Data Migration Script');
console.log('='.repeat(60));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '✍️  LIVE MODE (will modify database)'}`);
console.log(`Verbose: ${VERBOSE ? 'ON' : 'OFF'}`);
console.log('='.repeat(60) + '\n');

async function migratePaymentData() {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get Booking collection directly
    const Booking = mongoose.connection.collection('bookings');

    // Find bookings with old payment structure
    console.log('🔍 Searching for bookings with old payment structure...\n');

    const bookingsWithOldStructure = await Booking.find({
      $or: [
        { totalPaid: { $exists: true } },
        { paymentMethods: { $exists: true } },
        { remainingAmount: { $exists: true } }
      ]
    }).toArray().lean().limit(1000);

    console.log(`📊 Found ${bookingsWithOldStructure.length} bookings to migrate\n`);

    if (bookingsWithOldStructure.length === 0) {
      console.log('✅ No bookings need migration. All data is up to date!\n');
      await mongoose.disconnect();
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const booking of bookingsWithOldStructure) {
      try {
        const updates = {};
        const unsets = {};
        let needsMigration = false;

        // Check if migration is needed
        const hasTotalPaid = booking.totalPaid !== undefined;
        const hasPaymentMethods = booking.paymentMethods && Array.isArray(booking.paymentMethods);
        const hasRemainingAmount = booking.remainingAmount !== undefined;
        const hasPaymentHistory = booking.paymentHistory && Array.isArray(booking.paymentHistory);

        if (VERBOSE) {
          console.log(`\n📝 Booking ${booking.bookingNumber || booking._id}:`);
          console.log(`   - totalPaid: ${hasTotalPaid ? booking.totalPaid : 'N/A'}`);
          console.log(`   - paymentMethods: ${hasPaymentMethods ? booking.paymentMethods.length + ' methods' : 'N/A'}`);
          console.log(`   - remainingAmount: ${hasRemainingAmount ? booking.remainingAmount : 'N/A'}`);
          console.log(`   - paymentHistory: ${hasPaymentHistory ? booking.paymentHistory.length + ' entries' : 'N/A'}`);
          console.log(`   - paymentStatus: ${booking.paymentStatus}`);
          console.log(`   - totalAmount: ${booking.totalAmount}`);
        }

        // Initialize paymentDetails if it doesn't exist
        if (!booking.paymentDetails) {
          needsMigration = true;
          updates['paymentDetails'] = {
            paymentMethods: [],
            totalPaid: 0,
            remainingAmount: booking.totalAmount || 0,
            collectedAt: new Date(),
            collectedBy: null
          };
        } else {
          updates['paymentDetails'] = { ...booking.paymentDetails };
        }

        // Migrate totalPaid
        if (hasTotalPaid) {
          needsMigration = true;
          updates['paymentDetails.totalPaid'] = booking.totalPaid;
          unsets['totalPaid'] = '';
          if (VERBOSE) console.log(`   ✅ Migrating totalPaid: ${booking.totalPaid}`);
        }

        // Migrate paymentMethods
        if (hasPaymentMethods && booking.paymentMethods.length > 0) {
          needsMigration = true;

          // If paymentDetails.paymentMethods doesn't exist, use the old paymentMethods
          if (!booking.paymentDetails || !booking.paymentDetails.paymentMethods || booking.paymentDetails.paymentMethods.length === 0) {
            updates['paymentDetails.paymentMethods'] = booking.paymentMethods;
            unsets['paymentMethods'] = '';
            if (VERBOSE) console.log(`   ✅ Migrating ${booking.paymentMethods.length} payment methods`);
          }
        } else if (hasPaymentHistory && booking.paymentHistory.length > 0) {
          // If no paymentMethods but has paymentHistory, reconstruct from history
          needsMigration = true;
          const reconstructedMethods = booking.paymentHistory.map(payment => ({
            method: payment.method,
            amount: payment.amount,
            reference: payment.reference,
            notes: payment.notes,
            collectedBy: payment.collectedBy,
            collectedAt: payment.collectedAt || new Date()
          }));
          updates['paymentDetails.paymentMethods'] = reconstructedMethods;
          if (VERBOSE) console.log(`   ✅ Reconstructed ${reconstructedMethods.length} payment methods from history`);
        }

        // Migrate remainingAmount
        if (hasRemainingAmount) {
          needsMigration = true;
          updates['paymentDetails.remainingAmount'] = booking.remainingAmount;
          unsets['remainingAmount'] = '';
          if (VERBOSE) console.log(`   ✅ Migrating remainingAmount: ${booking.remainingAmount}`);
        }

        // Recalculate totalPaid from paymentMethods if needed
        if (updates['paymentDetails.paymentMethods'] && Array.isArray(updates['paymentDetails.paymentMethods'])) {
          const calculatedTotal = updates['paymentDetails.paymentMethods'].reduce(
            (sum, pm) => sum + (pm.amount || 0),
            0
          );

          if (calculatedTotal > 0) {
            updates['paymentDetails.totalPaid'] = calculatedTotal;
            updates['paymentDetails.remainingAmount'] = Math.max(0, (booking.totalAmount || 0) - calculatedTotal);

            // Update payment status based on actual payments
            if (calculatedTotal >= (booking.totalAmount || 0)) {
              updates['paymentStatus'] = 'paid';
            } else if (calculatedTotal > 0) {
              updates['paymentStatus'] = 'partially_paid';
            }

            if (VERBOSE) {
              console.log(`   💰 Recalculated totalPaid: ${calculatedTotal}`);
              console.log(`   💰 Recalculated remainingAmount: ${updates['paymentDetails.remainingAmount']}`);
              console.log(`   💰 Updated paymentStatus: ${updates['paymentStatus']}`);
            }
          }
        }

        // Handle edge case: paymentStatus='paid' but no payment data
        if (booking.paymentStatus === 'paid' &&
            (!updates['paymentDetails.totalPaid'] || updates['paymentDetails.totalPaid'] === 0)) {
          console.log(`   ⚠️  WARNING: Booking ${booking.bookingNumber} is marked as 'paid' but has no payment data!`);
          console.log(`      This booking will be marked as 'pending' until payment is recorded.`);
          updates['paymentStatus'] = 'pending';
        }

        if (needsMigration) {
          if (!DRY_RUN) {
            // Perform the migration
            const updateOperation = { $set: updates };
            if (Object.keys(unsets).length > 0) {
              updateOperation.$unset = unsets;
            }

            await Booking.updateOne(
              { _id: booking._id },
              updateOperation
            );
            migratedCount++;
            console.log(`✅ Migrated: ${booking.bookingNumber || booking._id}`);
          } else {
            migratedCount++;
            console.log(`✓ Would migrate: ${booking.bookingNumber || booking._id}`);
          }
        } else {
          skippedCount++;
          if (VERBOSE) console.log(`⏭️  Skipped (no changes needed): ${booking.bookingNumber || booking._id}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating booking ${booking.bookingNumber || booking._id}:`, error.message);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`Total bookings found:     ${bookingsWithOldStructure.length}`);
    console.log(`✅ Migrated:              ${migratedCount}`);
    console.log(`⏭️  Skipped:               ${skippedCount}`);
    console.log(`❌ Errors:                ${errorCount}`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN MODE - No changes were made to the database');
      console.log('   Run without --dry-run flag to apply changes:');
      console.log('   node src/scripts/migratePaymentData.js');
    } else {
      console.log('\n✅ Migration completed successfully!');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB\n');
  }
}

// Run the migration
migratePaymentData()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
