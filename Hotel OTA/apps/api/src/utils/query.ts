import { Request } from 'express';

/**
 * Type-safe query parameter extraction.
 * Express query params can be string | string[] | undefined.
 * This always returns string | undefined.
 */
export function q(req: Request, key: string): string | undefined {
  const val = req.query[key];
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0] as string;
  return undefined;
}

/**
 * FIX-BUG-8: Safe integer parsing with NaN validation
 * parseInt("abc") returns NaN silently - this validates before returning
 */
export function qInt(req: Request, key: string): number | undefined {
  const val = q(req, key);
  if (!val) return undefined;
  const parsed = parseInt(val, 10);
  // FIX-BUG-8: Check for NaN to prevent silent failures in calculations
  if (isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

/**
 * FIX-BUG-8: Safe float parsing with NaN validation
 */
export function qFloat(req: Request, key: string): number | undefined {
  const val = q(req, key);
  if (!val) return undefined;
  const parsed = parseFloat(val);
  // FIX-BUG-8: Check for NaN to prevent silent failures
  if (isNaN(parsed)) {
    return undefined;
  }
  return parsed;
}

/**
 * FIX-BUG-8: Parse integer with validation and bounds checking
 * @param req Express request
 * @param key Query parameter key
 * @param options Optional constraints (min, max)
 */
export function qIntStrict(req: Request, key: string, options?: { min?: number; max?: number }): number | undefined {
  const val = qInt(req, key);
  if (val === undefined) return undefined;

  if (options?.min !== undefined && val < options.min) {
    return undefined;
  }
  if (options?.max !== undefined && val > options.max) {
    return undefined;
  }
  return val;
}

/**
 * FIX-BUG-8: Parse float with validation and bounds checking
 * @param req Express request
 * @param key Query parameter key
 * @param options Optional constraints (min, max)
 */
export function qFloatStrict(req: Request, key: string, options?: { min?: number; max?: number }): number | undefined {
  const val = qFloat(req, key);
  if (val === undefined) return undefined;

  if (options?.min !== undefined && val < options.min) {
    return undefined;
  }
  if (options?.max !== undefined && val > options.max) {
    return undefined;
  }
  return val;
}
