import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

console.log('\n🔍 Checking Guest Users Hotel Associations');
console.log('='.repeat(60) + '\n');

async function checkGuestHotels() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = mongoose.connection.collection('users');
    const Hotel = mongoose.connection.collection('hotels');

    // Find all guest users
    const guestUsers = await User.find({ role: 'guest' }).toArray().lean().limit(1000);
    console.log(`📊 Total Guest Users: ${guestUsers.length}\n`);

    // Get all hotels
    const hotels = await Hotel.find({}).toArray().lean().limit(1000);
    console.log(`🏨 Total Hotels: ${hotels.length}\n`);

    console.log('🏨 Hotels in Database:');
    hotels.forEach(hotel => {
      console.log(`   - ${hotel.name} (ID: ${hotel._id})`);
      if (hotel.address) {
        console.log(`     Address: ${hotel.address.street}, ${hotel.address.city}`);
      }
    });
    console.log('');

    // Group guests by hotelId
    const guestsByHotel = {};
    let guestsWithNoHotel = 0;

    guestUsers.forEach(guest => {
      if (guest.hotelId) {
        const hotelIdStr = guest.hotelId.toString();
        if (!guestsByHotel[hotelIdStr]) {
          guestsByHotel[hotelIdStr] = [];
        }
        guestsByHotel[hotelIdStr].push(guest);
      } else {
        guestsWithNoHotel++;
      }
    });

    console.log('👥 Guest Distribution by Hotel:\n');

    for (const [hotelId, guests] of Object.entries(guestsByHotel)) {
      const hotel = hotels.find(h => h._id.toString() === hotelId);
      const hotelName = hotel ? hotel.name : 'Unknown Hotel';

      console.log(`🏨 ${hotelName} (${hotelId}):`);
      console.log(`   Total Guests: ${guests.length}`);
      console.log(`   Guest Names:`);
      guests.forEach(g => {
        console.log(`      - ${g.name} (${g.email})`);
      });
      console.log('');
    }

    if (guestsWithNoHotel > 0) {
      console.log(`⚠️  Guests with NO hotelId: ${guestsWithNoHotel}`);
      const guestsWithoutHotel = guestUsers.filter(g => !g.hotelId);
      guestsWithoutHotel.forEach(g => {
        console.log(`      - ${g.name} (${g.email})`);
      });
      console.log('');
    }

    // Check for guests starting with 'm'
    const guestsWithM = guestUsers.filter(g =>
      g.name && g.name.toLowerCase().startsWith('m')
    );

    console.log(`\n🔍 Guests starting with "m": ${guestsWithM.length}`);
    guestsWithM.forEach(g => {
      console.log(`   - ${g.name} (${g.email}) - hotelId: ${g.hotelId || 'NONE'}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ Check completed\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkGuestHotels()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
