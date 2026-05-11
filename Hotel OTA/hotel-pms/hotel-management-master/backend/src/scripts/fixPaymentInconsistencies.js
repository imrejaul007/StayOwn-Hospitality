import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const DRY_RUN = process.argv.includes('--dry-run');

console.log('\n🔧 Fix Payment Inconsistencies');
console.log('='.repeat(60));
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '✍️  LIVE MODE'}`);
console.log('='.repeat(60) + '\n');

async function fixPaymentInconsistencies() {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Booking = mongoose.connection.collection('bookings');

    let fixedCount = 0;

    // FIX 1: Bookings marked 'paid' but no actual payment data
    console.log('🔧 Fix 1: Bookings marked "paid" with no payment data\n');
    const paidWithNoPayment = await Booking.find({
      paymentStatus: 'paid',
      $or: [
        { 'paymentDetails.totalPaid': { $exists: false } },
        { 'paymentDetails.totalPaid': 0 },
        { 'paymentDetails.totalPaid': null }
      ]
    }).toArray().lean().limit(1000);

    console.log(`   Found: ${paidWithNoPayment.length} bookings`);

    for (const booking of paidWithNoPayment) {
      console.log(`   - ${booking.bookingNumber}: Changing 'paid' → 'pending' (no payment recorded)`);
      fixedCount++;
    }

    if (!DRY_RUN && paidWithNoPayment.length > 0) {
      // Batch: use bulkWrite to update all at once
      const bulkOps = paidWithNoPayment.map(booking => ({
        updateOne: {
          filter: { _id: booking._id },
          update: {
            $set: {
              paymentStatus: 'pending',
              'paymentDetails.totalPaid': 0,
              'paymentDetails.remainingAmount': booking.totalAmount || 0
            }
          }
        }
      }));
      await Booking.bulkWrite(bulkOps);
    }

    // FIX 2: Bookings with payment but wrong status
    console.log(`\n🔧 Fix 2: Bookings with payments but wrong status\n`);
    const paidButStatusWrong = await Booking.find({
      'paymentDetails.totalPaid': { $gte: 1 }
    }).toArray().lean().limit(1000);

    console.log(`   Found: ${paidButStatusWrong.length} bookings with payment data`);

    const bulkStatusOps = [];
    for (const booking of paidButStatusWrong) {
      const totalPaid = booking.paymentDetails?.totalPaid || 0;
      const totalAmount = booking.totalAmount || 0;
      let newStatus = booking.paymentStatus;

      if (totalPaid >= totalAmount) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'pending';
      }

      if (newStatus !== booking.paymentStatus) {
        console.log(`   - ${booking.bookingNumber}: '${booking.paymentStatus}' → '${newStatus}' (paid ₹${totalPaid} of ₹${totalAmount})`);
        bulkStatusOps.push({
          updateOne: {
            filter: { _id: booking._id },
            update: {
              $set: {
                paymentStatus: newStatus,
                'paymentDetails.remainingAmount': Math.max(0, totalAmount - totalPaid)
              }
            }
          }
        });
        fixedCount++;
      }
    }

    if (!DRY_RUN && bulkStatusOps.length > 0) {
      await Booking.bulkWrite(bulkStatusOps);
    }

    // FIX 3: Ensure paymentDetails structure exists for all bookings
    console.log(`\n🔧 Fix 3: Ensure paymentDetails structure\n`);
    const bookingsWithoutPaymentDetails = await Booking.find({
      paymentDetails: { $exists: false }
    }).toArray().lean().limit(1000);

    console.log(`   Found: ${bookingsWithoutPaymentDetails.length} bookings without paymentDetails`);

    for (const booking of bookingsWithoutPaymentDetails) {
      console.log(`   - ${booking.bookingNumber}: Adding paymentDetails structure`);
      fixedCount++;
    }

    if (!DRY_RUN && bookingsWithoutPaymentDetails.length > 0) {
      const bulkPaymentOps = bookingsWithoutPaymentDetails.map(booking => ({
        updateOne: {
          filter: { _id: booking._id },
          update: {
            $set: {
              paymentDetails: {
                paymentMethods: [],
                totalPaid: 0,
                remainingAmount: booking.totalAmount || 0,
                collectedAt: null,
                collectedBy: null
              }
            }
          }
        }
      }));
      await Booking.bulkWrite(bulkPaymentOps);
    }

    if (false) { // preserved for loop structure compatibility
      fixedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Summary:');
    console.log('='.repeat(60));
    console.log(`Total fixes applied: ${fixedCount}`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN - No changes made');
      console.log('   Run without --dry-run to apply fixes:');
      console.log('   node src/scripts/fixPaymentInconsistencies.js');
    } else {
      console.log('\n✅ Fixes applied successfully!');
    }

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB\n');
  }
}

// Run the fix
fixPaymentInconsistencies()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
