import mongoose from 'mongoose';
import Hotel from './backend/src/models/Hotel.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';

const hotelIdToFind = '68c7e6ebca8aed0ec8036a9c';
const userHotelId = '68cd01414419c17b5f6b4c12';

async function verifyHotels() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Check if the requested hotel exists
    const requestedHotel = await Hotel.findById(hotelIdToFind);
    console.log('\nRequested Hotel (68c7e6ebca8aed0ec8036a9c):');
    console.log(requestedHotel ? 'EXISTS' : 'NOT FOUND');
    if (requestedHotel) {
      console.log(`  Name: ${requestedHotel.name}`);
      console.log(`  Owner: ${requestedHotel.ownerId}`);
    }

    // Check if the user's hotel exists
    const userHotel = await Hotel.findById(userHotelId);
    console.log('\nUser Hotel (68cd01414419c17b5f6b4c12):');
    console.log(userHotel ? 'EXISTS' : 'NOT FOUND');
    if (userHotel) {
      console.log(`  Name: ${userHotel.name}`);
      console.log(`  Owner: ${userHotel.ownerId}`);
    }

    // List all hotels
    const allHotels = await Hotel.find({}, { _id: 1, name: 1, ownerId: 1 }).limit(5);
    console.log('\nFirst 5 Hotels in Database:');
    allHotels.forEach(h => {
      console.log(`  ${h._id.toString()}: ${h.name}`);
    });

    console.log('\nTotal Hotels:', await Hotel.countDocuments());

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

verifyHotels();
