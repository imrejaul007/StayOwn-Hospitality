import { Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';

/**
 * FIX-BUG-17: Enhanced sanitization middleware for XSS and injection prevention
 */

// Patterns for detecting XSS attempts
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,  // event handlers like onclick, onerror
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  /<link/gi,
  /<style/gi,
  /expression\s*\(/gi,  // CSS expression
  /url\s*\(/gi,        // CSS url()
  /data:\s*text\/html/gi,  // data: URLs
];

// MongoDB injection patterns
const NO_SQL_INJECTION_PATTERNS = [
  /\$where/gi,
  /\$eval/gi,
  /\$ne/gi,
  /\$in/gi,
  /\$or/gi,
  /\$and/gi,
  /\$regex/gi,
  /\$exists/gi,
  /\$type/gi,
];

// Dangerous HTML entities
const DANGEROUS_CHARS: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

/**
 * FIX-BUG-17: Encode HTML entities for safe display
 */
export function encodeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, (char) => DANGEROUS_CHARS[char] || char);
}

/**
 * FIX-BUG-17: Strip dangerous content and patterns from strings
 */
export function stripDangerousContent(str: string): string {
  let result = str;

  // Strip HTML tags
  result = result.replace(/<[^>]*>/g, '');

  // Remove XSS patterns
  for (const pattern of XSS_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Remove encoded XSS attempts
  result = result.replace(/&#[xX]?[0-9a-fA-F]+;/gi, '');

  // Remove null bytes (can be used to bypass sanitization)
  result = result.replace(/\0/g, '');

  return result.trim();
}

/**
 * FIX-BUG-17: Check for SQL/NoSQL injection patterns
 */
export function containsInjectionPatterns(str: string): boolean {
  const lower = str.toLowerCase();
  for (const pattern of NO_SQL_INJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * FIX-BUG-17: Comprehensive input sanitization middleware
 * - Sanitizes request body
 * - Sanitizes query parameters
 * - Sanitizes URL parameters
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query as Record<string, any>);
    }

    // Sanitize URL parameters (params)
    if (req.params && typeof req.params === 'object') {
      sanitizeObject(req.params as Record<string, any>);
    }
  } catch (err) {
    // Log but don't fail the request - let the route handler deal with invalid data
    console.error('[SANITIZE] Error during sanitization:', err);
  }

  next();
}

function sanitizeObject(obj: Record<string, any>, path: string = ''): void {
  for (const key in obj) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      // FIX-BUG-17: Apply comprehensive sanitization
      let sanitized = stripDangerousContent(value);

      // Check for injection patterns (log but don't block - let route validation handle it)
      if (containsInjectionPatterns(value)) {
        logger.warn(`[SANITIZE] Potential injection pattern detected at ${currentPath}`);
      }

      obj[key] = sanitized;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitizeObject(value, currentPath);
    } else if (Array.isArray(value)) {
      // Sanitize arrays
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          value[i] = stripDangerousContent(value[i]);
        } else if (typeof value[i] === 'object' && value[i] !== null) {
          sanitizeObject(value[i], `${currentPath}[${i}]`);
        }
      }
    }
  }
}

/**
 * FIX-BUG-17: Sanitize text for safe HTML display (use when rendering user input in HTML)
 * Unlike stripDangerousContent, this ENCODES characters rather than removing them
 */
export function sanitizeForHtmlDisplay(text: string): string {
  if (!text) return '';
  return encodeHtml(text);
}

/**
 * FIX-BUG-17: Validate string contains only safe characters for specific use cases
 */
export function validateSafeString(str: string, allowNewlines: boolean = false): boolean {
  const pattern = allowNewlines
    ? /^[a-zA-Z0-9\s\-_.@+,]+$/
    : /^[a-zA-Z0-9\s\-_.@+,]+$/;
  return pattern.test(str);
}
