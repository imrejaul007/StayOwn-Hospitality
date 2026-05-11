import User from '../models/User.js';
import Hotel from '../models/Hotel.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import crypto from 'crypto';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import logger from '../utils/logger.js';

/**
 * Create a new user (Admin, Manager, Staff only)
 * POST /api/v1/users/create
 */
export const createUser = catchAsync(async (req, res) => {
  const {
    name,
    email,
    phone,
    password,
    role,
    hotelId,
    department,
    employeeId,
    isActive,
    sendWelcomeEmail,
    // Multi-property fields
    properties,
    primaryProperty,
    multiPropertyAccess
  } = req.body;

  // Validation - require essential fields
  if (!name || !email || !password || !role) {
    throw new ApplicationError('Name, email, password, and role are required', 400);
  }

  // Check if email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw new ApplicationError('Email already registered', 400);
  }

  // Validate role - allow all operational staff roles
  const validRoles = ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping'];
  if (!validRoles.includes(role)) {
    throw new ApplicationError('Invalid role. Must be one of: admin, manager, staff, frontdesk, housekeeping', 400);
  }

  if (req.user.role === 'manager' && role === 'admin') {
    throw new ApplicationError('Managers cannot create admin users', 403);
  }

  // For admin/manager/staff, hotelId or primaryProperty is required
  const propertyId = primaryProperty || hotelId;
  if (!propertyId) {
    throw new ApplicationError('Hotel ID or Primary Property is required for this role', 400);
  }

  // Verify property exists
  const property = await Hotel.findById(propertyId).lean();
  if (!property) {
    throw new ApplicationError('Property not found', 404);
  }

  // Permission check: Admins can create users for any property, non-admins only for their properties
  if (req.user.role !== 'admin') {
    const userPropertyIds = req.user.properties?.map(p => p.toString()) || [];
    if (!userPropertyIds.includes(propertyId.toString())) {
      throw new ApplicationError('You can only create users for properties you have access to', 403);
    }
  }

  // Create user object
  const userData = {
    name,
    email: email.toLowerCase(),
    phone,
    password, // Will be hashed by pre-save hook in User model
    role,
    hotelId: propertyId,
    department,
    employeeId,
    isActive: isActive !== undefined ? isActive : true
  };

  // Multi-property support
  if (properties && properties.length > 0) {
    // Verify all properties exist
    const propertiesToAdd = await Hotel.find({
      _id: { $in: properties }
    }).lean().limit(1000);

    if (propertiesToAdd.length !== properties.length) {
      throw new ApplicationError('One or more properties not found', 404);
    }

    // Admins can assign any property, non-admins can only assign properties they have access to
    if (req.user.role !== 'admin') {
      const userPropertyIds = req.user.properties?.map(p => p.toString()) || [];
      const hasAccessToAll = properties.every(propId => userPropertyIds.includes(propId.toString()));

      if (!hasAccessToAll) {
        throw new ApplicationError('You can only assign properties you have access to', 403);
      }
    }

    userData.properties = properties;
    userData.primaryProperty = primaryProperty || propertyId;

    if (multiPropertyAccess) {
      userData.multiPropertyAccess = {
        enabled: true,
        allowedProperties: properties,
        restrictions: {
          canCreateProperties: multiPropertyAccess.canCreateProperties || false,
          canDeleteProperties: multiPropertyAccess.canDeleteProperties || false,
          canManageGroups: multiPropertyAccess.canManageGroups || false
        }
      };
    }
  } else {
    // Single property user
    userData.properties = [propertyId];
    userData.primaryProperty = propertyId;
  }

  // Create user
  const newUser = await User.create(userData);

  // TODO: Send welcome email if requested
  // This would require email service implementation
  if (sendWelcomeEmail) {
    // await sendWelcomeEmail(newUser.email, { name: newUser.name, tempPassword: password });
  }

  // Remove password from response
  const userResponse = newUser.toJSON();
  delete userResponse.password;

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      user: userResponse,
      emailSent: sendWelcomeEmail || false
    }
  });
});

/**
 * Update existing user
 * PUT /api/v1/users/:userId
 */
export const updateUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const {
    name,
    email,
    phone,
    role,
    department,
    employeeId,
    isActive,
    properties,
    primaryProperty,
    multiPropertyAccess,
    password // Optional password update
  } = req.body;

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  if (req.user.role === 'manager' && user.role === 'admin') {
    throw new ApplicationError('Managers cannot update admin users', 403);
  }

  // Verify permission - admins can update any user, others can only update users in their properties
  if (req.user.role !== 'admin') {
    // Non-admin users can only update users within their properties
    if (user.hotelId && !req.user.properties?.includes(user.hotelId.toString())) {
      throw new ApplicationError('You do not have permission to update this user', 403);
    }
  }
  // Admins can update any user - no further checks needed

  // Update basic fields
  if (name) user.name = name;
  if (email) {
    // Check if new email is already taken
    const emailTaken = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: userId }
    }).lean();
    if (emailTaken) {
      throw new ApplicationError('Email already in use', 400);
    }
    user.email = email.toLowerCase();
  }
  if (phone !== undefined) user.phone = phone;
  if (role) {
    const validRoles = ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping'];
    if (!validRoles.includes(role)) {
      throw new ApplicationError('Invalid role. Must be one of: admin, manager, staff, frontdesk, housekeeping', 400);
    }
    if (req.user.role === 'manager' && role === 'admin') {
      throw new ApplicationError('Managers cannot assign admin role', 403);
    }
    user.role = role;
  }
  if (department !== undefined) user.department = department;
  if (employeeId !== undefined) user.employeeId = employeeId;
  if (isActive !== undefined) user.isActive = isActive;

  // Update password if provided
  if (password) {
    user.password = password; // Will be hashed by pre-save hook
  }

  // Update multi-property access
  if (properties) {
    // Verify all properties exist
    const propertiesToAdd = await Hotel.find({
      _id: { $in: properties }
    }).lean().limit(1000);

    if (propertiesToAdd.length !== properties.length) {
      throw new ApplicationError('One or more properties not found', 404);
    }

    // Admins can assign any property, non-admins can only assign properties they have access to
    if (req.user.role !== 'admin') {
      const userPropertyIds = req.user.properties?.map(p => p.toString()) || [];
      const hasAccessToAll = properties.every(propId => userPropertyIds.includes(propId.toString()));

      if (!hasAccessToAll) {
        throw new ApplicationError('You can only assign properties you have access to', 403);
      }
    }

    user.properties = properties;
  }

  if (primaryProperty) {
    user.primaryProperty = primaryProperty;
    user.hotelId = primaryProperty; // Keep in sync
  }

  if (multiPropertyAccess) {
    user.multiPropertyAccess = {
      enabled: multiPropertyAccess.enabled || false,
      allowedProperties: multiPropertyAccess.allowedProperties || user.properties,
      restrictions: {
        canCreateProperties: multiPropertyAccess.canCreateProperties || false,
        canDeleteProperties: multiPropertyAccess.canDeleteProperties || false,
        canManageGroups: multiPropertyAccess.canManageGroups || false
      }
    };
  }

  await user.save();

  // Remove password from response
  const userResponse = user.toJSON();
  delete userResponse.password;

  res.json({
    success: true,
    message: 'User updated successfully',
    data: { user: userResponse }
  });
});

