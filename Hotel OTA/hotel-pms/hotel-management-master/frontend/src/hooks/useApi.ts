import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { AxiosRequestConfig, AxiosError } from 'axios';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions extends AxiosRequestConfig {
  /** Skip the initial fetch on mount */
  skip?: boolean;
}

/**
 * Custom hook for API calls with automatic AbortController cleanup.
 * Aborts in-flight requests on unmount or when dependencies change.
 *
 * @example
 * const { data, loading, error, refetch } = useApi<Booking[]>('/bookings', { params: { status: 'confirmed' } });
 */
export function useApi<T = unknown>(url: string, options?: UseApiOptions, deps: unknown[] = []) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: !options?.skip,
    error: null,
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await api.get<{ data: T }>(url, {
        ...options,
        signal: controller.signal,
      });
      // Don't update state if request was aborted
      if (!controller.signal.aborted) {
        setState({ data: response.data?.data ?? response.data as unknown as T, loading: false, error: null });
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        const axiosError = err as AxiosError<{ message?: string }>;
        setState({
          data: null,
          loading: false,
          error: axiosError.response?.data?.message || axiosError.message || 'Request failed',
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    if (!options?.skip) {
      fetchData();
    }

    return () => {
      // Cleanup: abort on unmount or deps change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, options?.skip]);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return { ...state, refetch: fetchData, abort };
}

export default useApi;
