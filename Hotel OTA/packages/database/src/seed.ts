import logger from './utils/logger';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  logger.info('Seeding database...');

  // ─── EARN RULES (from spec: 04_COIN_ECONOMICS.md) ─────────
  const earnRules = [
    // OTA Coin earn rules
    { ruleName: 'OTA Direct - OTA Coin', coinType: 'ota' as const, channelSource: 'ota_app' as const, earnPct: 6.00 },
    { ruleName: 'ReZ Funnel - OTA Coin', coinType: 'ota' as const, channelSource: 'rez_app' as const, earnPct: 5.00 },
    { ruleName: 'Corporate - OTA Coin', coinType: 'ota' as const, channelSource: 'corporate' as const, earnPct: 5.00 },
    { ruleName: 'Hotel QR - OTA Coin', coinType: 'ota' as const, channelSource: 'hotel_qr' as const, earnPct: 2.00 },
    // ReZ Coin earn rules
    { ruleName: 'OTA Direct - ReZ Coin', coinType: 'rez' as const, channelSource: 'ota_app' as const, earnPct: 4.00 },
    { ruleName: 'ReZ Funnel - ReZ Coin', coinType: 'rez' as const, channelSource: 'rez_app' as const, earnPct: 6.00 },
    { ruleName: 'Corporate - ReZ Coin', coinType: 'rez' as const, channelSource: 'corporate' as const, earnPct: 2.00 },
    { ruleName: 'Hotel QR - ReZ Coin', coinType: 'rez' as const, channelSource: 'hotel_qr' as const, earnPct: 4.00 },
  ];

  // Check if earn rules already exist
  const existingRules = await prisma.earnRule.count();
  if (existingRules === 0) {
    await prisma.earnRule.createMany({
      data: earnRules.map((r) => ({
        ruleName: r.ruleName,
        coinType: r.coinType,
        channelSource: r.channelSource,
        userTier: 'all' as const,
        earnPct: r.earnPct,
        validFrom: new Date('2024-01-01'),
      })),
    });
  }

  logger.info('Earn rules seeded');

  // ─── BURN RULES (from spec) ────────────────────────────────
  const burnRules = [
    { coinType: 'ota' as const, userTier: 'basic' as const, maxBurnPct: 15.00, minCashPct: 60.00 },
    { coinType: 'ota' as const, userTier: 'silver' as const, maxBurnPct: 20.00, minCashPct: 60.00 },
    { coinType: 'ota' as const, userTier: 'gold' as const, maxBurnPct: 25.00, minCashPct: 60.00 },
    { coinType: 'rez' as const, userTier: 'all' as const, maxBurnPct: 10.00, minCashPct: 60.00 },
  ];

  const existingBurnRules = await prisma.burnRule.count();
  if (existingBurnRules === 0) {
    await prisma.burnRule.createMany({ data: burnRules });
  }

  logger.info('Burn rules seeded');

  // ─── ADMIN USER ────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.adminUser.upsert({
    where: { email: 'admin@ota.com' },
    create: {
      email: 'admin@ota.com',
      passwordHash: adminPassword,
      fullName: 'OTA Admin',
      role: 'super_admin',
    },
    update: {},
  });

  logger.info('Admin user seeded (admin@ota.com / admin123)');

  // ─── SAMPLE HOTELS (Bangalore launch) ─────────────────────
  const sampleHotels = [
    {
      name: 'The Koramangala Suites',
      slug: 'koramangala-suites',
      addressLine1: '12th Main Road, Koramangala',
      city: 'Bangalore',
      pincode: '560034',
      latitude: 12.9352,
      longitude: 77.6245,
      starRating: 3,
      category: 'midscale' as const,
      description: 'Modern hotel in the heart of Koramangala, minutes from tech parks.',
      amenities: ['wifi', 'breakfast', 'parking', 'ac', 'tv'],
      primaryContactName: 'Rajesh Kumar',
      primaryContactPhone: '9876543210',
      onboardingStatus: 'active' as const,
      otaCommissionPct: 6.00,
    },
    {
      name: 'HSR Stay Inn',
      slug: 'hsr-stay-inn',
      addressLine1: '27th Main, HSR Layout',
      city: 'Bangalore',
      pincode: '560102',
      latitude: 12.9116,
      longitude: 77.6389,
      starRating: 2,
      category: 'budget' as const,
      description: 'Affordable comfort in HSR Layout, perfect for business travellers.',
      amenities: ['wifi', 'ac', 'tv'],
      primaryContactName: 'Suresh Reddy',
      primaryContactPhone: '9876543211',
      onboardingStatus: 'active' as const,
      otaCommissionPct: 7.00,
    },
    {
      name: 'Whitefield Grand',
      slug: 'whitefield-grand',
      addressLine1: 'ITPL Main Road, Whitefield',
      city: 'Bangalore',
      pincode: '560066',
      latitude: 12.9698,
      longitude: 77.7500,
      starRating: 4,
      category: 'upscale' as const,
      description: 'Premium hotel near Whitefield tech corridor with excellent amenities.',
      amenities: ['wifi', 'breakfast', 'parking', 'pool', 'gym', 'spa', 'ac', 'tv'],
      primaryContactName: 'Priya Sharma',
      primaryContactPhone: '9876543212',
      onboardingStatus: 'active' as const,
      otaCommissionPct: 5.00,
    },
    {
      name: 'Indiranagar Boutique',
      slug: 'indiranagar-boutique',
      addressLine1: '100 Feet Road, Indiranagar',
      city: 'Bangalore',
      pincode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      starRating: 4,
      category: 'boutique' as const,
      description: 'Charming boutique stay in vibrant Indiranagar, close to nightlife and dining.',
      amenities: ['wifi', 'breakfast', 'ac', 'tv', 'minibar'],
      primaryContactName: 'Anita Desai',
      primaryContactPhone: '9876543213',
      onboardingStatus: 'active' as const,
      otaCommissionPct: 6.00,
    },
  ];

  for (const hotelData of sampleHotels) {
    const hotel = await prisma.hotel.upsert({
      where: { slug: hotelData.slug },
      create: hotelData,
      update: {},
    });

    // Create room types for each hotel
    const roomTypes = [
      { name: 'Standard Room', maxOccupancy: 2, bedType: 'Double', baseRatePaise: 200000 },
      { name: 'Deluxe Double', maxOccupancy: 2, bedType: 'King', baseRatePaise: 350000 },
      { name: 'Suite', maxOccupancy: 3, bedType: 'King', baseRatePaise: 550000 },
    ];

    for (const rt of roomTypes) {
      // Check if room type already exists for this hotel
      let roomType = await prisma.roomType.findFirst({
        where: { hotelId: hotel.id, name: rt.name },
      });

      if (!roomType) {
        roomType = await prisma.roomType.create({
          data: {
            hotelId: hotel.id,
            name: rt.name,
            maxOccupancy: rt.maxOccupancy,
            bedType: rt.bedType,
            baseRatePaise: rt.baseRatePaise,
          },
        });
      }

      // Create inventory slots for next 90 days
      const today = new Date();
      const inventoryData = [];
      for (let i = 0; i < 90; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        date.setHours(0, 0, 0, 0);

        inventoryData.push({
          hotelId: hotel.id,
          roomTypeId: roomType.id,
          date,
          totalRooms: 5,
          availableRooms: 5,
          ratePaise: rt.baseRatePaise,
        });
      }

      await prisma.inventorySlot.createMany({
        data: inventoryData,
        skipDuplicates: true,
      });
    }

    // Create hotel wallet
    await prisma.hotelWallet.upsert({
      where: { hotelId: hotel.id },
      create: { hotelId: hotel.id },
      update: {},
    });

    // Create hotel staff
    await prisma.hotelStaff.upsert({
      where: { hotelId_phone: { hotelId: hotel.id, phone: hotelData.primaryContactPhone! } },
      create: {
        hotelId: hotel.id,
        phone: hotelData.primaryContactPhone!,
        fullName: hotelData.primaryContactName!,
        role: 'manager',
      },
      update: {},
    });

    logger.info(`Hotel seeded: ${hotelData.name}`);
  }

  // ─── 5th HOTEL: MG ROAD ───────────────────────────────────
  const mgRoad = await prisma.hotel.upsert({
    where: { slug: 'mg-road-business-hotel' },
    create: {
      name: 'MG Road Business Hotel',
      slug: 'mg-road-business-hotel',
      addressLine1: 'MG Road, Near Trinity Circle',
      city: 'Bangalore',
      pincode: '560001',
      latitude: 12.9756,
      longitude: 77.6031,
      starRating: 3,
      category: 'midscale' as const,
      description: 'Central business hotel on MG Road, ideal for corporate travellers.',
      amenities: ['wifi', 'breakfast', 'ac', 'tv', 'parking', 'gym'],
      primaryContactName: 'Vikram Singh',
      primaryContactPhone: '9876543214',
      onboardingStatus: 'active' as const,
      otaCommissionPct: 6.00,
    },
    update: {},
  });

  // Create rooms + inventory for MG Road hotel
  for (const rt of [
    { name: 'Executive Room', maxOccupancy: 2, bedType: 'Queen', baseRatePaise: 280000 },
    { name: 'Business Suite', maxOccupancy: 3, bedType: 'King', baseRatePaise: 480000 },
  ]) {
    let roomType = await prisma.roomType.findFirst({ where: { hotelId: mgRoad.id, name: rt.name } });
    if (!roomType) {
      roomType = await prisma.roomType.create({ data: { hotelId: mgRoad.id, ...rt } });
    }
    const today = new Date();
    const inventoryData = [];
    for (let i = 0; i < 90; i++) {
      const date = new Date(today); date.setDate(date.getDate() + i); date.setHours(0, 0, 0, 0);
      inventoryData.push({ hotelId: mgRoad.id, roomTypeId: roomType.id, date, totalRooms: 6, availableRooms: 6, ratePaise: rt.baseRatePaise });
    }
    await prisma.inventorySlot.createMany({ data: inventoryData, skipDuplicates: true });
  }
  await prisma.hotelWallet.upsert({ where: { hotelId: mgRoad.id }, create: { hotelId: mgRoad.id }, update: {} });
  await prisma.hotelStaff.upsert({
    where: { hotelId_phone: { hotelId: mgRoad.id, phone: '9876543214' } },
    create: { hotelId: mgRoad.id, phone: '9876543214', fullName: 'Vikram Singh', role: 'manager' },
    update: {},
  });
  logger.info('Hotel seeded: MG Road Business Hotel');

  // ─── TEST USERS ─────────────────────────────────────────
  let testUser = await prisma.user.findUnique({ where: { phone: '9999999999' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: { phone: '9999999999', fullName: 'Test User', email: 'test@example.com', tier: 'silver' },
    });
    await prisma.coinWallet.create({
      data: { userId: testUser.id, otaCoinBalancePaise: 50000, rezCoinBalancePaise: 20000, otaCoinLifetimeEarnedPaise: 120000 },
    });
    logger.info('Test user seeded: 9999999999 (Silver tier, ₹500 OTA coins)');
  }

  // Corporate test user
  let corpUser = await prisma.user.findUnique({ where: { phone: '9888888888' } });
  if (!corpUser) {
    corpUser = await prisma.user.create({
      data: { phone: '9888888888', fullName: 'Corporate Traveller', email: 'corp@company.com' },
    });
    await prisma.coinWallet.create({ data: { userId: corpUser.id } });

    // Create corporate account
    const corpAccount = await prisma.corporateAccount.create({
      data: {
        companyName: 'TechStartup Pvt Ltd',
        gstin: '29AABCT1234A1Z5',
        billingEmail: 'billing@techstartup.com',
        creditLimitPaise: 50000000, // ₹5,00,000
        paymentTermsDays: 30,
      },
    });
    await prisma.corporateUser.create({
      data: { corporateAccountId: corpAccount.id, userId: corpUser.id, role: 'admin' },
    });
    logger.info('Corporate user seeded: 9888888888 (TechStartup Pvt Ltd)');
  }

  logger.info('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
