/**
 * Seeds sample operational data for the primary (base) hotel so the admin dashboard
 * shows non-empty room/occupancy/booking/supply widgets. Idempotent: skips sections
 * that already have enough rows.
 *
 * Prereq: npm run seed:demo (hotel + demo users)
 * Run: npm run seed:dashboard
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Hotel from '../models/Hotel.js';
import User from '../models/User.js';
import Room from '../models/Room.js';
import Booking from '../models/Booking.js';
import SupplyRequest from '../models/SupplyRequest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE_HOTEL_NAMES = ['THE PENTOUZ', 'THE PENTHOUSE'];

function itemLine(name, qty, unit, est) {
  return {
    name,
    quantity: qty,
    unit,
    estimatedCost: est,
    category: 'other'
  };
}

async function ensureRooms(hotelId) {
  const existing = await Room.countDocuments({ hotelId });
  if (existing >= 8) {
    console.log(`  Rooms: already ${existing} (skip)`);
    return Room.find({ hotelId }).limit(20).lean();
  }

  const created = [];
  for (let i = 1; i <= 10; i++) {
    const roomNumber = `10${i}`;
    const doc = await Room.create({
      hotelId,
      roomNumber,
      type: i % 2 === 0 ? 'double' : 'single',
      baseRate: 4500 + i * 100,
      floor: 1,
      capacity: 2,
      status: i <= 3 ? 'occupied' : 'vacant',
      description: 'Seeded demo room'
    });
    created.push(doc);
  }
  console.log(`  Rooms: created ${created.length}`);
  return created;
}

async function ensureSupplyRequests(hotelId, requesterId) {
  const existing = await SupplyRequest.countDocuments({ hotelId });
  if (existing >= 6) {
    console.log(`  Supply requests: already ${existing} (skip)`);
    return;
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const nextWeek = new Date(now.getTime() + 7 * 86400000);

  const samples = [
    { status: 'pending', department: 'housekeeping', title: 'Linens restock', neededBy: nextWeek, items: [itemLine('Towels', 20, 'pcs', 50)] },
    { status: 'pending', department: 'maintenance', title: 'AC filter', neededBy: yesterday, items: [itemLine('HEPA filter', 2, 'pcs', 1200)] },
    { status: 'approved', department: 'front_desk', title: 'Key cards', neededBy: nextWeek, items: [itemLine('RFID cards', 50, 'pcs', 25)] },
    { status: 'ordered', department: 'housekeeping', title: 'Cleaning supplies', neededBy: nextWeek, items: [itemLine('Disinfectant', 10, 'L', 80)] },
    { status: 'received', department: 'kitchen', title: 'Disposable cups', neededBy: yesterday, items: [itemLine('Cups', 500, 'pcs', 15)] },
    { status: 'rejected', department: 'other', title: 'Legacy order test', neededBy: nextWeek, items: [itemLine('Misc', 1, 'unit', 100)] }
  ];

  for (const s of samples) {
    await SupplyRequest.create({
      hotelId,
      requestedBy: requesterId,
      department: s.department,
      title: s.title,
      description: 'Seeded for dashboard demo',
      priority: 'medium',
      status: s.status,
      items: s.items,
      neededBy: s.neededBy
    });
  }
  console.log(`  Supply requests: created ${samples.length}`);
}

async function ensureBookings(hotelId, guestId, rooms) {
  const existing = await Booking.countDocuments({ hotelId });
  if (existing >= 3) {
    console.log(`  Bookings: already ${existing} (skip)`);
    return;
  }

  if (!rooms.length) return;

  const roomA = rooms[0];
  const roomB = rooms[1] || rooms[0];
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 86400000);
  const dayAfter = new Date(today.getTime() + 2 * 86400000);

  await Booking.create({
    hotelId,
    userId: guestId,
    rooms: [{ roomId: roomA._id, rate: roomA.baseRate || 5000 }],
    checkIn: tomorrow,
    checkOut: dayAfter,
    nights: 1,
    status: 'confirmed',
    paymentStatus: 'paid',
    totalAmount: (roomA.baseRate || 5000) * 2,
    currency: 'INR',
    guestDetails: { adults: 2, children: 0 }
  });

  await Booking.create({
    hotelId,
    userId: guestId,
    rooms: [{ roomId: roomB._id, rate: roomB.baseRate || 5000 }],
    checkIn: today,
    checkOut: tomorrow,
    nights: 1,
    status: 'checked_in',
    paymentStatus: 'paid',
    totalAmount: roomB.baseRate || 5000,
    currency: 'INR',
    guestDetails: { adults: 1, children: 0 }
  });

  console.log('  Bookings: created 2 (upcoming + in-house)');
}

async function alignAdminForMultiProperty(admin, hotelId) {
  const hid = hotelId.toString();
  const props = (admin.properties || []).map((p) => (p._id || p).toString());
  if (!props.includes(hid)) {
    admin.properties = [...(admin.properties || []), hotelId];
  }
  admin.primaryProperty = admin.primaryProperty || hotelId;
  admin.hotelId = admin.hotelId || hotelId;
  admin.multiPropertyAccess = admin.multiPropertyAccess || {};
  admin.multiPropertyAccess.enabled = true;
  admin.multiPropertyAccess.restrictions = admin.multiPropertyAccess.restrictions || {
    canCreateProperties: true,
    canDeleteProperties: false,
    canManageGroups: true
  };
  await admin.save();
  console.log('  Admin user: aligned primaryProperty + multiPropertyAccess.enabled for portfolio UX');
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);

  const hotel =
    (await Hotel.findOne({ name: { $in: BASE_HOTEL_NAMES } })) ||
    (await Hotel.findOne({ isActive: true }).sort({ createdAt: 1 }));

  if (!hotel) {
    console.error('No hotel found. Run: npm run seed:demo');
    process.exit(1);
  }

  const admin = await User.findOne({ email: 'admin@hotel.com' });
  const guest = await User.findOne({ email: 'john@example.com' });
  if (!admin) {
    console.error('admin@hotel.com not found. Run: npm run seed:demo');
    process.exit(1);
  }

  console.log('Hotel:', hotel.name, hotel._id.toString());

  await alignAdminForMultiProperty(admin, hotel._id);

  const rooms = await ensureRooms(hotel._id);
  await ensureSupplyRequests(hotel._id, admin._id);

  if (guest) {
    await ensureBookings(hotel._id, guest._id, rooms);
  } else {
    console.log('  Bookings: skipped (no john@example.com)');
  }

  console.log('\nDone. Refresh the admin dashboard.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
