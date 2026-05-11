import { MongoClient } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://mukulraj756:Zk8q2W4uDCaUWRh3@cluster0.thahvbk.mongodb.net/hotel-management?retryWrites=true&w=majority&appName=Cluster0';

async function testAdvancedReservationsDatabase() {
    console.log('🔍 ADVANCED RESERVATIONS DATABASE ANALYSIS');
    console.log('=' .repeat(60));

    let client;

    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB Atlas...');
        client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log('✅ Connected successfully to MongoDB Atlas');

        const db = client.db('hotel-management');

        // Test all relevant collections
        const collections = [
            'advancedreservations',
            'bookings',
            'rooms',
            'waitinglists',
            'roomblocks',
            'tapechartviews'
        ];

        console.log('\n📊 COLLECTION ANALYSIS:');
        console.log('-'.repeat(40));

        for (const collectionName of collections) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                console.log(`${collectionName.padEnd(20)}: ${count} documents`);

                if (count > 0) {
                    const sample = await collection.findOne();
                    console.log(`  Sample fields: ${Object.keys(sample).slice(0, 5).join(', ')}`);
                }
            } catch (error) {
                console.log(`${collectionName.padEnd(20)}: Collection not found or error`);
            }
        }

        // Test Advanced Reservations specifically
        console.log('\n📋 ADVANCED RESERVATIONS DETAILED ANALYSIS:');
        console.log('-'.repeat(50));

        const advancedReservations = db.collection('advancedreservations');
        const totalReservations = await advancedReservations.countDocuments();
        console.log(`Total Advanced Reservations: ${totalReservations}`);

        if (totalReservations > 0) {
            // Analyze by type
            const typeStats = await advancedReservations.aggregate([
                {
                    $group: {
                        _id: '$reservationType',
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();

            console.log('\nReservation Types:');
            typeStats.forEach(stat => {
                console.log(`  ${stat._id || 'undefined'}: ${stat.count}`);
            });

            // Count VIP reservations
            const vipCount = await advancedReservations.countDocuments({
                reservationType: 'vip'
            });
            console.log(`\nVIP Reservations: ${vipCount}`);

            // Count waitlist reservations
            const waitlistCount = await advancedReservations.countDocuments({
                waitlistInfo: { $ne: null }
            });
            console.log(`Waitlist Reservations: ${waitlistCount}`);

            // Count upgrades
            const upgradeStats = await advancedReservations.aggregate([
                { $unwind: { path: '$upgrades', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: null,
                        totalUpgrades: { $sum: { $cond: [{ $ne: ['$upgrades', null] }, 1, 0] } }
                    }
                }
            ]).toArray();

            const totalUpgrades = upgradeStats.length > 0 ? upgradeStats[0].totalUpgrades : 0;
            console.log(`Total Upgrades: ${totalUpgrades}`);

            // Sample documents
            console.log('\n📄 SAMPLE DOCUMENTS:');
            const samples = await advancedReservations.find().limit(3).toArray();
            samples.forEach((doc, index) => {
                console.log(`\nSample ${index + 1}:`);
                console.log(`  ID: ${doc._id}`);
                console.log(`  Reservation ID: ${doc.reservationId}`);
                console.log(`  Type: ${doc.reservationType}`);
                console.log(`  Priority: ${doc.priority}`);
                console.log(`  Has Waitlist: ${!!doc.waitlistInfo}`);
                console.log(`  Upgrades: ${doc.upgrades ? doc.upgrades.length : 0}`);
                console.log(`  Room Assignments: ${doc.roomAssignments ? doc.roomAssignments.length : 0}`);
            });
        }

        // Test Bookings collection
        console.log('\n📋 BOOKINGS ANALYSIS:');
        console.log('-'.repeat(30));

        const bookings = db.collection('bookings');
        const totalBookings = await bookings.countDocuments();
        console.log(`Total Bookings: ${totalBookings}`);

        if (totalBookings > 0) {
            const bookingStatusStats = await bookings.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();

            console.log('Booking Status Distribution:');
            bookingStatusStats.forEach(stat => {
                console.log(`  ${stat._id || 'undefined'}: ${stat.count}`);
            });
        }

        // Test WaitingList collection
        console.log('\n⏳ WAITING LIST ANALYSIS:');
        console.log('-'.repeat(30));

        const waitingList = db.collection('waitinglists');
        const totalWaitlist = await waitingList.countDocuments();
        console.log(`Total Waitlist Entries: ${totalWaitlist}`);

        // Test Room Blocks
        console.log('\n🏢 ROOM BLOCKS ANALYSIS:');
        console.log('-'.repeat(30));

        const roomBlocks = db.collection('roomblocks');
        const totalRoomBlocks = await roomBlocks.countDocuments();
        console.log(`Total Room Blocks: ${totalRoomBlocks}`);

        // Summary for screenshot data verification
        console.log('\n🎯 SCREENSHOT DATA VERIFICATION:');
        console.log('='.repeat(50));
        console.log('Expected from screenshot:');
        console.log('  Total Reservations: 5');
        console.log('  Upgrades: 2');
        console.log('  Waitlist: 5');
        console.log('  VIP Reservations: 1');
        console.log('');
        console.log('Actual database data:');
        console.log(`  Total Reservations: ${totalReservations}`);
        console.log(`  Total Upgrades: ${totalUpgrades || 0}`);
        console.log(`  Waitlist Reservations: ${waitlistCount || 0}`);
        console.log(`  VIP Reservations: ${vipCount || 0}`);
        console.log(`  Waitlist Collection: ${totalWaitlist || 0}`);
        console.log(`  Room Blocks: ${totalRoomBlocks || 0}`);

        // Data source conclusion
        console.log('\n🔍 DATA SOURCE ANALYSIS:');
        console.log('-'.repeat(30));

        if (totalReservations === 0) {
            console.log('❌ NO DATA FOUND - This suggests the UI is showing MOCK DATA');
        } else if (totalReservations === 5) {
            console.log('✅ POSSIBLE REAL DATA - Database count matches screenshot');
        } else {
            console.log('⚠️  PARTIAL MATCH - Database has data but counts don\'t match screenshot exactly');
        }

    } catch (error) {
        console.error('❌ Database connection or query failed:', error.message);
        console.log('\n🔍 This suggests the UI might be using MOCK DATA due to database connectivity issues');
    } finally {
        if (client) {
            await client.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Run the analysis
testAdvancedReservationsDatabase().catch(console.error);