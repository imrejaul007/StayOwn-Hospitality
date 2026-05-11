import mongoose from 'mongoose';
import Hotel from '../models/Hotel.js';
import PropertyGroup from '../models/PropertyGroup.js';
import SettingsInheritance from '../models/SettingsInheritance.js';
import User from '../models/User.js';

/**
 * Multi-Property Support Migration Script
 *
 * This script migrates existing hotels to support multi-property management:
 * 1. Adds multi-property fields to hotels without them
 * 2. Creates SettingsInheritance records for properties in groups
 * 3. Initializes inheritance configuration
 * 4. Updates user multi-property access settings
 *
 * Usage:
 * node backend/src/scripts/migrateMultiPropertySupport.js
 */

class MultiPropertyMigration {
  constructor() {
    this.stats = {
      hotelsChecked: 0,
      hotelsUpdated: 0,
      groupsProcessed: 0,
      inheritanceRecordsCreated: 0,
      usersUpdated: 0,
      errors: []
    };
  }

  /**
   * Main migration entry point
   */
  async run() {
    console.log('='.repeat(60));
    console.log('Starting Multi-Property Support Migration');
    console.log('='.repeat(60));
    console.log('');

    try {
      // Step 1: Migrate hotel schema
      await this.migrateHotels();

      // Step 2: Process property groups
      await this.processPropertyGroups();

      // Step 3: Create inheritance records
      await this.createInheritanceRecords();

      // Step 4: Update user access settings
      await this.updateUserAccess();

      // Print summary
      this.printSummary();

      console.log('');
      console.log('Migration completed successfully!');
      console.log('='.repeat(60));

      return {
        success: true,
        stats: this.stats
      };
    } catch (error) {
      console.error('Migration failed:', error);
      this.stats.errors.push({
        stage: 'migration',
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Step 1: Migrate hotels to include multi-property fields
   */
  async migrateHotels() {
    console.log('[Step 1] Migrating hotel records...');

    try {
      // Get all hotels
      const hotels = await Hotel.find({}).lean().limit(1000);
      this.stats.hotelsChecked = hotels.length;

      console.log(`Found ${hotels.length} hotels to check`);

      let updated = 0;

      for (const hotel of hotels) {
        let needsUpdate = false;
        const updates = {};

        // Add inheritSettings if missing
        if (hotel.inheritSettings === undefined) {
          updates.inheritSettings = hotel.propertyGroupId ? true : false;
          needsUpdate = true;
        }

        // Add settingsOverrides if missing
        if (!hotel.settingsOverrides) {
          updates.settingsOverrides = new Map();
          needsUpdate = true;
        }

        // Add lastSyncedAt if missing
        if (!hotel.lastSyncedAt) {
          updates.lastSyncedAt = null;
          needsUpdate = true;
        }

        // Add multiPropertyEnabled if missing
        if (hotel.multiPropertyEnabled === undefined) {
          updates.multiPropertyEnabled = !!hotel.propertyGroupId;
          needsUpdate = true;
        }

        // Add inheritanceConfig if missing
        if (!hotel.inheritanceConfig) {
          updates.inheritanceConfig = {
            autoSync: true,
            syncFrequency: 'manual',
            allowLocalOverrides: true
          };
          needsUpdate = true;
        }

        if (needsUpdate) {
          await Hotel.updateOne(
            { _id: hotel._id },
            { $set: updates }
          );
          updated++;
        }
      }

      this.stats.hotelsUpdated = updated;
      console.log(`✓ Updated ${updated} hotel records`);
      console.log('');
    } catch (error) {
      console.error('Error migrating hotels:', error);
      this.stats.errors.push({
        stage: 'migrateHotels',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Step 2: Process property groups and their properties
   */
  async processPropertyGroups() {
    console.log('[Step 2] Processing property groups...');

    try {
      const groups = await PropertyGroup.find({ status: 'active' }).lean().limit(1000);
      console.log(`Found ${groups.length} active property groups`);

      for (const group of groups) {
        try {
          // Get properties in this group
          const properties = await Hotel.find({
            propertyGroupId: group._id,
            isActive: true
          }).lean().limit(1000);

          console.log(`  - Group "${group.name}": ${properties.length} properties`);

          // Update each property's group settings
          for (const property of properties) {
            await Hotel.updateOne(
              { _id: property._id },
              {
                $set: {
                  'groupSettings.lastSyncAt': new Date(),
                  'groupSettings.version': group.updatedAt,
                  multiPropertyEnabled: true,
                  inheritSettings: property.groupSettings?.inheritSettings !== false
                }
              }
            );
          }

          this.stats.groupsProcessed++;
        } catch (error) {
          console.error(`  - Error processing group ${group.name}:`, error.message);
          this.stats.errors.push({
            stage: 'processPropertyGroups',
            groupId: group._id,
            groupName: group.name,
            error: error.message
          });
        }
      }

      console.log(`✓ Processed ${this.stats.groupsProcessed} property groups`);
      console.log('');
    } catch (error) {
      console.error('Error processing property groups:', error);
      throw error;
    }
  }

  /**
   * Step 3: Create inheritance records for all properties in groups
   */
  async createInheritanceRecords() {
    console.log('[Step 3] Creating settings inheritance records...');

    try {
      // Get all properties that belong to a group
      const properties = await Hotel.find({
        propertyGroupId: { $ne: null },
        isActive: true
      }).lean().limit(1000);

      console.log(`Creating inheritance records for ${properties.length} properties`);

      // Setting types to track
      const settingTypes = [
        'check_in_out',
        'currency',
        'timezone',
        'general',
        'integration_settings',
        'system_settings',
        'room_taxes',
        'web_settings',
        'pos_taxes',
        'display_preferences',
        'room_types',
        'booking_rules',
        'message_templates',
        'notification_templates',
        'housekeeping_settings',
        'custom_fields',
        'departments',
        'hotel_areas',
        'reason_codes',
        'measurement_units',
        'phone_extensions',
        'revenue_accounts'
      ];

      let recordsCreated = 0;

      for (const property of properties) {
        try {
          // Create inheritance records for each setting type
          for (const settingType of settingTypes) {
            // Check if record already exists
            const existing = await SettingsInheritance.findOne({
              propertyId: property._id,
              settingType
            }).lean();

            if (!existing) {
              await SettingsInheritance.create({
                propertyId: property._id,
                groupId: property.propertyGroupId,
                settingType,
                isInheriting: property.inheritSettings !== false,
                hasOverride: false,
                overrideValues: {},
                inheritedValues: {},
                syncedAt: new Date(),
                syncStatus: 'synced',
                metadata: {
                  appliedScope: 'single',
                  affectedPropertiesCount: 1,
                  currentVersion: new Date()
                }
              });

              recordsCreated++;
            }
          }

          // Update property's lastSyncedAt
          await Hotel.updateOne(
            { _id: property._id },
            { $set: { lastSyncedAt: new Date() } }
          );
        } catch (error) {
          console.error(`  - Error creating records for property ${property.name}:`, error.message);
          this.stats.errors.push({
            stage: 'createInheritanceRecords',
            propertyId: property._id,
            propertyName: property.name,
            error: error.message
          });
        }
      }

      this.stats.inheritanceRecordsCreated = recordsCreated;
      console.log(`✓ Created ${recordsCreated} inheritance records`);
      console.log('');
    } catch (error) {
      console.error('Error creating inheritance records:', error);
      throw error;
    }
  }

  /**
   * Step 4: Update user multi-property access settings
   */
  async updateUserAccess() {
    console.log('[Step 4] Updating user multi-property access...');

    try {
      // Find users who own multiple properties
      const users = await Hotel.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$ownerId', propertyCount: { $sum: 1 }, properties: { $push: '$_id' } } },
        { $match: { propertyCount: { $gt: 1 } } }
      ]);

      console.log(`Found ${users.length} users with multiple properties`);

      let updated = 0;

      for (const userData of users) {
        try {
          const user = await User.findById(userData._id).lean();

          if (user) {
            // Update multi-property access
            await User.updateOne(
              { _id: user._id },
              {
                $set: {
                  'multiPropertyAccess.enabled': true,
                  'multiPropertyAccess.allowedProperties': userData.properties,
                  properties: userData.properties,
                  primaryProperty: userData.properties[0] // Set first as primary
                }
              }
            );
            updated++;
          }
        } catch (error) {
          console.error(`  - Error updating user ${userData._id}:`, error.message);
          this.stats.errors.push({
            stage: 'updateUserAccess',
            userId: userData._id,
            error: error.message
          });
        }
      }

      this.stats.usersUpdated = updated;
      console.log(`✓ Updated ${updated} user records`);
      console.log('');
    } catch (error) {
      console.error('Error updating user access:', error);
      throw error;
    }
  }

  /**
   * Print migration summary
   */
  printSummary() {
    console.log('');
    console.log('='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log('');
    console.log(`Hotels checked:              ${this.stats.hotelsChecked}`);
    console.log(`Hotels updated:              ${this.stats.hotelsUpdated}`);
    console.log(`Property groups processed:   ${this.stats.groupsProcessed}`);
    console.log(`Inheritance records created: ${this.stats.inheritanceRecordsCreated}`);
    console.log(`Users updated:               ${this.stats.usersUpdated}`);
    console.log(`Errors encountered:          ${this.stats.errors.length}`);

    if (this.stats.errors.length > 0) {
      console.log('');
      console.log('ERRORS:');
      this.stats.errors.forEach((err, idx) => {
        console.log(`${idx + 1}. [${err.stage}] ${err.error}`);
        if (err.propertyName) console.log(`   Property: ${err.propertyName}`);
        if (err.groupName) console.log(`   Group: ${err.groupName}`);
      });
    }
  }
}

/**
 * Run migration if called directly
 */
async function runMigration() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MongoDB URI not found in environment variables');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);

    console.log('Connected to MongoDB');
    console.log('');

    // Run migration
    const migration = new MultiPropertyMigration();
    const result = await migration.run();

    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('Fatal error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Execute if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}

// Export for use as module
export { MultiPropertyMigration, runMigration };
export default runMigration;
