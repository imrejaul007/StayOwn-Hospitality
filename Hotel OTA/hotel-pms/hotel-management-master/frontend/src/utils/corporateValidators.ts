// Corporate Company Validation Utilities

/**
 * Email validation pattern - matches backend validation
 */
const EMAIL_REGEX = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;

/**
 * GST Number validation pattern - matches backend validation
 * Format: 22AAAAA0000A1Z5 (15 characters)
 * - First 2 digits: State code (01-37)
 * - Next 10 characters: PAN number of the business entity
 * - 13th character: Entity number (1-9 or A-Z)
 * - 14th character: Z (default)
 * - 15th character: Check digit (0-9 or A-Z)
 */
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * PAN Number validation pattern - matches backend validation
 * Format: AAAAA9999A (10 characters)
 * - First 5 characters: Alphabets
 * - Next 4 characters: Numbers
 * - Last character: Alphabet
 */
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/**
 * Phone number validation pattern - matches backend validation
 * Allows optional +, digits, spaces, hyphens, and parentheses
 */
const PHONE_REGEX = /^\+?[\d\s-()]+$/;

/**
 * ZIP code validation pattern
 * Indian PIN code format: 6 digits
 */
const ZIP_REGEX = /^[0-9]{6}$/;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface FieldValidationErrors {
  [key: string]: string;
}

/**
 * Validate email address
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || !email.trim()) {
    return { isValid: false, error: 'Email is required' };
  }

  if (!EMAIL_REGEX.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
};

/**
 * Validate GST number
 */
export const validateGST = (gstNumber: string): ValidationResult => {
  if (!gstNumber || !gstNumber.trim()) {
    return { isValid: false, error: 'GST number is required' };
  }

  // Convert to uppercase for validation
  const upperGST = gstNumber.toUpperCase();

  if (!GST_REGEX.test(upperGST)) {
    return {
      isValid: false,
      error: 'Invalid GST format. Example: 22AAAAA0000A1Z5'
    };
  }

  // Additional validation for state code
  const stateCode = parseInt(upperGST.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    return {
      isValid: false,
      error: 'Invalid state code in GST number (must be 01-37)'
    };
  }

  return { isValid: true };
};

/**
 * Validate PAN number
 */
export const validatePAN = (panNumber: string): ValidationResult => {
  if (!panNumber || !panNumber.trim()) {
    // PAN is optional in the backend
    return { isValid: true };
  }

  // Convert to uppercase for validation
  const upperPAN = panNumber.toUpperCase();

  if (!PAN_REGEX.test(upperPAN)) {
    return {
      isValid: false,
      error: 'Invalid PAN format. Example: AAAAA9999A'
    };
  }

  return { isValid: true };
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): ValidationResult => {
  if (!phone || !phone.trim()) {
    // Phone is optional in the backend
    return { isValid: true };
  }

  if (!PHONE_REGEX.test(phone)) {
    return {
      isValid: false,
      error: 'Please enter a valid phone number'
    };
  }

  // Check minimum length
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      error: 'Phone number must have at least 10 digits'
    };
  }

  return { isValid: true };
};

/**
 * Validate ZIP/PIN code
 */
export const validateZIP = (zipCode: string): ValidationResult => {
  if (!zipCode || !zipCode.trim()) {
    return { isValid: false, error: 'ZIP code is required' };
  }

  if (!ZIP_REGEX.test(zipCode)) {
    return {
      isValid: false,
      error: 'Invalid ZIP code. Must be 6 digits'
    };
  }

  return { isValid: true };
};

/**
 * Validate credit limit
 */
export const validateCreditLimit = (creditLimit: number): ValidationResult => {
  if (creditLimit < 0) {
    return {
      isValid: false,
      error: 'Credit limit cannot be negative'
    };
  }

  if (creditLimit > 100000000) {
    return {
      isValid: false,
      error: 'Credit limit cannot exceed ₹10,00,00,000'
    };
  }

  return { isValid: true };
};

/**
 * Validate payment terms
 */
export const validatePaymentTerms = (paymentTerms: number): ValidationResult => {
  const allowedTerms = [15, 30, 45, 60, 90];

  if (!allowedTerms.includes(paymentTerms)) {
    return {
      isValid: false,
      error: 'Payment terms must be 15, 30, 45, 60, or 90 days'
    };
  }

  return { isValid: true };
};

/**
 * Format GST number to uppercase
 */
export const formatGST = (gstNumber: string): string => {
  return gstNumber.toUpperCase().replace(/[^0-9A-Z]/g, '');
};

/**
 * Format PAN number to uppercase
 */
export const formatPAN = (panNumber: string): string => {
  return panNumber.toUpperCase().replace(/[^0-9A-Z]/g, '');
};

/**
 * Format phone number
 */
