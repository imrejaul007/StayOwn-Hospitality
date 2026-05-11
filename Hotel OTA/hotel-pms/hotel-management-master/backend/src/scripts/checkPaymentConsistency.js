import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

console.log('\n🔍 Payment Consistency Check');
console.log('='.repeat(60) + '\n');

async function checkPaymentConsistency() {
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Booking = mongoose.connection.collection('bookings');

    // Check for inconsistent payment data
    console.log('🔍 Checking for payment inconsistencies...\n');

    // Find bookings with paymentStatus='paid' but no actual payment
    const paidWithNoPayment = await Booking.find({
      paymentStatus: 'paid',
      $or: [
        { 'paymentDetails.totalPaid': { $exists: false } },
        { 'paymentDetails.totalPaid': 0 },
        { 'paymentDetails.paymentMethods': { $size: 0 } }
      ]
    }).toArray().lean().limit(1000);

    console.log(`❌ Bookings marked 'paid' with no payment data: ${paidWithNoPayment.length}`);
    if (paidWithNoPayment.length > 0) {
      paidWithNoPayment.forEach(b => {
        console.log(`   - ${b.bookingNumber}: paymentStatus=${b.paymentStatus}, totalPaid=${b.paymentDetails?.totalPaid || 0}, totalAmount=${b.totalAmount}`);
      });
    }

    // Find bookings with paymentDetails but status is wrong
    const paidButStatusWrong = await Booking.find({
      'paymentDetails.totalPaid': { $gte: 1 },
      paymentStatus: { $nin: ['paid', 'partially_paid'] }
    }).toArray().lean().limit(1000);

    console.log(`\n⚠️  Bookings with payment but wrong status: ${paidButStatusWrong.length}`);
    if (paidButStatusWrong.length > 0) {
      paidButStatusWrong.forEach(b => {
        console.log(`   - ${b.bookingNumber}: paymentStatus=${b.paymentStatus}, totalPaid=${b.paymentDetails?.totalPaid || 0}, totalAmount=${b.totalAmount}`);
      });
    }

    // Find all checked-in bookings
    const checkedInBookings = await Booking.find({
      status: 'checked_in'
    }).toArray().lean().limit(1000);

    console.log(`\n📊 Checked-in bookings: ${checkedInBookings.length}`);
    if (checkedInBookings.length > 0) {
      console.log('\n   Details:');
      checkedInBookings.forEach(b => {
        const totalPaid = b.paymentDetails?.totalPaid || 0;
        const totalAmount = b.totalAmount || 0;
        const balance = totalAmount - totalPaid;
        console.log(`   - ${b.bookingNumber}:`);
        console.log(`     Status: ${b.status}, PaymentStatus: ${b.paymentStatus}`);
        console.log(`     Total: ₹${totalAmount}, Paid: ₹${totalPaid}, Balance: ₹${balance}`);
        console.log(`     Payment Methods: ${b.paymentDetails?.paymentMethods?.length || 0}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check completed\n');

  } catch (error) {
    console.error('\n❌ Check failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB\n');
  }
}

// Run the check
checkPaymentConsistency()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
