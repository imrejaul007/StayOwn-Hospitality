/**
 * Performance Optimization Utilities
 * 
 * This file contains utilities to optimize the performance of our React application
 */

// Debounce function for expensive operations
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for frequent operations
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let inThrottle: boolean;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const throttled = (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      throttleTimer = setTimeout(() => {
        inThrottle = false;
        throttleTimer = null;
      }, limit);
    }
  };
  throttled.cancel = () => {
    if (throttleTimer) {
      clearTimeout(throttleTimer);
      throttleTimer = null;
    }
    inThrottle = false;
  };
  return throttled;
}

// Memoization utility for expensive calculations
export function memoize<T extends (...args: unknown[]) => unknown>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Lazy loading utility for components
export function lazyLoad<T extends () => Promise<{ default: React.ComponentType }>>(
  importFunc: T,
  fallback?: React.ComponentType
) {
  return React.lazy(importFunc);
}

// Intersection Observer for lazy loading images
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit = {}
) {
  if (typeof IntersectionObserver === 'undefined') {
    return null;
  }
  
  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options
  });
}

// Performance monitoring
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const end = performance.now();
      const duration = end - start;
      
      if (!this.metrics.has(label)) {
        this.metrics.set(label, []);
      }
      
      this.metrics.get(label)!.push(duration);
      
      // Log slow operations
      if (duration > 100) {
      }
    };
  }
  
  getMetrics(label: string) {
    const durations = this.metrics.get(label) || [];
    if (durations.length === 0) return null;
    
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    
    return { avg, min, max, count: durations.length };
  }
  
  clearMetrics() {
    this.metrics.clear();
  }
}

// Export a singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React performance hooks
export function usePerformanceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  label: string
): T {
  return React.useCallback((...args: Parameters<T>) => {
    const stopTimer = performanceMonitor.startTimer(label);
    try {
      const result = callback(...args);
      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }, [callback, label]) as T;
}

export function usePerformanceEffect(
  effect: React.EffectCallback,
  label: string,
  deps?: React.DependencyList
) {
  React.useEffect(() => {
    const stopTimer = performanceMonitor.startTimer(label);
    try {
      const cleanup = effect();
      stopTimer();
      return cleanup;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }, deps);
}

// Export React for the hooks
import React from 'react';