export const formatPhone = (phone: string): string => {
  // Remove all non-digit characters except + at the beginning
  const cleaned = phone.replace(/[^\d+]/g, '');

  // Indian phone number formatting
  if (cleaned.startsWith('+91')) {
    const number = cleaned.substring(3);
    if (number.length === 10) {
      return `+91-${number.substring(0, 5)}-${number.substring(5)}`;
    }
  } else if (cleaned.length === 10) {
    return `${cleaned.substring(0, 5)}-${cleaned.substring(5)}`;
  }

  return cleaned;
};

/**
 * Validate all company form fields
 */
export const validateCompanyForm = (formData: Record<string, unknown>): FieldValidationErrors => {
  const errors: FieldValidationErrors = {};

  // Company name
  if (!formData.name?.trim()) {
    errors.name = 'Company name is required';
  } else if (formData.name.length > 200) {
    errors.name = 'Company name cannot exceed 200 characters';
  }

  // Email
  const emailValidation = validateEmail(formData.email);
  if (!emailValidation.isValid) {
    errors.email = emailValidation.error!;
  }

  // Phone (optional)
  if (formData.phone) {
    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.isValid) {
      errors.phone = phoneValidation.error!;
    }
  }

  // GST Number
  const gstValidation = validateGST(formData.gstNumber);
  if (!gstValidation.isValid) {
    errors.gstNumber = gstValidation.error!;
  }

  // PAN Number (optional)
  if (formData.panNumber) {
    const panValidation = validatePAN(formData.panNumber);
    if (!panValidation.isValid) {
      errors.panNumber = panValidation.error!;
    }
  }

  // Address validation
  if (!formData.address?.street?.trim()) {
    errors.street = 'Street address is required';
  }

  if (!formData.address?.city?.trim()) {
    errors.city = 'City is required';
  }

  if (!formData.address?.state?.trim()) {
    errors.state = 'State is required';
  }

  const zipValidation = validateZIP(formData.address?.zipCode || '');
  if (!zipValidation.isValid) {
    errors.zipCode = zipValidation.error!;
  }

  // Credit limit
  const creditValidation = validateCreditLimit(formData.creditLimit);
  if (!creditValidation.isValid) {
    errors.creditLimit = creditValidation.error!;
  }

  // Payment terms
  const termsValidation = validatePaymentTerms(formData.paymentTerms);
  if (!termsValidation.isValid) {
    errors.paymentTerms = termsValidation.error!;
  }

  // HR Contacts validation
  if (formData.hrContacts && formData.hrContacts.length > 0) {
    let hasPrimary = false;

    (formData.hrContacts as Record<string, unknown>[]).forEach((contact: Record<string, unknown>, index: number) => {
      if (contact.name || contact.email || contact.phone) {
        // If any field is filled, name and email are required
        if (!contact.name?.trim()) {
          errors[`hrContact_${index}_name`] = 'HR contact name is required';
        }

        const hrEmailValidation = validateEmail(contact.email);
        if (!hrEmailValidation.isValid) {
          errors[`hrContact_${index}_email`] = hrEmailValidation.error!;
        }

        if (contact.phone) {
          const hrPhoneValidation = validatePhone(contact.phone);
          if (!hrPhoneValidation.isValid) {
            errors[`hrContact_${index}_phone`] = hrPhoneValidation.error!;
          }
        }

        if (contact.isPrimary) {
          hasPrimary = true;
        }
      }
    });

    if (!hasPrimary && (formData.hrContacts as Record<string, unknown>[]).some((c: Record<string, unknown>) => c.name || c.email)) {
      errors.hrContacts = 'At least one HR contact must be marked as primary';
    }
  }

  return errors;
};

/**
 * Parse backend validation errors
 */
export const parseBackendErrors = (error: { response?: { data?: { error?: Record<string, unknown> } }; message?: string }): FieldValidationErrors => {
  const errors: FieldValidationErrors = {};

  if (error.response?.data?.error) {
    const errorData = error.response.data.error;

    // Handle Mongoose validation errors
    if (errorData.validationErrors) {
      (errorData.validationErrors as { field: string; message: string }[]).forEach((err: { field: string; message: string }) => {
        errors[err.field] = err.message;
      });
    }

    // Handle duplicate key errors
    if (errorData.code === 'DUPLICATE_ENTRY') {
      if (errorData.field === 'gstNumber') {
        errors.gstNumber = 'This GST number is already registered';
      } else if (errorData.field === 'email') {
        errors.email = 'This email is already in use';
      } else {
        errors[errorData.field] = errorData.message;
      }
    }

    // Handle general validation error
    if (errorData.code === 'VALIDATION_ERROR' && !errorData.validationErrors) {
      // Try to map the message to a specific field
      const message = errorData.message.toLowerCase();
      if (message.includes('email')) {
        errors.email = errorData.message;
      } else if (message.includes('gst')) {
        errors.gstNumber = errorData.message;
      } else if (message.includes('pan')) {
        errors.panNumber = errorData.message;
      } else {
        errors.general = errorData.message;
      }
    }
  } else if (error.message) {
    errors.general = error.message;
  }

  return errors;
};