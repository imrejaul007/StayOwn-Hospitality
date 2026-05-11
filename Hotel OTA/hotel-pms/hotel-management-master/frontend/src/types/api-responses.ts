// -----------------------------------------------------------------------------
// Generic API response types for the hotel management system
// -----------------------------------------------------------------------------

/**
 * Standard API response wrapper returned by all endpoints.
 *
 * @template T - The shape of the `data` payload.
 */
export interface ApiResponse<T = unknown> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

/**
 * Paginated API response — extends the standard response with pagination
 * metadata so list endpoints can communicate total counts and page info.
 *
 * @template T - The shape of the `data` payload (usually an array type).
 */
export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Structured error returned by the API when a request fails.
 */
export interface ApiError {
  status: 'error';
  message: string;
  statusCode: number;
  /** Field-level validation errors keyed by field name. */
  errors?: Record<string, string>;
}

/**
 * Helper type to extract the data payload from an ApiResponse.
 *
 * @example
 * type Users = ExtractData<ApiResponse<User[]>>; // User[]
 */
export type ExtractData<R> = R extends ApiResponse<infer D> ? D : never;
