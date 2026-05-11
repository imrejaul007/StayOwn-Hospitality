import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../server.js';
import User from '../../models/User.js';
import Hotel from '../../models/Hotel.js';
import RefreshToken from '../../models/RefreshToken.js';

/**
 * POST /auth/switch-hotel — Bearer token (skips CSRF), updates User.hotelId and returns new JWT payload.
 */
describe('Auth switch-hotel integration', () => {
  const jwtSecret = process.env.JWT_SECRET || 'test-jwt-secret';

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI_TEST || process.env.MONGO_URI);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await RefreshToken.deleteMany({});
    await User.deleteMany({});
    await Hotel.deleteMany({});
  });

  it('updates active hotel for manager who owns both properties', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      name: 'Portfolio Manager',
      email: `switch-mgr-${suffix}@test.com`,
      password: 'password123',
      role: 'manager',
      hotelId: new mongoose.Types.ObjectId(),
      isActive: true
    });

    const h1 = await Hotel.create({
      name: 'Switch Hotel One',
      ownerId: owner._id,
      address: { city: 'A', state: 'S', country: 'IN' },
      contact: { phone: '+910000000001', email: `h1-${suffix}@test.com` },
      isActive: true
    });
    const h2 = await Hotel.create({
      name: 'Switch Hotel Two',
      ownerId: owner._id,
      address: { city: 'B', state: 'S', country: 'IN' },
      contact: { phone: '+910000000002', email: `h2-${suffix}@test.com` },
      isActive: true
    });

    await User.findByIdAndUpdate(owner._id, {
      $set: { hotelId: h1._id, properties: [h1._id, h2._id] }
    });

    const token = jwt.sign(
      { id: owner._id.toString(), role: 'manager', hotelId: h1._id.toString() },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/v1/auth/switch-hotel')
      .set('Authorization', `Bearer ${token}`)
      .send({ hotelId: h2._id.toString() })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeTruthy();
    const uid = res.body.user._id || res.body.user.id;
    expect(String(res.body.user.hotelId)).toBe(h2._id.toString());

    const dbUser = await User.findById(uid).lean();
    expect(String(dbUser.hotelId)).toBe(h2._id.toString());

    const decoded = jwt.verify(res.body.token, jwtSecret);
    expect(String(decoded.hotelId)).toBe(h2._id.toString());
  });

  it('returns 403 for guest role', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const guest = await User.create({
      name: 'Guest',
      email: `switch-guest-${suffix}@test.com`,
      password: 'password123',
      role: 'guest',
      hotelId: new mongoose.Types.ObjectId(),
      isActive: true
    });

    const h1 = await Hotel.create({
      name: 'G Hotel',
      ownerId: guest._id,
      address: { city: 'A', state: 'S', country: 'IN' },
      contact: { phone: '+910000000003', email: `gh-${suffix}@test.com` },
      isActive: true
    });
    await User.findByIdAndUpdate(guest._id, { $set: { hotelId: h1._id } });

    const token = jwt.sign(
      { id: guest._id.toString(), role: 'guest', hotelId: h1._id.toString() },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/v1/auth/switch-hotel')
      .set('Authorization', `Bearer ${token}`)
      .send({ hotelId: h1._id.toString() });

    expect(res.status).toBe(403);
  });

  it('returns 403 when target hotel is outside portfolio', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const other = await User.create({
      name: 'Other Owner',
      email: `other-${suffix}@test.com`,
      password: 'password123',
      role: 'manager',
      hotelId: new mongoose.Types.ObjectId(),
      isActive: true
    });

    const hOther = await Hotel.create({
      name: 'Stranger Hotel',
      ownerId: other._id,
      address: { city: 'Z', state: 'S', country: 'IN' },
      contact: { phone: '+919999999999', email: `stranger-${suffix}@test.com` },
      isActive: true
    });

    const admin = await User.create({
      name: 'Admin M',
      email: `switch-admin-${suffix}@test.com`,
      password: 'password123',
      role: 'admin',
      hotelId: new mongoose.Types.ObjectId(),
      isActive: true
    });

    const hMine = await Hotel.create({
      name: 'My Hotel',
      ownerId: admin._id,
      address: { city: 'M', state: 'S', country: 'IN' },
      contact: { phone: '+910000000004', email: `mine-${suffix}@test.com` },
      isActive: true
    });

    await User.findByIdAndUpdate(admin._id, { $set: { hotelId: hMine._id, properties: [hMine._id] } });

    const token = jwt.sign(
      { id: admin._id.toString(), role: 'admin', hotelId: hMine._id.toString() },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const res = await request(app)
      .post('/api/v1/auth/switch-hotel')
      .set('Authorization', `Bearer ${token}`)
      .send({ hotelId: hOther._id.toString() });

    expect(res.status).toBe(403);
  });
});