/**
 * Delete user (soft delete - set inactive)
 * DELETE /api/v1/users/:userId
 */
export const deleteUser = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Find user
  const user = await User.findById(userId);
  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Prevent deleting yourself
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApplicationError('You cannot delete your own account', 400);
  }

  // Verify permission - admins can delete any user, others can only delete users in their properties
  if (req.user.role !== 'admin') {
    // Non-admin users can only delete users within their properties
    if (user.hotelId && !req.user.properties?.includes(user.hotelId.toString())) {
      throw new ApplicationError('You do not have permission to delete this user', 403);
    }
  }
  // Admins can delete any user - no further checks needed

  // Soft delete - set inactive instead of removing
  user.isActive = false;
  await user.save();

  res.json({
    success: true,
    message: 'User deleted successfully',
    data: { userId }
  });
});

/**
 * Get list of users
 * GET /api/v1/users
 */
export const getUsers = catchAsync(async (req, res) => {
  const {
    role,
    isActive,
    hotelId,
    search,
    page: rawPage = '1',
    limit: rawLimit = '20',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const page = Math.max(1, parseInt(rawPage) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(rawLimit) || 20));

  // Build query - admins can see all users, non-admins can only see users from their properties
  let query = {};

  logger.debug('User search request', {
    role: req.user.role,
    requestedHotelId: hotelId,
    searchQuery: search,
    requestedRole: role
  });

  // Apply role filter first
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';

  // IMPORTANT: Guest users don't have hotelId - they're shared across hotels
  // Only apply property filtering for staff/admin/manager users, NOT guests
  if (role !== 'guest') {
    if (req.user.role !== 'admin') {
      // Non-admin users can only see staff/admin from properties they have access to
      const userPropertyIds = req.user.properties || [];
      query.hotelId = { $in: userPropertyIds };
      logger.debug('Non-admin filter applied for staff/admin', { propertyCount: userPropertyIds.length });
    } else {
      logger.debug('Admin user - no property filter for staff/admin');
    }

    // Filter by specific property if hotelId is provided (for staff/admin only)
    if (hotelId) {
      query.hotelId = hotelId;
      logger.debug('HotelId filter applied for staff/admin', { hotelId });
    }
  } else {
    logger.debug('Guest role - no hotelId filter');
  }
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: escapedSearch, $options: 'i' } },
      { email: { $regex: escapedSearch, $options: 'i' } },
      { phone: { $regex: escapedSearch, $options: 'i' } }
    ];
    logger.debug('Search filter applied', { search });
  }

  logger.debug('Staff query filter', { query });

  // Pagination
  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password -passwordResetToken -passwordResetExpires')
      .populate('hotelId', 'name address.city')
      .populate('properties', 'name address.city')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(query)
  ]);

  logger.debug('Staff query executed', { totalFound: total, returned: users.length });

  res.json({
    success: true,
    data: { users },
    pagination: {
      current: page,
      pages: Math.ceil(total / limit),
      total,
      limit
    }
  });
});

/**
 * Get single user by ID
 * GET /api/v1/users/:userId
 */
export const getUserById = catchAsync(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('-password -passwordResetToken -passwordResetExpires')
    .populate('hotelId', 'name address.city')
    .populate('properties', 'name address.city').lean();

  if (!user) {
    throw new ApplicationError('User not found', 404);
  }

  // Verify permission - admins can view any user, others can only view users in their properties
  if (req.user.role !== 'admin') {
    // Non-admin users can only view users within their properties
    if (user.hotelId && !req.user.properties?.includes(user.hotelId.toString())) {
      throw new ApplicationError('You do not have permission to view this user', 403);
    }
  }
  // Admins can view any user - no further checks needed

  res.json({
    success: true,
    data: { user }
  });
});

/**
 * Generate temporary password
 * GET /api/v1/users/generate-password
 */
export const generatePassword = catchAsync(async (req, res) => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset.charAt(randomIndex);
  }

  res.json({
    success: true,
    data: { password }
  });
});

export default {
  createUser,
  updateUser,
  deleteUser,
  getUsers,
  getUserById,
  generatePassword
};
