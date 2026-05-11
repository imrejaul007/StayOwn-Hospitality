import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

console.log('\n🔍 Checking FrontDesk User Properties');
console.log('='.repeat(60) + '\n');

async function checkFrontdeskUser() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.connection.collection('users');

    // Find frontdesk users
    const frontdeskUsers = await User.find({ role: 'frontdesk' }).toArray().lean().limit(1000);

    console.log(`📊 Found ${frontdeskUsers.length} frontdesk users\n`);

    for (const user of frontdeskUsers) {
      console.log('👤 FrontDesk User:', user.email);
      console.log('   Name:', user.name);
      console.log('   Hotel ID:', user.hotelId);
      console.log('   Properties:', user.properties || 'NOT SET ❌');
      console.log('   Active:', user.isActive);
      console.log('');
    }

    // Check guest users with hotelId
    const guestUsers = await User.find({ role: 'guest' }).toArray().lean().limit(1000);
    console.log(`📊 Found ${guestUsers.length} guest users\n`);

    const hotelId = '68cd01414419c17b5f6b4c12';
    const guestsInHotel = guestUsers.filter(g => {
      if (!g.hotelId) return false;
      const guestHotelId = g.hotelId.toString();
      return guestHotelId === hotelId;
    });

    console.log(`🏨 Guests in hotel ${hotelId}: ${guestsInHotel.length}`);
    guestsInHotel.forEach(g => {
      console.log(`   - ${g.name} (${g.email}) - hotelId: ${g.hotelId}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check completed\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkFrontdeskUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
