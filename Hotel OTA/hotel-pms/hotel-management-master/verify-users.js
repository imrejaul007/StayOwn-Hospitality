import mongoose from 'mongoose';
import User from './backend/src/models/User.js';
import 'dotenv/config';

async function verifyUsers() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all users and their roles
        const users = await User.find({}, 'name email role isActive').lean();
        console.log('\n📋 All Users in System:');
        console.log('=' .repeat(50));

        users.forEach(user => {
            console.log(`${user.name} (${user.email}) - Role: ${user.role} - Active: ${user.isActive}`);
        });

        // Find staff users specifically assigned to tasks
        console.log('\n👥 Staff Users:');
        console.log('=' .repeat(30));
        const staffUsers = users.filter(u => u.role === 'staff');
        staffUsers.forEach(user => {
            console.log(`${user.name} (${user.email}) - Active: ${user.isActive}`);
        });

        // Find admin users
        console.log('\n🔐 Admin Users:');
        console.log('=' .repeat(30));
        const adminUsers = users.filter(u => u.role === 'admin');
        adminUsers.forEach(user => {
            console.log(`${user.name} (${user.email}) - Active: ${user.isActive}`);
        });

        console.log('\n📊 User Statistics:');
        console.log(`Total Users: ${users.length}`);
        console.log(`Guest Users: ${users.filter(u => u.role === 'guest').length}`);
        console.log(`Staff Users: ${staffUsers.length}`);
        console.log(`Admin Users: ${adminUsers.length}`);
        console.log(`Manager Users: ${users.filter(u => u.role === 'manager').length}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

verifyUsers();