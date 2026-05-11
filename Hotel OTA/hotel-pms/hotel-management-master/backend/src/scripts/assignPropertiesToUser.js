/**
 * Quick Script: Assign All Properties to Admin User
 *
 * This script assigns all existing properties to your admin user
 * so you can use the multi-property selector.
 *
 * Usage:
 * 1. Make sure MongoDB is running
 * 2. Run: node src/scripts/assignPropertiesToUser.js <email>
 * 3. Example: node src/scripts/assignPropertiesToUser.js admin@hotel.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');

async function assignProperties() {
  try {
    // Get email from command line argument
    const userEmail = process.argv[2] || 'admin@hotel.com';

    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management');
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`🔍 Finding user: ${userEmail}`);
    const user = await User.findOne({ email: userEmail }).lean();

    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      console.log('\n💡 Available users:');
      const allUsers = await User.find({}, 'email name role').lean().limit(1000);
      allUsers.forEach(u => console.log(`   - ${u.email} (${u.name}) - ${u.role}`));
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.name} (${user.role})\n`);

    // Get all properties
    console.log('🏨 Fetching all properties...');
    const properties = await Hotel.find({ active: true }).lean().limit(1000);

    if (properties.length === 0) {
      console.error('❌ No properties found in database');
      console.log('💡 Run addTestProperty.js first to create test properties');
      process.exit(1);
    }

    console.log(`✅ Found ${properties.length} active properties:`);
    properties.forEach((p, index) => {
      console.log(`   ${index + 1}. ${p.name} (ID: ${p._id})`);
    });
    console.log('');

    // Assign all properties to user
    const propertyIds = properties.map(p => p._id);

    console.log('🔄 Assigning properties to user...');
    user.properties = propertyIds;
    user.hotelId = propertyIds[0]; // Set first property as primary
    user.isMultiProperty = propertyIds.length > 1;

    // Add multi-property access for admins
    if (user.role === 'admin') {
      user.multiPropertyAccess = {
        enabled: true,
        restrictions: {
          canCreateProperties: true,
          canDeleteProperties: true,
          canManageGroups: true
        }
      };
    }

    await user.save();

    console.log('✅ Properties assigned successfully!\n');
    console.log('─────────────────────────────────────────');
    console.log('👤 User:', user.name);
    console.log('📧 Email:', user.email);
    console.log('🎭 Role:', user.role);
    console.log('🏨 Properties assigned:', propertyIds.length);
    console.log('🏢 Primary property:', properties[0].name);
    console.log('🔀 Multi-property enabled:', user.isMultiProperty);
    console.log('─────────────────────────────────────────');
    console.log('\n✅ DONE! Next steps:');
    console.log('1. Restart your backend server (if running)');
    console.log('2. Restart your frontend server');
    console.log('3. Login with this user');
    console.log('4. You should now see the Property Selector in the header!');
    console.log('─────────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the function
assignProperties();
