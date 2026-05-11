import { useState, useCallback, useMemo } from 'react';

interface LoadingState {
  [key: string]: boolean;
}

export const useLoading = () => {
  const [loading, setLoadingState] = useState<LoadingState>({});

  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [key]: isLoading
    }));
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) {
      return Boolean(loading[key]);
    }
    // If no key provided, check if any operation is loading
    return Object.values(loading).some(state => state === true);
  }, [loading]);

  const clearAllLoading = useCallback(() => {
    setLoadingState({});
  }, []);

  const getLoadingCount = useMemo(() => {
    return () => Object.values(loading).filter(state => state === true).length;
  }, [loading]);

  const getLoadingKeys = useMemo(() => {
    return () => Object.keys(loading).filter(key => loading[key] === true);
  }, [loading]);

  const withLoading = useCallback(async <T>(
    key: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    setLoading(key, true);
    try {
      const result = await operation();
      return result;
    } finally {
      setLoading(key, false);
    }
  }, [setLoading]);

  return {
    loading,
    setLoading,
    isLoading,
    clearAllLoading,
    getLoadingCount,
    getLoadingKeys,
    withLoading
  };
};