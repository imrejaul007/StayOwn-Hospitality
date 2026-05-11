import express from 'express';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { validate, schemas } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { assertUserCanAccessHotel, refToHotelIdString } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

const isProduction = process.env.NODE_ENV === 'production';

function normalizeSameSite(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'strict') return 'strict';
  if (normalized === 'none') return 'none';
  return 'lax';
}

const sameSite = normalizeSameSite(
  process.env.AUTH_COOKIE_SAME_SITE || (isProduction ? 'none' : 'lax')
);

const secureCookies = (() => {
  if (typeof process.env.AUTH_COOKIE_SECURE === 'string') {
    return process.env.AUTH_COOKIE_SECURE.trim().toLowerCase() === 'true';
  }
  // Browsers require Secure when SameSite=None.
  if (sameSite === 'none') return true;
  return isProduction;
})();

const cookieDomain = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: secureCookies,
  sameSite,
  ...(cookieDomain ? { domain: cookieDomain } : {}),
};

function setAuthCookies(res, accessToken, refreshToken, csrfToken) {
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  res.cookie('csrfToken', csrfToken, {
    httpOnly: false,
    secure: secureCookies,
    sameSite,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    maxAge: 15 * 60 * 1000
  });
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', { ...COOKIE_OPTIONS, path: '/api/v1/auth' });
  res.clearCookie('csrfToken', {
    secure: secureCookies,
    sameSite,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });
}

async function createRefreshToken(userId) {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const family = uuidv4();

  await RefreshToken.create({
    tokenHash,
    userId,
    family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { rawToken, family };
}
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many failed attempts, please try again after 1 hour' },
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password change attempts. Please try again later.' },
  keyGenerator: (req) => String(req.user?._id || req.ip)
});

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [guest, staff, admin]
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.post('/register', authLimiter, validate(schemas.register), catchAsync(async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    throw new ApplicationError('User with this email already exists', 400);
  }

  // Generate email verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

  // Create user with verification token
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: 'guest',
    emailVerified: false,
    emailVerificationToken: hashedToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });

  // Generate access token
  const accessToken = jwt.sign(
    { id: user._id, role: user.role, hotelId: user.hotelId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Generate refresh token
  const { rawToken: refreshToken } = await createRefreshToken(user._id);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Set httpOnly cookies
  setAuthCookies(res, accessToken, refreshToken, csrfToken);

  // Send verification email (don't block response)
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
  emailService.sendEmail({
    to: email,
    subject: 'Verify Your Email',
    html: `
      <h2>Welcome to our hotel!</h2>
      <p>Dear ${name},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not create this account, you can safely ignore this email.</p>
    `
  }).catch(error => {
    logger.error('Failed to send verification email', { userId: user._id, error: error.message });
  });

  res.status(201).json({
    status: 'success',
    message: 'Registration successful. Please check your email to verify your account.',
    user
  });
}));

/**
 * @swagger
 * /auth/verify-email:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email', catchAsync(async (req, res) => {
  const { token } = req.query;
  if (!token) {
    throw new ApplicationError('Verification token is required', 400);
  }

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() }
  }).select('+emailVerificationToken +emailVerificationExpires');

  if (!user) {
    throw new ApplicationError('Invalid or expired verification token', 400);
  }

  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.json({
    status: 'success',
    message: 'Email verified successfully'
  });
}));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.post('/login', authLimiter, strictAuthLimiter, validate(schemas.login), catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Check for user and password
  const user = await User.findOne({ email }).select('+password');
  
  if (!user || !(await user.comparePassword(password))) {
    throw new ApplicationError('Invalid email or password', 401);
  }

  if (!user.isActive) {
    throw new ApplicationError('Account has been deactivated', 401);
  }

  // Update last login atomically
  await User.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date() } },
    { new: true });

  // Re-fetch with populated multi-property fields (same as authenticate middleware)
  const populatedUser = await User.findById(user._id)
    .select('+role')
    .populate({ path: 'properties', select: 'name address' })
    .populate({ path: 'primaryProperty', select: 'name address' })
    .populate({ path: 'hotelId', select: 'name address' })
    .lean();

  // Extract raw hotelId string for JWT (avoid putting full object in token)
  const hotelIdForJwt = refToHotelIdString(populatedUser.hotelId);

  // Generate access token
  const accessToken = jwt.sign(
    { id: populatedUser._id, role: populatedUser.role, hotelId: hotelIdForJwt },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  // Generate refresh token
  const { rawToken: refreshToken } = await createRefreshToken(populatedUser._id);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Set httpOnly cookies
  setAuthCookies(res, accessToken, refreshToken, csrfToken);

  res.json({
    status: 'success',
    user: populatedUser
  });
}));

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */
router.get('/me', authenticate, authorizePolicy('auth', 'baseAccess'), catchAsync(async (req, res) => {
  // Return populated hotelId to frontend for property name display
  const userResponse = { ...req.user };
  if (req.user.hotelIdPopulated) {
    userResponse.hotelId = req.user.hotelIdPopulated;
  }
  res.json({
    status: 'success',
    user: userResponse
  });
}));

