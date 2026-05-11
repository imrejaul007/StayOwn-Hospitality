import mongoose from 'mongoose';
import { seedExtraPersonChargeRules } from '../backend/src/scripts/seedExtraPersonChargeRules.js';

const MONGO_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management';

console.log('🔄 Starting Extra Person Charge Rules Seeding Test...');
console.log('📍 Connecting to database...');

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('✅ Connected to MongoDB');

  try {
    console.log('🌱 Running seeding function...');
    const result = await seedExtraPersonChargeRules();

    console.log('\n📋 SEEDING RESULT:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('🎉 SUCCESS: Extra person charge rules seeded successfully');
    } else {
      console.log('❌ FAILED:', result.error);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    console.log('🔌 Closing database connection...');
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
    process.exit(0);
  }
})
.catch((error) => {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
});