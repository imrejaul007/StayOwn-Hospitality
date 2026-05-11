import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^\+?[\d\s-()]{10,}$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// User Authentication Schemas
export const userLoginSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional()
});

export const userRegistrationSchema = z.object({
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters'),
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(strongPasswordRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string(),
  phone: z.string()
    .regex(phoneRegex, 'Invalid phone number format')
    .optional(),
  role: z.enum(['guest', 'staff', 'admin'], {
    errorMap: () => ({ message: 'Role must be guest, staff, or admin' })
  })
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const passwordResetSchema = z.object({
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string()
    .min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'New password must be at least 8 characters')
    .regex(strongPasswordRegex,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmNewPassword: z.string()
}).refine(data => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword']
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

// Room Management Schemas
export const roomSchema = z.object({
  roomNumber: z.string()
    .min(1, 'Room number is required')
    .max(10, 'Room number must be less than 10 characters'),
  type: z.string()
    .min(1, 'Room type is required'),
  floor: z.number()
    .int('Floor must be a whole number')
    .min(0, 'Floor cannot be negative'),
  capacity: z.number()
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(20, 'Capacity cannot exceed 20'),
  baseRate: z.number()
    .min(0, 'Base rate cannot be negative')
    .max(100000, 'Base rate seems too high'),
  amenities: z.array(z.string())
    .min(1, 'At least one amenity is required'),
  status: z.enum(['available', 'occupied', 'maintenance', 'blocked'], {
    errorMap: () => ({ message: 'Invalid room status' })
  }),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
});

// Room Block Management Schemas
export const roomBlockSchema = z.object({
  blockName: z.string()
    .min(3, 'Block name must be at least 3 characters')
    .max(100, 'Block name must be less than 100 characters'),
  groupName: z.string()
    .min(2, 'Group name is required')
    .max(100, 'Group name must be less than 100 characters'),
  startDate: z.date({
    required_error: 'Start date is required',
    invalid_type_error: 'Start date must be a valid date'
  }),
  endDate: z.date({
    required_error: 'End date is required',
    invalid_type_error: 'End date must be a valid date'
  }),
  totalRooms: z.number()
    .int('Total rooms must be a whole number')
    .min(1, 'At least 1 room is required')
    .max(1000, 'Total rooms cannot exceed 1000'),
  roomType: z.string().optional(),
  contactPerson: z.object({
    name: z.string()
      .min(2, 'Contact name is required')
      .max(100, 'Contact name must be less than 100 characters'),
    email: z.string()
      .email('Valid email is required'),
    phone: z.string()
      .regex(phoneRegex, 'Invalid phone number format')
      .optional()
  }),
  specialRequests: z.string()
    .max(1000, 'Special requests must be less than 1000 characters')
    .optional(),
  notes: z.string()
    .max(1000, 'Notes must be less than 1000 characters')
    .optional()
}).refine(data => data.endDate > data.startDate, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// Reservation Schemas
export const reservationSchema = z.object({
  guestName: z.string()
    .min(2, 'Guest name must be at least 2 characters')
    .max(100, 'Guest name must be less than 100 characters'),
  email: z.string()
    .email('Valid email is required'),
  phone: z.string()
    .regex(phoneRegex, 'Invalid phone number format'),
  checkIn: z.date({
    required_error: 'Check-in date is required',
    invalid_type_error: 'Check-in date must be a valid date'
  }),
  checkOut: z.date({
    required_error: 'Check-out date is required',
    invalid_type_error: 'Check-out date must be a valid date'
  }),
  roomType: z.string()
    .min(1, 'Room type is required'),
  guestCount: z.number()
    .int('Guest count must be a whole number')
    .min(1, 'At least 1 guest is required')
    .max(20, 'Guest count cannot exceed 20'),
  specialRequests: z.string()
    .max(500, 'Special requests must be less than 500 characters')
    .optional(),
  paymentMethod: z.enum(['cash', 'card', 'online', 'corporate'], {
    errorMap: () => ({ message: 'Invalid payment method' })
  }).optional()
}).refine(data => data.checkOut > data.checkIn, {
  message: 'Check-out date must be after check-in date',
  path: ['checkOut']
}).refine(data => {
  const daysDifference = (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60 * 24);
  return daysDifference <= 365;
}, {
  message: 'Stay cannot exceed 365 days',
  path: ['checkOut']
});

// Room Assignment Schema
export const roomAssignmentSchema = z.object({
  reservationId: z.string()
    .min(1, 'Reservation ID is required'),
  roomId: z.string()
    .min(1, 'Room ID is required'),
  assignedBy: z.string()
    .min(1, 'Assigned by user ID is required'),
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional(),
  overrideConflicts: z.boolean().optional()
});

// Tape Chart View Schema
export const tapeChartViewSchema = z.object({
  name: z.string()
    .min(3, 'View name must be at least 3 characters')
    .max(50, 'View name must be less than 50 characters'),
  filters: z.object({
    floors: z.array(z.number()).optional(),
    roomTypes: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.date(),
      end: z.date()
    }).optional()
  }),
  layout: z.object({
    groupBy: z.enum(['floor', 'type', 'status', 'none']),
    sortBy: z.enum(['roomNumber', 'type', 'status', 'floor']),
    sortOrder: z.enum(['asc', 'desc'])
  }),
  isDefault: z.boolean().optional()
});

// Booking Schema
export const bookingSchema = z.object({
  guestDetails: z.object({
    firstName: z.string()
      .min(1, 'First name is required')
      .max(50, 'First name must be less than 50 characters'),
    lastName: z.string()
      .min(1, 'Last name is required')
      .max(50, 'Last name must be less than 50 characters'),
    email: z.string()
      .email('Valid email is required'),
    phone: z.string()
      .regex(phoneRegex, 'Invalid phone number format'),
    idType: z.enum(['passport', 'drivingLicense', 'nationalId'], {
      errorMap: () => ({ message: 'Please select a valid ID type' })
    }),
    idNumber: z.string()
      .min(5, 'ID number must be at least 5 characters')
      .max(20, 'ID number must be less than 20 characters')
  }),
  bookingDetails: z.object({
    checkIn: z.date({
      required_error: 'Check-in date is required'
    }),
    checkOut: z.date({
      required_error: 'Check-out date is required'
    }),
    roomType: z.string()
      .min(1, 'Room type is required'),
    guestCount: z.object({
      adults: z.number()
        .int('Number of adults must be a whole number')
        .min(1, 'At least 1 adult is required')
        .max(10, 'Cannot exceed 10 adults'),
      children: z.number()
        .int('Number of children must be a whole number')
        .min(0, 'Children cannot be negative')
        .max(10, 'Cannot exceed 10 children')
    }),
    specialRequests: z.string()
      .max(1000, 'Special requests must be less than 1000 characters')
      .optional()
  }),
  paymentDetails: z.object({
    method: z.enum(['full', 'partial', 'corporate'], {
      errorMap: () => ({ message: 'Please select a payment method' })
    }),
    amount: z.number()
      .min(0, 'Amount cannot be negative'),
    corporateAccount: z.string().optional()
  }).optional()
}).refine(data =>
  data.bookingDetails.checkOut > data.bookingDetails.checkIn, {
  message: 'Check-out date must be after check-in date',
  path: ['bookingDetails', 'checkOut']
});

// Search and Filter Schemas
export const searchSchema = z.object({
  query: z.string()
    .max(100, 'Search query must be less than 100 characters')
    .optional(),
  filters: z.object({
    dateRange: z.object({
      start: z.date().optional(),
      end: z.date().optional()
    }).optional(),
    roomTypes: z.array(z.string()).optional(),
    statuses: z.array(z.string()).optional(),
    floors: z.array(z.number()).optional(),
    priceRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional()
    }).optional()
  }).optional(),
  sort: z.object({
    field: z.string(),
    order: z.enum(['asc', 'desc'])
  }).optional(),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100)
  }).optional()
});

// Bulk Operations Schema
export const bulkOperationSchema = z.object({
  operation: z.enum(['updateStatus', 'assignRooms', 'blockRooms', 'releaseBlocks'], {
    errorMap: () => ({ message: 'Invalid bulk operation' })
  }),
  targets: z.array(z.string())
    .min(1, 'At least one item must be selected for bulk operation')
    .max(100, 'Cannot perform bulk operation on more than 100 items'),
  parameters: z.record(z.any()).optional(),
  confirmOverrides: z.boolean().optional()
});

// Export types for TypeScript inference
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type PasswordReset = z.infer<typeof passwordResetSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type Room = z.infer<typeof roomSchema>;
export type RoomBlock = z.infer<typeof roomBlockSchema>;
export type Reservation = z.infer<typeof reservationSchema>;
export type RoomAssignment = z.infer<typeof roomAssignmentSchema>;
export type TapeChartView = z.infer<typeof tapeChartViewSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Search = z.infer<typeof searchSchema>;
export type BulkOperation = z.infer<typeof bulkOperationSchema>;