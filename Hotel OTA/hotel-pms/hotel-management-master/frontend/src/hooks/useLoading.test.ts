import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useLoading } from './useLoading';

describe('useLoading', () => {
  beforeEach(() => {
    // Clear any existing loading states
  });

  it('should initialize with no loading states', () => {
    const { result } = renderHook(() => useLoading());

    expect(result.current.loading).toEqual({});
    expect(result.current.isLoading()).toBe(false);
    expect(result.current.isLoading('test')).toBe(false);
  });

  it('should set loading state for specific key', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading('apiCall', true);
    });

    expect(result.current.loading.apiCall).toBe(true);
    expect(result.current.isLoading('apiCall')).toBe(true);
    expect(result.current.isLoading()).toBe(true);
  });

  it('should clear specific loading state', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading('apiCall', true);
    });

    expect(result.current.isLoading('apiCall')).toBe(true);

    act(() => {
      result.current.setLoading('apiCall', false);
    });

    expect(result.current.isLoading('apiCall')).toBe(false);
    expect(result.current.loading.apiCall).toBe(false);
  });

  it('should handle multiple loading states', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading('api1', true);
      result.current.setLoading('api2', true);
    });

    expect(result.current.isLoading('api1')).toBe(true);
    expect(result.current.isLoading('api2')).toBe(true);
    expect(result.current.isLoading()).toBe(true);

    act(() => {
      result.current.setLoading('api1', false);
    });

    expect(result.current.isLoading('api1')).toBe(false);
    expect(result.current.isLoading('api2')).toBe(true);
    expect(result.current.isLoading()).toBe(true);
  });

  it('should wrap async operations with loading state', async () => {
    const { result } = renderHook(() => useLoading());

    const mockAsyncOperation = jest.fn().mockResolvedValue('success');

    let loadingDuringExecution = false;

    const promise = act(async () => {
      const operationPromise = result.current.withLoading('test', mockAsyncOperation);

      // Check loading state immediately after starting
      loadingDuringExecution = result.current.isLoading('test');

      return operationPromise;
    });

    expect(loadingDuringExecution).toBe(true);

    const response = await promise;

    expect(response).toBe('success');
    expect(result.current.isLoading('test')).toBe(false);
    expect(mockAsyncOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle async operation failures', async () => {
    const { result } = renderHook(() => useLoading());

    const mockAsyncOperation = jest.fn().mockRejectedValue(new Error('API Error'));

    let error = null;

    try {
      await act(async () => {
        await result.current.withLoading('test', mockAsyncOperation);
      });
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(new Error('API Error'));
    expect(result.current.isLoading('test')).toBe(false);
    expect(mockAsyncOperation).toHaveBeenCalledTimes(1);
  });

  it('should clear all loading states', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading('api1', true);
      result.current.setLoading('api2', true);
      result.current.setLoading('api3', true);
    });

    expect(result.current.isLoading()).toBe(true);

    act(() => {
      result.current.clearAllLoading();
    });

    expect(result.current.loading).toEqual({});
    expect(result.current.isLoading()).toBe(false);
  });

  it('should get loading count', () => {
    const { result } = renderHook(() => useLoading());

    expect(result.current.getLoadingCount()).toBe(0);

    act(() => {
      result.current.setLoading('api1', true);
      result.current.setLoading('api2', true);
    });

    expect(result.current.getLoadingCount()).toBe(2);

    act(() => {
      result.current.setLoading('api1', false);
    });

    expect(result.current.getLoadingCount()).toBe(1);
  });

  it('should get all loading keys', () => {
    const { result } = renderHook(() => useLoading());

    act(() => {
      result.current.setLoading('api1', true);
      result.current.setLoading('api2', true);
      result.current.setLoading('api3', false);
    });

    const loadingKeys = result.current.getLoadingKeys();
    expect(loadingKeys).toEqual(['api1', 'api2']);
  });
});