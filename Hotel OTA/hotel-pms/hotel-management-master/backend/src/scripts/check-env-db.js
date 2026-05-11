/**
 * Verifies database settings from backend/.env (MONGO_URI, BACKUP_DIR).
 * Run from backend: npm run check:db
 */
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

function redactMongoUri(uri) {
  if (!uri || typeof uri !== 'string') return '(not set)';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@/, '$1***:***@');
}

function getMongoUri() {
  return process.env.MONGO_URI || process.env.MONGODB_URI || '';
}

async function main() {
  const mongoUri = getMongoUri();
  const backupDir = process.env.BACKUP_DIR;

  console.log('--- check-env-db ---');
  console.log('MONGO_URI (redacted):', redactMongoUri(mongoUri));
  console.log('BACKUP_DIR:', backupDir || '(not set)');

  if (!mongoUri) {
    console.error('\n❌ MONGO_URI / MONGODB_URI is missing in .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    const dbName = mongoose.connection.db?.databaseName;
    console.log('\n✅ Connected to MongoDB');
    console.log('   Database name:', dbName || '(unknown)');

    await mongoose.connection.db.admin().ping();
    console.log('   Ping: ok');

    const demoEmail = 'admin@hotel.com';
    const user = await User.findOne({ email: demoEmail }).select('+password');
    if (!user) {
      console.log(`\n⚠️  No user with email "${demoEmail}" — login will return 401 until you seed or register.`);
    } else {
      console.log(`\n✅ User "${demoEmail}" exists`);
      console.log('   role:', user.role);
      console.log('   isActive:', user.isActive);
      console.log('   hotelId:', String(user.hotelId || ''));
      const hasPassword = Boolean(user.password);
      console.log('   password field present:', hasPassword, hasPassword ? '(comparePassword will be used on login)' : '(missing — login will fail)');
    }

    const adminCount = await User.countDocuments({ role: { $in: ['admin', 'manager'] } });
    console.log('\n   Admin/manager users in DB:', adminCount);

    console.log('\n--- done ---');
  } catch (err) {
    console.error('\n❌', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

main();
