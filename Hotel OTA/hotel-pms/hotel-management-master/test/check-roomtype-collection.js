import mongoose from 'mongoose';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function checkRoomTypeCollection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully!');

    const db = mongoose.connection.db;
    
    // Check if roomtype collection exists
    const collections = await db.listCollections().toArray();
    const roomTypeCollection = collections.find(col => col.name.toLowerCase().includes('roomtype'));
    
    console.log('\n=== All Collections ===');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });

    if (roomTypeCollection) {
      console.log(`\n=== RoomType Collection Found: ${roomTypeCollection.name} ===`);
      
      const collection = db.collection(roomTypeCollection.name);
      const count = await collection.countDocuments();
      console.log(`Total documents: ${count}`);
      
      if (count > 0) {
        console.log('\n=== Sample Documents ===');
        const samples = await collection.find({}).limit(3).toArray();
        samples.forEach((doc, index) => {
          console.log(`\nDocument ${index + 1}:`);
          console.log(JSON.stringify(doc, null, 2));
        });

        console.log('\n=== Collection Schema Analysis ===');
        const sample = await collection.findOne({});
        if (sample) {
          console.log('Fields in the collection:');
          Object.keys(sample).forEach(key => {
            console.log(`- ${key}: ${typeof sample[key]}`);
          });
        }
      }
    } else {
      console.log('\n❌ No roomtype collection found!');
      
      // Look for similar collections
      const similarCollections = collections.filter(col => 
        col.name.toLowerCase().includes('room') || 
        col.name.toLowerCase().includes('type')
      );
      
      if (similarCollections.length > 0) {
        console.log('\n=== Similar Collections Found ===');
        for (const col of similarCollections) {
          console.log(`\n--- ${col.name} ---`);
          const collection = db.collection(col.name);
          const count = await collection.countDocuments();
          console.log(`Documents: ${count}`);
          
          if (count > 0) {
            const sample = await collection.findOne({});
            console.log('Sample document:');
            console.log(JSON.stringify(sample, null, 2));
          }
        }
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkRoomTypeCollection();