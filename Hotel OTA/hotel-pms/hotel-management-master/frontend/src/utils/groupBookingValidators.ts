// Group Booking Validation Utilities

import { validateEmail, validatePhone, type ValidationResult, type FieldValidationErrors } from './corporateValidators';

/**
 * Event type validation
 */
export const validateEventType = (eventType: string): ValidationResult => {
  const allowedEventTypes = ['conference', 'training', 'meeting', 'team_building', 'other'];

  if (!eventType || !eventType.trim()) {
    return { isValid: false, error: 'Event type is required' };
  }

  if (!allowedEventTypes.includes(eventType)) {
    return { isValid: false, error: 'Invalid event type selected' };
  }

  return { isValid: true };
};

/**
 * Date validation for check-in and check-out
 */
export const validateCheckInDate = (checkInDate: string): ValidationResult => {
  if (!checkInDate) {
    return { isValid: false, error: 'Check-in date is required' };
  }

  const checkIn = new Date(checkInDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare dates only

  if (isNaN(checkIn.getTime())) {
    return { isValid: false, error: 'Invalid check-in date format' };
  }

  if (checkIn < today) {
    return { isValid: false, error: 'Check-in date cannot be in the past' };
  }

  return { isValid: true };
};

export const validateCheckOutDate = (checkInDate: string, checkOutDate: string): ValidationResult => {
  if (!checkOutDate) {
    return { isValid: false, error: 'Check-out date is required' };
  }

  if (!checkInDate) {
    return { isValid: false, error: 'Check-in date must be selected first' };
  }

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  if (isNaN(checkOut.getTime())) {
    return { isValid: false, error: 'Invalid check-out date format' };
  }

  if (checkOut <= checkIn) {
    return { isValid: false, error: 'Check-out date must be after check-in date' };
  }

  // Check if stay is too long (max 30 days)
  const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  if (nights > 30) {
    return { isValid: false, error: 'Maximum stay duration is 30 nights' };
  }

  return { isValid: true };
};

/**
 * Room quantity validation
 */
export const validateRoomQuantity = (quantity: number): ValidationResult => {
  if (!quantity || quantity < 1) {
    return { isValid: false, error: 'At least 1 room is required' };
  }

  if (quantity > 50) {
    return { isValid: false, error: 'Maximum 50 rooms allowed per group booking' };
  }

  return { isValid: true };
};

/**
 * Guest name validation
 */
export const validateGuestName = (name: string): ValidationResult => {
  if (!name || !name.trim()) {
    return { isValid: false, error: 'Guest name is required' };
  }

  if (name.length < 2) {
    return { isValid: false, error: 'Guest name must be at least 2 characters' };
  }

  if (name.length > 100) {
    return { isValid: false, error: 'Guest name cannot exceed 100 characters' };
  }

  // Check for valid name pattern (letters, spaces, hyphens, apostrophes)
  const namePattern = /^[a-zA-Z\s\-'\.]+$/;
  if (!namePattern.test(name)) {
    return { isValid: false, error: 'Guest name contains invalid characters' };
  }

  return { isValid: true };
};

/**
 * Employee ID validation
 */
export const validateEmployeeId = (employeeId: string): ValidationResult => {
  // Employee ID is optional
  if (!employeeId || !employeeId.trim()) {
    return { isValid: true };
  }

  if (employeeId.length > 50) {
    return { isValid: false, error: 'Employee ID cannot exceed 50 characters' };
  }

  // Allow alphanumeric characters, hyphens, and underscores
  const employeeIdPattern = /^[a-zA-Z0-9\-_]+$/;
  if (!employeeIdPattern.test(employeeId)) {
    return { isValid: false, error: 'Employee ID can only contain letters, numbers, hyphens, and underscores' };
  }

  return { isValid: true };
};

/**
 * Department validation
 */
export const validateDepartment = (department: string): ValidationResult => {
  // Department is optional
  if (!department || !department.trim()) {
    return { isValid: true };
  }

  if (department.length > 100) {
    return { isValid: false, error: 'Department name cannot exceed 100 characters' };
  }

  return { isValid: true };
};

/**
 * Special requests validation
 */
export const validateSpecialRequests = (requests: string): ValidationResult => {
  // Special requests are optional
  if (!requests || !requests.trim()) {
    return { isValid: true };
  }

  if (requests.length > 500) {
    return { isValid: false, error: 'Special requests cannot exceed 500 characters' };
  }

  return { isValid: true };
};

/**
 * Event name validation
 */
export const validateEventName = (eventName: string): ValidationResult => {
  if (!eventName || !eventName.trim()) {
    return { isValid: false, error: 'Event name is required' };
  }

  if (eventName.length < 3) {
    return { isValid: false, error: 'Event name must be at least 3 characters' };
  }

  if (eventName.length > 200) {
    return { isValid: false, error: 'Event name cannot exceed 200 characters' };
  }

  return { isValid: true };
};

/**
 * Event description validation
 */
export const validateEventDescription = (description: string): ValidationResult => {
  // Event description is optional
  if (!description || !description.trim()) {
    return { isValid: true };
  }

  if (description.length > 1000) {
    return { isValid: false, error: 'Event description cannot exceed 1000 characters' };
  }

  return { isValid: true };
};

/**
 * Room type validation
 */
export const validateRoomType = (roomType: string): ValidationResult => {
  const allowedRoomTypes = ['single', 'double', 'suite', 'deluxe'];

  if (!roomType || !roomType.trim()) {
    return { isValid: false, error: 'Room type is required' };
  }

  if (!allowedRoomTypes.includes(roomType)) {
    return { isValid: false, error: 'Invalid room type selected' };
  }

  return { isValid: true };
};

/**
 * Payment method validation
 */
export const validatePaymentMethod = (paymentMethod: string): ValidationResult => {
  const allowedPaymentMethods = ['corporate_credit', 'direct_billing', 'advance_payment'];

  if (!paymentMethod || !paymentMethod.trim()) {
    return { isValid: false, error: 'Payment method is required' };
  }

  if (!allowedPaymentMethods.includes(paymentMethod)) {
    return { isValid: false, error: 'Invalid payment method selected' };
  }

  return { isValid: true };
};

/**
 * Validate single room in group booking
 */
export const validateGroupBookingRoom = (room: Record<string, string>, index: number): FieldValidationErrors => {
  const errors: FieldValidationErrors = {};

  // Guest name validation
  const nameValidation = validateGuestName(room.guestName);
  if (!nameValidation.isValid) {
    errors[`room_${index}_guestName`] = nameValidation.error!;
  }

  // Guest email validation (optional)
  if (room.guestEmail) {
    const emailValidation = validateEmail(room.guestEmail);
    if (!emailValidation.isValid) {
      errors[`room_${index}_guestEmail`] = emailValidation.error!;
    }
  }

  // Guest phone validation (optional)
  if (room.guestPhone) {
    const phoneValidation = validatePhone(room.guestPhone);
    if (!phoneValidation.isValid) {
      errors[`room_${index}_guestPhone`] = phoneValidation.error!;
    }
  }

  // Employee ID validation (optional)
  const employeeIdValidation = validateEmployeeId(room.employeeId);
  if (!employeeIdValidation.isValid) {
    errors[`room_${index}_employeeId`] = employeeIdValidation.error!;
  }

  // Department validation (optional)
  const departmentValidation = validateDepartment(room.department);
  if (!departmentValidation.isValid) {
    errors[`room_${index}_department`] = departmentValidation.error!;
  }

  // Room type validation
  const roomTypeValidation = validateRoomType(room.roomType);
  if (!roomTypeValidation.isValid) {
    errors[`room_${index}_roomType`] = roomTypeValidation.error!;
  }

  // Special requests validation (optional)
  const specialRequestsValidation = validateSpecialRequests(room.specialRequests);
  if (!specialRequestsValidation.isValid) {
    errors[`room_${index}_specialRequests`] = specialRequestsValidation.error!;
  }

  return errors;
};

/**
 * Validate complete group booking form
 */
export const validateGroupBookingForm = (formData: Record<string, unknown>): FieldValidationErrors => {
  const errors: FieldValidationErrors = {};

  // Group name validation
  if (!formData.groupName?.trim()) {
    errors.groupName = 'Group name is required';
  } else if (formData.groupName.length < 3) {
    errors.groupName = 'Group name must be at least 3 characters';
  } else if (formData.groupName.length > 200) {
    errors.groupName = 'Group name cannot exceed 200 characters';
  }

  // Corporate company validation
  if (!formData.corporateCompanyId) {
    errors.corporateCompanyId = 'Corporate company is required';
  }

  // Check-in date validation
  const checkInValidation = validateCheckInDate(formData.checkIn);
  if (!checkInValidation.isValid) {
    errors.checkIn = checkInValidation.error!;
  }

  // Check-out date validation
  const checkOutValidation = validateCheckOutDate(formData.checkIn, formData.checkOut);
  if (!checkOutValidation.isValid) {
    errors.checkOut = checkOutValidation.error!;
  }

  // Payment method validation
  const paymentMethodValidation = validatePaymentMethod(formData.paymentMethod);
  if (!paymentMethodValidation.isValid) {
    errors.paymentMethod = paymentMethodValidation.error!;
  }

  // Rooms validation
  if (!formData.rooms || formData.rooms.length === 0) {
    errors.rooms = 'At least one room is required';
  } else {
    // Validate room quantity
    const roomQuantityValidation = validateRoomQuantity(formData.rooms.length);
    if (!roomQuantityValidation.isValid) {
      errors.rooms = roomQuantityValidation.error!;
    }

    // Validate each room
    (formData.rooms as Record<string, string>[]).forEach((room: Record<string, string>, index: number) => {
      const roomErrors = validateGroupBookingRoom(room, index);
      Object.assign(errors, roomErrors);
    });
  }

  // Contact person validation
  if (!formData.contactPerson?.name?.trim()) {
    errors.contactPersonName = 'Contact person name is required';
  }

  if (!formData.contactPerson?.email?.trim()) {
    errors.contactPersonEmail = 'Contact person email is required';
  } else {
    const contactEmailValidation = validateEmail(formData.contactPerson.email);
    if (!contactEmailValidation.isValid) {
      errors.contactPersonEmail = contactEmailValidation.error!;
    }
  }

  if (!formData.contactPerson?.phone?.trim()) {
    errors.contactPersonPhone = 'Contact person phone is required';
  } else {
    const contactPhoneValidation = validatePhone(formData.contactPerson.phone);
    if (!contactPhoneValidation.isValid) {
      errors.contactPersonPhone = contactPhoneValidation.error!;
    }
  }

  // Event details validation (if provided)
  if (formData.eventDetails) {
    if (formData.eventDetails.eventType) {
      const eventTypeValidation = validateEventType(formData.eventDetails.eventType);
      if (!eventTypeValidation.isValid) {
        errors.eventType = eventTypeValidation.error!;
      }
    }

    if (formData.eventDetails.eventName) {
      const eventNameValidation = validateEventName(formData.eventDetails.eventName);
      if (!eventNameValidation.isValid) {
        errors.eventName = eventNameValidation.error!;
      }
    }

    if (formData.eventDetails.eventDescription) {
      const eventDescValidation = validateEventDescription(formData.eventDetails.eventDescription);
      if (!eventDescValidation.isValid) {
        errors.eventDescription = eventDescValidation.error!;
      }
    }
  }

  // Special instructions validation (optional)
  if (formData.specialInstructions) {
    const specialInstructionsValidation = validateSpecialRequests(formData.specialInstructions);
    if (!specialInstructionsValidation.isValid) {
      errors.specialInstructions = specialInstructionsValidation.error!;
    }
  }

  return errors;
};

/**
 * Parse backend validation errors for group bookings
 */
export const parseGroupBookingBackendErrors = (error: { response?: { data?: { error?: Record<string, unknown> } }; message?: string }): FieldValidationErrors => {
  const errors: FieldValidationErrors = {};

  if (error.response?.data?.error) {
    const errorData = error.response.data.error;

    // Handle Mongoose validation errors
    if (errorData.validationErrors) {
      (errorData.validationErrors as { field: string; message: string }[]).forEach((err: { field: string; message: string }) => {
        errors[err.field] = err.message;
      });
    }

    // Handle specific group booking errors
    if (errorData.code === 'INSUFFICIENT_CREDIT') {
      errors.corporateCompanyId = 'Insufficient corporate credit for this booking';
    }

    if (errorData.code === 'ROOM_UNAVAILABLE') {
      errors.rooms = 'Some requested rooms are not available for the selected dates';
    }

    if (errorData.code === 'INVALID_DATE_RANGE') {
      errors.checkOut = 'Invalid date range selected';
    }

    if (errorData.code === 'COMPANY_INACTIVE') {
      errors.corporateCompanyId = 'Selected corporate company is inactive';
    }

    // Handle general validation error
    if (errorData.code === 'VALIDATION_ERROR' && !errorData.validationErrors) {
      const message = errorData.message.toLowerCase();
      if (message.includes('room')) {
        errors.rooms = errorData.message;
      } else if (message.includes('date')) {
        errors.checkIn = errorData.message;
      } else if (message.includes('company')) {
        errors.corporateCompanyId = errorData.message;
      } else {
        errors.general = errorData.message;
      }
    }
  } else if (error.message) {
    errors.general = error.message;
  }

  return errors;
};

/**
 * Format dates for form display
 */
export const formatDateForInput = (date: string | Date): string => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Calculate nights between dates
 */
export const calculateNights = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Format guest name for display
 */
export const formatGuestName = (name: string): string => {
  if (!name) return '';
  return name.trim().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

/**
 * Generate group code suggestion
 */
export const generateGroupCode = (groupName: string, checkIn: string): string => {
  if (!groupName || !checkIn) return '';

  const namePrefix = groupName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
  const date = new Date(checkIn);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  return `GRP${namePrefix}${year}${month}${day}`;
};