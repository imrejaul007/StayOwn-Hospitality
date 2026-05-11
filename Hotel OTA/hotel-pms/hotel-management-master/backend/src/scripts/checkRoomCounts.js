import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Hotel from '../models/Hotel.js';
import Room from '../models/Room.js';

dotenv.config();

async function checkRoomCounts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all hotels
    const hotels = await Hotel.find({}).lean().limit(1000);
    console.log(`Found ${hotels.length} hotels:\n`);

    let totalRoomsAcrossAll = 0;

    // Check room count for each hotel
    for (const hotel of hotels) {
      const roomCount = await Room.countDocuments({ hotelId: hotel._id });
      totalRoomsAcrossAll += roomCount;

      console.log(`📍 Hotel: "${hotel.name}"`);
      console.log(`   ID: ${hotel._id}`);
      console.log(`   City: ${hotel.address?.city || 'N/A'}`);
      console.log(`   Rooms in database: ${roomCount}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════');
    console.log(`TOTAL ROOMS ACROSS ALL HOTELS: ${totalRoomsAcrossAll}`);
    console.log('═══════════════════════════════════════\n');

    // Show room status breakdown for first hotel (for verification)
    if (hotels.length > 0) {
      const firstHotel = hotels[0];
      const rooms = await Room.find({ hotelId: firstHotel._id }).limit(5).lean();

      console.log(`\nSample rooms from "${firstHotel.name}":`);
      rooms.forEach(room => {
        console.log(`  - Room ${room.roomNumber}: status=${room.status}, type=${room.type}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRoomCounts();