const HOTEL_SWITCH_ROLES = new Set(['admin', 'manager', 'staff', 'frontdesk', 'housekeeping']);

router.post(
  '/switch-hotel',
  authenticate,
  authorizePolicy('auth', 'baseAccess'),
  validate(schemas.switchHotel),
  catchAsync(async (req, res) => {
    const { hotelId } = req.body;
    if (!HOTEL_SWITCH_ROLES.has(req.user.role)) {
      throw new ApplicationError('Property switching is not enabled for this account type', 403);
    }
    await assertUserCanAccessHotel(req.user, hotelId);

    await User.findByIdAndUpdate(req.user._id, { $set: { hotelId } });

    const user = await User.findById(req.user._id)
      .select('+role')
      .populate({ path: 'properties', select: 'name address' })
      .populate({ path: 'primaryProperty', select: 'name address' })
      .populate({ path: 'hotelId', select: 'name address' })
      .lean();

    // Extract raw hotelId string for JWT (avoid putting full object in token)
    const hotelIdForJwt = refToHotelIdString(user.hotelId);

    const accessToken = jwt.sign(
      { id: user._id, role: user.role, hotelId: hotelIdForJwt },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const { rawToken: refreshToken } = await createRefreshToken(user._id);
    const csrfToken = crypto.randomBytes(32).toString('hex');
    setAuthCookies(res, accessToken, refreshToken, csrfToken);

    res.json({
      status: 'success',
      user
    });
  })
);

/**
 * @swagger
 * /auth/profile:
 *   patch:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               preferences:
 *                 type: object
 *                 properties:
 *                   bedType:
 *                     type: string
 *                     enum: [single, double, queen, king]
 *                   floor:
 *                     type: string
 *                   smokingAllowed:
 *                     type: boolean
 *                   other:
 *                     type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.patch('/profile', authenticate, authorizePolicy('auth', 'baseAccess'), validate(schemas.updateProfile), catchAsync(async (req, res) => {
  const { name, phone, preferences } = req.body;
  
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (phone !== undefined) updateData.phone = phone;
  if (preferences !== undefined) updateData.preferences = preferences;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  );

  // Sync profile data to UserPreference and GuestCRMProfile
  const ProfileSyncService = (await import('../services/profileSyncService.js')).default;
  await ProfileSyncService.syncAll(user._id).catch(err => logger.warn('ProfileSyncService.syncAll failed:', err.message));

  res.json({
    status: 'success',
    user
  });
}));

/**
 * @swagger
 * /auth/change-password:
 *   patch:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.patch('/change-password', authenticate, passwordChangeLimiter, authorizePolicy('auth', 'baseAccess'), validate(schemas.changePassword), catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  if (!(await user.comparePassword(currentPassword))) {
    throw new ApplicationError('Current password is incorrect', 401);
  }

  // Password hashing is handled by the pre-save hook, so we must use save()
  // here. The race window is acceptable because password changes are
  // user-specific and serialized by the authentication check above.
  user.password = newPassword;
  await user.save();

  // Invalidate all refresh tokens for this user (force re-login on all devices)
  await RefreshToken.deleteMany({ userId: user._id });

  res.json({
    status: 'success',
    message: 'Password updated successfully'
  });
}));

// Refresh access token using refresh token cookie
router.post('/refresh', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;

  if (!rawRefreshToken) {
    throw new ApplicationError('No refresh token provided', 401);
  }

  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  const storedToken = await RefreshToken.findOne({ tokenHash });

  if (!storedToken) {
    throw new ApplicationError('Invalid refresh token', 401);
  }

  if (storedToken.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ _id: storedToken._id });
    clearAuthCookies(res);
    throw new ApplicationError('Refresh token expired', 401);
  }

  // Replay attack detection: if token was already used, invalidate entire family
  if (storedToken.isUsed) {
    logger.warn('Refresh token replay detected, invalidating family', {
      userId: storedToken.userId,
      family: storedToken.family
    });
    await RefreshToken.deleteMany({ family: storedToken.family });
    clearAuthCookies(res);
    throw new ApplicationError('Token reuse detected. Please login again.', 401);
  }

  // Mark current token as used atomically
  const markedToken = await RefreshToken.findOneAndUpdate(
    { _id: storedToken._id, isUsed: false },
    { $set: { isUsed: true } },
    { new: true }
  );

  // If the atomic update failed, another request already used this token (replay)
  if (!markedToken) {
    logger.warn('Refresh token concurrent reuse detected, invalidating family', {
      userId: storedToken.userId,
      family: storedToken.family
    });
    await RefreshToken.deleteMany({ family: storedToken.family });
    clearAuthCookies(res);
    throw new ApplicationError('Token reuse detected. Please login again.', 401);
  }

  // Verify user still exists and is active
  const user = await User.findById(storedToken.userId).select('+role').lean();
  if (!user || !user.isActive) {
    await RefreshToken.deleteMany({ family: storedToken.family });
    clearAuthCookies(res);
    throw new ApplicationError('User no longer valid', 401);
  }

  // Issue new token pair (same family for rotation tracking)
  const newAccessToken = jwt.sign(
    { id: user._id, role: user.role, hotelId: user.hotelId },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

  await RefreshToken.create({
    tokenHash: newTokenHash,
    userId: user._id,
    family: storedToken.family,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const csrfToken = crypto.randomBytes(32).toString('hex');
  setAuthCookies(res, newAccessToken, newRawRefreshToken, csrfToken);

  res.json({
    status: 'success',
    user
  });
}));

// Logout -- clear cookies and invalidate refresh token family
router.post('/logout', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
  const rawRefreshToken = req.cookies?.refreshToken;

  if (rawRefreshToken) {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const storedToken = await RefreshToken.findOne({ tokenHash }).lean();
    if (storedToken) {
      // Invalidate entire token family
      await RefreshToken.deleteMany({ family: storedToken.family });
    }
  }

  clearAuthCookies(res);

  res.json({
    status: 'success',
    message: 'Logged out successfully'
  });
}));

/**
 * POST /auth/rez-sso
 * Log into PMS using a REZ access token (2-step verify via REZ Auth Service).
 * Creates or links a PMS User by phone number.
 *
 * Body: { rez_access_token: string, hotel_id?: string }
 */
router.post('/rez-sso', authLimiter, catchAsync(async (req, res) => {
  const { rez_access_token, hotel_id } = req.body;

  if (!rez_access_token) {
    throw new ApplicationError('rez_access_token is required', 400);
  }

  const { verifyRezTokenForPms } = await import('../services/rezOtaConnector.js');
  const rezProfile = await verifyRezTokenForPms(rez_access_token);

  // Find or create PMS user by rezUserId or phone
  let user = await User.findOne({
    $or: [
      { rezUserId: rezProfile.rezUserId },
      { phone: rezProfile.phone },
    ],
  }).populate('hotelId');

  const isNewUser = !user;

  if (!user) {
    // Create guest/staff user from REZ profile
    user = await User.create({
      name: rezProfile.name || rezProfile.phone,
      phone: rezProfile.phone,
      rezUserId: rezProfile.rezUserId,
      role: 'guest',
      ...(hotel_id && { hotelId: hotel_id }),
      emailVerified: true,  // REZ verified via OTP
    });
  } else if (!user.rezUserId) {
    // Link existing PMS user to REZ identity
    user = await User.findByIdAndUpdate(
      user._id,
      { $set: { rezUserId: rezProfile.rezUserId } },
      { new: true }
    ).populate('hotelId');
  }

  const hotelIdForJwt = user.hotelId?._id?.toString() || user.hotelId?.toString() || null;

  const accessToken = jwt.sign(
    { id: user._id, role: user.role, hotelId: hotelIdForJwt },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );

  const { rawToken: refreshToken } = await createRefreshToken(user._id);
  const csrfToken = crypto.randomBytes(32).toString('hex');

  setAuthCookies(res, accessToken, refreshToken, csrfToken);

  // Update last login
  await User.findByIdAndUpdate(user._id, { $set: { lastLogin: new Date() } });

  res.json({
    status: 'success',
    is_new_user: isNewUser,
    user: {
      id: user._id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      rez_user_id: user.rezUserId,
    },
  });
}));

export default router;
