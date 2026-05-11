import mongoose from 'mongoose';
import { TravelAgent } from './backend/src/models/TravelAgent.js';

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0";

async function testTravelAgentData() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if TravelAgent collection exists and has data
    console.log('\n📊 Checking Travel Agent data...');
    const travelAgents = await TravelAgent.find({});
    console.log(`Found ${travelAgents.length} travel agents in database`);

    if (travelAgents.length > 0) {
      console.log('\n📋 Travel Agent Summary:');
      travelAgents.forEach((agent, index) => {
        console.log(`${index + 1}. ${agent.companyName} (${agent.email}) - Status: ${agent.status}`);
      });
    } else {
      console.log('\n❌ No travel agents found in database!');
      console.log('This explains why the admin dashboard is empty.');
    }

    // Check collections
    console.log('\n🔍 Available collections:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });

  } catch (error) {
    console.error('❌ Error testing travel agent data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTravelAgentData();