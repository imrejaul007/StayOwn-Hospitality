import mongoose from 'mongoose';

// MongoDB connection string
const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function verifyDatabaseData() {
  console.log('🔄 Connecting to MongoDB database...\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB database\n');

    // Define basic schemas for data verification
    const userSchema = new mongoose.Schema({}, { strict: false });
    const bookingSchema = new mongoose.Schema({}, { strict: false });
    const roomSchema = new mongoose.Schema({}, { strict: false });
    const housekeepingSchema = new mongoose.Schema({}, { strict: false });
    const maintenanceSchema = new mongoose.Schema({}, { strict: false });
    const guestServiceSchema = new mongoose.Schema({}, { strict: false });
    const inventorySchema = new mongoose.Schema({}, { strict: false });
    const checkoutInventorySchema = new mongoose.Schema({}, { strict: false });

    const User = mongoose.model('User', userSchema);
    const Booking = mongoose.model('Booking', bookingSchema);
    const Room = mongoose.model('Room', roomSchema);
    const Housekeeping = mongoose.model('Housekeeping', housekeepingSchema);
    const MaintenanceTask = mongoose.model('MaintenanceTask', maintenanceSchema);
    const GuestService = mongoose.model('GuestService', guestServiceSchema);
    const Inventory = mongoose.model('Inventory', inventorySchema);
    const CheckoutInventory = mongoose.model('CheckoutInventory', checkoutInventorySchema);

    console.log('📊 Database Data Verification Report');
    console.log('=====================================\n');

    // 1. Check for staff user
    console.log('1. Staff User Verification:');
    const staffUser = await User.findOne({ email: 'staff@hotel.com' });
    if (staffUser) {
      console.log('   ✅ Staff user exists');
      console.log('   📋 User details:');
      console.log('      - Name:', staffUser.name);
      console.log('      - Email:', staffUser.email);
      console.log('      - Role:', staffUser.role);
      console.log('      - Hotel ID:', staffUser.hotelId);
      console.log('      - Is Active:', staffUser.isActive);
    } else {
      console.log('   ❌ Staff user NOT found - this is the primary issue!');
    }

    // 2. Check hotel and room data
    console.log('\n2. Hotel and Room Data:');
    const totalRooms = await Room.countDocuments();
    const activeRooms = await Room.countDocuments({ isActive: true });
    console.log('   📊 Total rooms in database:', totalRooms);
    console.log('   📊 Active rooms:', activeRooms);

    if (staffUser && staffUser.hotelId) {
      const hotelRooms = await Room.countDocuments({ hotelId: staffUser.hotelId });
      console.log('   📊 Rooms for staff hotel:', hotelRooms);

      // Room status breakdown
      const roomsByStatus = await Room.aggregate([
        { $match: { hotelId: staffUser.hotelId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      console.log('   📊 Room status breakdown:');
      roomsByStatus.forEach(status => {
        console.log(`      - ${status._id}: ${status.count}`);
      });
    }

    // 3. Check booking data
    console.log('\n3. Booking Data:');
    const totalBookings = await Booking.countDocuments();
    console.log('   📊 Total bookings:', totalBookings);

    if (staffUser && staffUser.hotelId) {
      const hotelBookings = await Booking.countDocuments({ hotelId: staffUser.hotelId });
      console.log('   📊 Bookings for staff hotel:', hotelBookings);

      // Today's bookings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayCheckIns = await Booking.countDocuments({
        hotelId: staffUser.hotelId,
        checkIn: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in'] }
      });

      const todayCheckOuts = await Booking.countDocuments({
        hotelId: staffUser.hotelId,
        checkOut: { $gte: today, $lt: tomorrow },
        status: { $in: ['confirmed', 'checked_in', 'checked_out'] }
      });

      console.log('   📊 Today\'s check-ins:', todayCheckIns);
      console.log('   📊 Today\'s check-outs:', todayCheckOuts);
    }

    // 4. Check task data
    console.log('\n4. Task Data:');

    if (staffUser && staffUser.hotelId) {
      const pendingHousekeeping = await Housekeeping.countDocuments({
        hotelId: staffUser.hotelId,
        status: 'pending'
      });

      const pendingMaintenance = await MaintenanceTask.countDocuments({
        hotelId: staffUser.hotelId,
        status: 'pending'
      });

      const pendingGuestServices = await GuestService.countDocuments({
        hotelId: staffUser.hotelId,
        status: { $in: ['pending', 'assigned'] }
      });

      console.log('   📊 Pending housekeeping tasks:', pendingHousekeeping);
      console.log('   📊 Pending maintenance tasks:', pendingMaintenance);
      console.log('   📊 Pending guest services:', pendingGuestServices);
    }

    // 5. Check inventory data
    console.log('\n5. Inventory Data:');
    const totalInventoryItems = await Inventory.countDocuments();
    console.log('   📊 Total inventory items:', totalInventoryItems);

    if (staffUser && staffUser.hotelId) {
      const hotelInventory = await Inventory.countDocuments({ hotelId: staffUser.hotelId });
      const lowStockItems = await Inventory.countDocuments({
        hotelId: staffUser.hotelId,
        $expr: { $lte: ['$quantity', '$minimumThreshold'] },
        isActive: true
      });

      console.log('   📊 Hotel inventory items:', hotelInventory);
      console.log('   📊 Low stock items:', lowStockItems);
    }

    // 6. Check checkout inventory data
    console.log('\n6. Checkout Inventory Data:');
    const totalCheckoutInventories = await CheckoutInventory.countDocuments();
    console.log('   📊 Total checkout inventories:', totalCheckoutInventories);

    if (staffUser && staffUser.hotelId) {
      // Get checkout inventories for this hotel
      const hotelCheckouts = await CheckoutInventory.aggregate([
        {
          $lookup: {
            from: 'bookings',
            localField: 'bookingId',
            foreignField: '_id',
            as: 'booking'
          }
        },
        {
          $match: { 'booking.hotelId': staffUser.hotelId }
        },
        { $count: 'total' }
      ]);

      console.log('   📊 Hotel checkout inventories:', hotelCheckouts[0]?.total || 0);
    }

    // 7. Analysis and recommendations
    console.log('\n📋 Analysis Summary:');
    console.log('===================');

    if (!staffUser) {
      console.log('❌ CRITICAL ISSUE: Staff user does not exist in database');
      console.log('   📝 This explains why staff dashboard shows 0 data');
      console.log('   📝 Need to create staff user or verify login credentials');
    } else {
      console.log('✅ Staff user exists and is properly configured');

      if (staffUser.hotelId) {
        console.log('✅ Staff user has hotel ID assigned');
      } else {
        console.log('❌ Staff user missing hotel ID - this will cause data issues');
      }

      if (staffUser.role === 'staff') {
        console.log('✅ Staff user has correct role');
      } else {
        console.log('❌ Staff user has incorrect role:', staffUser.role);
      }
    }

  } catch (error) {
    console.error('❌ Database verification failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔄 Disconnected from database');
  }
}

// Run the verification
verifyDatabaseData();