/**
 * Utility type and helper for handling API errors in catch blocks.
 * Use getErrorMessage() to safely extract a message from an unknown error.
 */

export interface ApiErrorShape {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
}

/**
 * Safely extracts an error message from an unknown error.
 * Handles Axios errors, standard Error objects, and unknown types.
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  const apiError = error as ApiErrorShape;
  return apiError?.response?.data?.message
    || apiError?.response?.data?.error
    || apiError?.message
    || fallback;
}

/**
 * Type assertion helper for catch blocks that need to access axios error properties.
 * Usage: const err = asApiError(error);
 */
export function asApiError(error: unknown): ApiErrorShape {
  return error as ApiErrorShape;
}
