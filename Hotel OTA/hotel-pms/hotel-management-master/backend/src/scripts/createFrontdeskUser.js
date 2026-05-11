import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

dotenv.config();

const createFrontdeskUser = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL || process.env.MONGO_URI);
    console.log('✅ Database connected');

    // Get first hotel (or you can specify a specific hotel)
    const hotel = await Hotel.findOne().lean();

    if (!hotel) {
      console.error('❌ No hotel found. Please create a hotel first.');
      process.exit(1);
    }

    console.log(`📍 Using hotel: ${hotel.name} (ID: ${hotel._id})`);

    // Check if frontdesk user already exists
    const existingUser = await User.findOne({
      email: 'frontdesk@hotel.com',
      hotelId: hotel._id
    });

    if (existingUser) {
      console.log('ℹ️  Frontdesk user already exists. Updating role and password...');
      existingUser.role = 'frontdesk';
      existingUser.password = 'frontdesk123'; // Will be hashed by pre-save hook
      existingUser.properties = [hotel._id]; // Ensure multi-property support
      await existingUser.save();
      console.log('✅ Updated existing user to frontdesk role with new password');
      console.log('\n📧 Login credentials:');
      console.log('   Email: frontdesk@hotel.com');
      console.log('   Password: frontdesk123');
      console.log('   Role: frontdesk');
      console.log(`   Hotel: ${hotel.name}`);
      console.log(`   User ID: ${existingUser._id}`);
      process.exit(0);
    }

    // Create new frontdesk user
    const frontdeskUser = await User.create({
      firstName: 'Front',
      lastName: 'Desk',
      name: 'Front Desk User',
      email: 'frontdesk@hotel.com',
      password: 'frontdesk123', // Will be hashed by the model's pre-save hook
      role: 'frontdesk',
      phone: '+1234567890',
      hotelId: hotel._id,
      department: 'Front Desk',
      isActive: true,
      emailVerified: true,
      properties: [hotel._id] // For multi-property support
    });

    console.log('✅ Frontdesk user created successfully!');
    console.log('\n📧 Login credentials:');
    console.log('   Email: frontdesk@hotel.com');
    console.log('   Password: frontdesk123');
    console.log('   Role: frontdesk');
    console.log(`   Hotel: ${hotel.name}`);
    console.log(`   User ID: ${frontdeskUser._id}`);
    console.log('\n🚀 You can now login at: /login');
    console.log('   After login, you will be redirected to: /frontdesk');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating frontdesk user:', error);
    process.exit(1);
  }
};

createFrontdeskUser();
