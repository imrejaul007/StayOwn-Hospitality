import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Hotel from '../models/Hotel.js';

// Load environment variables
dotenv.config();

/**
 * Migration Script: Populate Multi-Property Fields in User Model
 *
 * This script migrates existing users to the multi-property model by:
 * 1. Populating the 'properties' array from existing 'hotelId' field
 * 2. Setting 'primaryProperty' to the current 'hotelId'
 * 3. Enabling multi-property access for admin users
 * 4. Finding all hotels owned by admin users and adding them to properties array
 *
 * Run with: node src/scripts/migrateUsersForMultiProperty.js
 */

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function migrateUsers() {
  console.log('\n🚀 Starting multi-property migration...\n');

  try {
    // Get all users
    const users = await User.find({}).lean().limit(1000);
    console.log(`📊 Found ${users.length} users to migrate\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        let needsSave = false;

        // Step 1: Populate properties array from hotelId (for all users)
        if (user.hotelId && (!user.properties || user.properties.length === 0)) {
          user.properties = [user.hotelId];
          user.primaryProperty = user.hotelId;
          needsSave = true;
          console.log(`  ↳ Set properties array from hotelId`);
        }

        // Step 2: For admin users, find ALL hotels they own
        if (user.role === 'admin' || user.role === 'manager') {
          // Find all hotels where this user is the owner
          const ownedHotels = await Hotel.find({
            $or: [
              { ownerId: user._id },
              { createdBy: user._id }
            ]
          }).select('_id name').lean().limit(1000);

          if (ownedHotels.length > 0) {
            // Set properties to all owned hotels
            user.properties = ownedHotels.map(hotel => hotel._id);

            // Set primary property (keep existing hotelId if available)
            if (!user.primaryProperty) {
              user.primaryProperty = user.hotelId || ownedHotels[0]._id;
            }

            // Enable multi-property access for admins
            user.multiPropertyAccess = {
              enabled: true,
              allowedProperties: user.properties,
              restrictions: {
                canCreateProperties: true,
                canDeleteProperties: user.role === 'admin', // Only admins can delete
                canManageGroups: true
              }
            };

            needsSave = true;
            console.log(`  ↳ Found ${ownedHotels.length} owned hotels`);
            console.log(`  ↳ Enabled multi-property access`);
          }
        }

        // Save user if changes were made
        if (needsSave) {
          await user.save({ validateBeforeSave: false });
          migratedCount++;

          console.log(`✅ Migrated: ${user.email}`);
          console.log(`  ↳ Role: ${user.role}`);
          console.log(`  ↳ Properties: ${user.properties?.length || 0}`);
          console.log(`  ↳ Multi-property enabled: ${user.multiPropertyAccess?.enabled || false}`);
          console.log('');
        } else {
          skippedCount++;
          console.log(`⏭️  Skipped: ${user.email} (no changes needed)`);
        }

      } catch (userError) {
        errorCount++;
        console.error(`❌ Error migrating user ${user.email}:`, userError.message);
      }
    }

    console.log('\n📈 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount} users`);
    console.log(`  ⏭️  Skipped: ${skippedCount} users`);
    console.log(`  ❌ Errors: ${errorCount} users`);
    console.log(`  📊 Total processed: ${users.length} users\n`);

    if (errorCount === 0) {
      console.log('✨ Migration completed successfully!\n');
    } else {
      console.log('⚠️  Migration completed with errors. Please review the logs.\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n');

  try {
    // Count users with multi-property access
    const multiPropertyUsers = await User.countDocuments({
      'multiPropertyAccess.enabled': true
    });

    // Count users with properties array populated
    const usersWithProperties = await User.countDocuments({
      properties: { $exists: true, $ne: [] }
    });

    // Count users with primary property set
    const usersWithPrimaryProperty = await User.countDocuments({
      primaryProperty: { $exists: true, $ne: null }
    });

    console.log('📊 Verification Results:');
    console.log(`  ✅ Users with multi-property access: ${multiPropertyUsers}`);
    console.log(`  ✅ Users with properties array: ${usersWithProperties}`);
    console.log(`  ✅ Users with primary property: ${usersWithPrimaryProperty}`);
    console.log('');

    // Show sample migrated admin user
    const sampleAdmin = await User.findOne({
      role: 'admin',
      'multiPropertyAccess.enabled': true
    })
      .populate('properties', 'name')
      .populate('primaryProperty', 'name').lean();

    if (sampleAdmin) {
      console.log('📋 Sample Migrated Admin User:');
      console.log(`  Email: ${sampleAdmin.email}`);
      console.log(`  Properties: ${sampleAdmin.properties?.map(p => p.name).join(', ') || 'None'}`);
      console.log(`  Primary Property: ${sampleAdmin.primaryProperty?.name || 'None'}`);
      console.log(`  Multi-property enabled: ${sampleAdmin.multiPropertyAccess?.enabled}`);
      console.log('');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  MULTI-PROPERTY MIGRATION SCRIPT');
    console.log('═══════════════════════════════════════════════════════════\n');

    await connectDB();
    await migrateUsers();
    await verifyMigration();

    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Migration Process Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration process failed:', error);
    process.exit(1);
  }
}

// Run migration
main();
