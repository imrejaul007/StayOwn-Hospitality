import logger from './utils/logger';

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/habixo';

const seedProperties = [
  {
    propertyId: 'HAB-TEST-001',
    title: 'Modern Apartment in Koramangala',
    description: 'Beautiful 2BHK apartment in the heart of Koramangala',
    propertyType: 'apartment',
    roomType: 'entire_place',
    hostId: 'host_001',
    brand: 'habixo_stay',
    location: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    pricing: { basePrice: 2500, currency: 'INR' },
  },
  {
    propertyId: 'HAB-TEST-002',
    title: 'Cozy Room in Indiranagar',
    description: 'Private room with attached bathroom',
    propertyType: 'apartment',
    roomType: 'private_room',
    hostId: 'host_001',
    brand: 'habixo_stay',
    location: { city: 'Bangalore', state: 'Karnataka', country: 'India' },
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    pricing: { basePrice: 1200, currency: 'INR' },
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI);
  logger.info('Connected to MongoDB');
  logger.info('Seeding completed');
  await mongoose.disconnect();
}

seed().catch(console.error);
