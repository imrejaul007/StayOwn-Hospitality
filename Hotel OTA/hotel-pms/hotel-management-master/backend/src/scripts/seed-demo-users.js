/**
 * Upserts standard demo users (no full DB wipe). Uses MONGO_URI from backend/.env.
 * Run: npm run seed:demo
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEMO_USERS = [
  { email: 'admin@hotel.com', password: 'admin123', role: 'admin', name: 'Hotel Admin' },
  { email: 'frontdesk@hotel.com', password: 'frontdesk123', role: 'frontdesk', name: 'Front Desk' },
  { email: 'staff@hotel.com', password: 'staff123', role: 'staff', name: 'General Staff' },
  { email: 'john@example.com', password: 'guest123', role: 'guest', name: 'John Doe' }
];

async function ensureHotel() {
  let hotel = await Hotel.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (hotel) {
    return hotel;
  }

  const placeholder = await User.create({
    name: 'Demo Seed Placeholder',
    email: `demo-placeholder-${Date.now()}@example.com`,
    password: 'DemoPlaceholder1!',
    role: 'guest'
  });

  hotel = await Hotel.create({
    name: 'THE PENTOUZ',
    description: 'Demo property for dashboard access',
    address: {
      street: '1 Demo Street',
      city: 'Demo City',
      country: 'US'
    },
    contact: {
      phone: '+10000000000',
      email: 'info@demo-hotel.example.com'
    },
    ownerId: placeholder._id
  });

  await User.deleteOne({ _id: placeholder._id });
  return hotel;
}

async function upsertDemoUser({ email, password, role, name }, hotelId) {
  let user = await User.findOne({ email }).select('+password');

  const needsHotel = ['admin', 'manager', 'staff', 'frontdesk'].includes(role);
  const payload = {
    name,
    role,
    isActive: true,
    ...(needsHotel ? { hotelId, primaryProperty: hotelId, properties: [hotelId] } : {})
  };

  if (!user) {
    await User.create({
      email,
      password,
      ...payload
    });
    return { email, action: 'created' };
  }

  user.name = name;
  user.role = role;
  user.password = password;
  user.isActive = true;
  if (needsHotel) {
    user.hotelId = hotelId;
    user.primaryProperty = hotelId;
    user.properties = [hotelId];
  } else {
    user.set('hotelId', null);
    user.set('primaryProperty', null);
    user.set('properties', []);
  }
  await user.save();
  return { email, action: 'updated' };
}

async function linkHotelOwner(adminUserId, hotelId) {
  await Hotel.updateOne(
    { _id: hotelId },
    { $set: { ownerId: adminUserId } }
  );
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('Missing MONGO_URI (or MONGODB_URI / DATABASE_URL) in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected:', mongoose.connection.name);

  const hotel = await ensureHotel();
  console.log('Using hotel:', hotel.name, `(${hotel._id})`);

  const results = [];
  for (const demo of DEMO_USERS) {
    const r = await upsertDemoUser(demo, hotel._id);
    results.push(r);
    console.log(`  ${r.action}: ${r.email} (${demo.role})`);
  }

  const admin = await User.findOne({ email: 'admin@hotel.com' });
  if (admin) {
    await linkHotelOwner(admin._id, hotel._id);
    console.log('Set hotel.ownerId to admin user.');
  }

  console.log('\nDone. Demo logins:');
  console.log('  Admin:      admin@hotel.com / admin123');
  console.log('  Front desk: frontdesk@hotel.com / frontdesk123');
  console.log('  Staff:      staff@hotel.com / staff123');
  console.log('  Guest:      john@example.com / guest123');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
