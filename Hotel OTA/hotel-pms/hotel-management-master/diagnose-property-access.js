import mongoose from 'mongoose';
import User from './backend/src/models/User.js';
import Hotel from './backend/src/models/Hotel.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management';

const hotelIdToFind = '68c7e6ebca8aed0ec8036a9c';
const adminEmail = 'admin@hotel.com';

async function diagnoseAndFix() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    // Find the admin user
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      console.error(`❌ Admin user with email ${adminEmail} not found`);
      return;
    }

    console.log(`✓ Found admin user: ${adminUser.email}`);
    console.log(`  User ID: ${adminUser._id}`);
    console.log(`  Primary hotelId: ${adminUser.hotelId}`);
    console.log(`  Properties: ${JSON.stringify(adminUser.properties?.map(p => p.toString()), null, 2)}`);
    console.log(`  MultiPropertyAccess: ${JSON.stringify(adminUser.multiPropertyAccess?.allowedProperties?.map(p => p.toString()), null, 2)}\n`);

    // Find the hotel that's causing the error
    const targetHotel = await Hotel.findById(hotelIdToFind);
    if (!targetHotel) {
      console.error(`❌ Hotel with ID ${hotelIdToFind} not found in database`);
      console.log('Listing first 3 available hotels:\n');
      const availableHotels = await Hotel.find({}, { _id: 1, name: 1, ownerId: 1 }).limit(3);
      availableHotels.forEach(h => {
        console.log(`  ${h._id.toString()}: ${h.name} (owned by: ${h.ownerId})`);
      });
      return;
    }

    console.log(`✓ Found target hotel: ${targetHotel.name}`);
    console.log(`  Hotel ID: ${targetHotel._id}`);
    console.log(`  Owner: ${targetHotel.ownerId}`);
    console.log(`  Created by: ${targetHotel.createdBy}\n`);

    // Check if admin owns it
    const isOwner = targetHotel.ownerId?.toString() === adminUser._id.toString() ||
                    targetHotel.createdBy?.toString() === adminUser._id.toString();

    // Check if it's in their properties
    const hotelIdStr = hotelIdToFind.toString();
    const inProperties = adminUser.properties?.some(p => p.toString() === hotelIdStr);
    const inAllowedProperties = adminUser.multiPropertyAccess?.allowedProperties?.some(p => p.toString() === hotelIdStr);
    const isPrimaryProperty = adminUser.primaryProperty?.toString() === hotelIdStr;
    const isUserHotel = adminUser.hotelId?.toString() === hotelIdStr;

    console.log('Access Check Results:');
    console.log(`  ✓ Hotel exists: YES`);
    console.log(`  ${isOwner ? '✓' : '✗'} Admin owns hotel: ${isOwner}`);
    console.log(`  ${inProperties ? '✓' : '✗'} In properties array: ${inProperties}`);
    console.log(`  ${inAllowedProperties ? '✓' : '✗'} In allowed properties: ${inAllowedProperties}`);
    console.log(`  ${isPrimaryProperty ? '✓' : '✗'} Is primary property: ${isPrimaryProperty}`);
    console.log(`  ${isUserHotel ? '✓' : '✗'} Is user hotel: ${isUserHotel}\n`);

    const hasAccess = isOwner || inProperties || inAllowedProperties || isPrimaryProperty || isUserHotel;

    if (!hasAccess) {
      console.log('⚠️  Admin does NOT have access to this hotel. Attempting to fix...\n');

      // Option 1: Add to allowed properties
      if (!adminUser.multiPropertyAccess) {
        adminUser.multiPropertyAccess = { allowedProperties: [] };
      }
      if (!adminUser.multiPropertyAccess.allowedProperties) {
        adminUser.multiPropertyAccess.allowedProperties = [];
      }

      const alreadyExists = adminUser.multiPropertyAccess.allowedProperties.some(
        p => p.toString() === hotelIdToFind
      );

      if (!alreadyExists) {
        adminUser.multiPropertyAccess.allowedProperties.push(hotelIdToFind);
        await adminUser.save();
        console.log('✓ Added hotel to admin\'s multiPropertyAccess.allowedProperties');
      } else {
        console.log('ℹ️  Hotel was already in allowedProperties (shouldn\'t happen - check middleware)');
      }
    } else {
      console.log('✓ Admin already has access to this hotel');
    }

    console.log('\n✓ Diagnostic complete. Try the request again.');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseAndFix();
