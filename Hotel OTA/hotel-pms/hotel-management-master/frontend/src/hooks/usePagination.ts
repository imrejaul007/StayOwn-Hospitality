import { useState, useCallback, useMemo } from 'react';
import { DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from '../services/api';

export interface PaginationState {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  pages: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
}

export interface UsePaginationReturn {
  /** Current page (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total item count (set via setMeta) */
  total: number;
  /** Total pages (set via setMeta) */
  totalPages: number;
  /** Go to a specific page */
  setPage: (page: number) => void;
  /** Change items per page (resets to page 1) */
  setLimit: (limit: number) => void;
  /** Update total/pages from API response pagination metadata */
  setMeta: (meta: { total?: number; pages?: number }) => void;
  /** Reset to page 1 (useful when filters change) */
  resetPage: () => void;
  /** Query params object ready to spread into API calls */
  queryParams: { page: number; limit: number };
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPrevPage: boolean;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  prevPage: () => void;
}

/**
 * Standardized pagination hook for list pages.
 *
 * Usage:
 * ```tsx
 * const pagination = usePagination({ initialLimit: 20 });
 *
 * const { data } = useQuery({
 *   queryKey: ['bookings', pagination.queryParams],
 *   queryFn: () => bookingService.getBookings(pagination.queryParams),
 *   onSuccess: (res) => pagination.setMeta(res.pagination),
 * });
 *
 * // In JSX:
 * <Pagination
 *   currentPage={pagination.page}
 *   totalPages={pagination.totalPages}
 *   totalItems={pagination.total}
 *   itemsPerPage={pagination.limit}
 *   onPageChange={pagination.setPage}
 *   onItemsPerPageChange={pagination.setLimit}
 * />
 * ```
 */
export function usePagination(options: UsePaginationOptions = {}): UsePaginationReturn {
  const { initialPage = DEFAULT_PAGE, initialLimit = DEFAULT_LIMIT } = options;

  const [page, setPageRaw] = useState(initialPage);
  const [limit, setLimitRaw] = useState(Math.min(initialLimit, MAX_LIMIT));
  const [meta, setMetaRaw] = useState<PaginationMeta>({ total: 0, pages: 0 });

  const setPage = useCallback((p: number) => {
    setPageRaw(Math.max(1, p));
  }, []);

  const setLimit = useCallback((l: number) => {
    setLimitRaw(Math.min(Math.max(1, l), MAX_LIMIT));
    setPageRaw(1); // reset to page 1 when limit changes
  }, []);

  const setMeta = useCallback((m: { total?: number; pages?: number }) => {
    setMetaRaw((prev) => ({
      total: m.total ?? prev.total,
      pages: m.pages ?? prev.pages,
    }));
  }, []);

  const resetPage = useCallback(() => setPageRaw(1), []);

  const hasNextPage = page < meta.pages;
  const hasPrevPage = page > 1;

  const nextPage = useCallback(() => {
    if (hasNextPage) setPageRaw((p) => p + 1);
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) setPageRaw((p) => p - 1);
  }, [hasPrevPage]);

  const queryParams = useMemo(() => ({ page, limit }), [page, limit]);

  return {
    page,
    limit,
    total: meta.total,
    totalPages: meta.pages,
    setPage,
    setLimit,
    setMeta,
    resetPage,
    queryParams,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
  };
}

export default usePagination;
