/**
 * Prints base hotel + related counts (rooms, bookings, supply requests).
 * Run: npm run inspect:base-hotel
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const NAMES = ['THE PENTOUZ', 'THE PENTHOUSE'];

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const hotel =
    (await db.collection('hotels').findOne({ name: { $in: NAMES } })) ||
    (await db.collection('hotels').findOne({ isActive: true }, { sort: { createdAt: 1 } }));

  if (!hotel) {
    console.log('No hotel found. Run: npm run seed:demo');
    await mongoose.disconnect();
    return;
  }

  const hid = hotel._id;
  const [rooms, bookings, supply] = await Promise.all([
    db.collection('rooms').countDocuments({ hotelId: hid }),
    db.collection('bookings').countDocuments({ hotelId: hid }),
    db.collection('supplyrequests').countDocuments({ hotelId: hid })
  ]);

  console.log('--- Base hotel ---');
  console.log('ID:          ', hid.toString());
  console.log('Name:        ', hotel.name);
  console.log('Address:     ', hotel.address?.city, ',', hotel.address?.country);
  console.log('Contact:     ', hotel.contact?.email, '/', hotel.contact?.phone);
  console.log('Owner:       ', hotel.ownerId?.toString());
  console.log('Active:      ', hotel.isActive);
  console.log('--- Counts ---');
  console.log('Rooms:       ', rooms);
  console.log('Bookings:    ', bookings);
  console.log('Supply req:  ', supply);
  console.log('--- Update via API (admin session) ---');
  console.log('PUT   /api/v1/admin/hotels/' + hid.toString());
  console.log('      Body: { name, description, address, contact, amenities, type }');
  console.log('PATCH /api/v1/admin/hotels/' + hid.toString());
  console.log('      Body: { isActive: true|false }');
  console.log('Settings UI also uses /api/v1/hotel-settings/* (hotel-scoped).');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
