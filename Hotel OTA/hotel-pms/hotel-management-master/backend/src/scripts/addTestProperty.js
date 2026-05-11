/**
 * Quick Script: Add a Test Property to Database
 *
 * This script adds a second property to your system so you can test
 * the multi-property selector functionality.
 *
 * Usage:
 * 1. Make sure MongoDB is running
 * 2. Run: node src/scripts/addTestProperty.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');

async function addTestProperty() {
  try {
    // Connect to MongoDB
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-management');
    console.log('✅ Connected to MongoDB\n');

    // Check existing properties
    const existingProperties = await Hotel.find().lean().limit(1000);
    console.log(`📊 Existing properties: ${existingProperties.length}`);
    existingProperties.forEach(p => console.log(`   - ${p.name} (ID: ${p._id})`));
    console.log('');

    // Create new test property
    console.log('🏗️  Creating new test property...');
    const newProperty = new Hotel({
      name: 'THE PENTOUZ Hotel2',
      address: {
        street: '456 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        zipCode: '400020'
      },
      contact: {
        phone: '+91 22 2345 6789',
        email: 'hotel2@pentouz.com',
        website: 'https://pentouz.com/hotel2'
      },
      facilities: {
        totalRooms: 150,
        totalFloors: 10,
        checkInTime: '14:00',
        checkOutTime: '11:00',
        amenities: ['WiFi', 'Parking', 'Pool', 'Gym', 'Restaurant', 'Spa', 'Bar', 'Room Service', 'Laundry']
      },
      policies: {
        cancellationPolicy: 'Free cancellation up to 24 hours before check-in',
        childPolicy: 'Children under 12 stay free',
        petPolicy: 'Pets not allowed',
        smokingPolicy: 'No smoking in rooms'
      },
      active: true,
      verified: true
    });

    await newProperty.save();
    console.log(`✅ Property created: ${newProperty.name}`);
    console.log(`   ID: ${newProperty._id}`);
    console.log(`   Location: ${newProperty.address.city}, ${newProperty.address.state}\n`);

    // Now get all properties
    const allProperties = await Hotel.find().lean().limit(1000);
    console.log(`\n📊 Total properties now: ${allProperties.length}`);
    console.log('─────────────────────────────────────────');
    allProperties.forEach((p, index) => {
      console.log(`${index + 1}. ${p.name}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Location: ${p.address.city}, ${p.address.state}`);
      console.log('');
    });

    console.log('─────────────────────────────────────────');
    console.log('✅ NEXT STEPS:');
    console.log('1. Copy the property IDs above');
    console.log('2. Run the assignPropertiesToUser.js script with these IDs');
    console.log('3. Or use the User Management UI to assign properties');
    console.log('─────────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the function
addTestProperty();
