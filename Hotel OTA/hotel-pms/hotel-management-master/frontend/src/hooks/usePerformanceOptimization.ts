import { useEffect, useCallback, useRef, useState } from 'react';

// Performance monitoring interface
interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  memoryUsage: number;
  networkRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

// Performance optimization hook
export const usePerformanceOptimization = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    memoryUsage: 0,
    networkRequests: 0,
    cacheHits: 0,
    cacheMisses: 0
  });

  const renderStartTime = useRef<number>(0);
  const networkRequestCount = useRef<number>(0);
  const cacheHitCount = useRef<number>(0);
  const cacheMissCount = useRef<number>(0);

  // Measure render performance
  const measureRender = useCallback(() => {
    const startTime = performance.now();
    renderStartTime.current = startTime;

    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      setMetrics(prev => ({
        ...prev,
        renderTime
      }));

      // Log slow renders
      if (renderTime > 16) { // 60fps threshold
      }
    };
  }, []);

  // Track network requests
  const trackNetworkRequest = useCallback(() => {
    networkRequestCount.current += 1;
    setMetrics(prev => ({
      ...prev,
      networkRequests: networkRequestCount.current
    }));
  }, []);

  // Track cache performance
  const trackCacheHit = useCallback(() => {
    cacheHitCount.current += 1;
    setMetrics(prev => ({
      ...prev,
      cacheHits: cacheHitCount.current
    }));
  }, []);

  const trackCacheMiss = useCallback(() => {
    cacheMissCount.current += 1;
    setMetrics(prev => ({
      ...prev,
      cacheMisses: cacheMissCount.current
    }));
  }, []);

  // Memory usage monitoring
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }, []);

  // Debounce function
  const debounce = useCallback(<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }, []);

  // Throttle function
  const throttle = useCallback(<T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
  ): ((...args: Parameters<T>) => void) => {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func(...args);
      }
    };
  }, []);

  // Intersection Observer for lazy loading
  const useIntersectionObserver = useCallback((
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {}
  ) => {
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
      observerRef.current = new IntersectionObserver(callback, {
        root: null,
        rootMargin: '0px',
        threshold: 0.1,
        ...options
      });

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }, [callback, options]);

    return observerRef.current;
  }, []);

  // Virtual scrolling hook
  const useVirtualScrolling = useCallback((
    items: unknown[],
    itemHeight: number,
    containerHeight: number
  ) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [visibleItems, setVisibleItems] = useState<unknown[]>([]);

    useEffect(() => {
      const startIndex = Math.floor(scrollTop / itemHeight);
      const endIndex = Math.min(
        startIndex + Math.ceil(containerHeight / itemHeight) + 1,
        items.length
      );

      setVisibleItems(items.slice(startIndex, endIndex));
    }, [items, itemHeight, containerHeight, scrollTop]);

    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop);
    }, []);

    return {
      visibleItems,
      handleScroll,
      totalHeight: items.length * itemHeight,
      offsetY: Math.floor(scrollTop / itemHeight) * itemHeight
    };
  }, []);

  // Image optimization hook
  const useImageOptimization = useCallback(() => {
    const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

    const preloadImage = useCallback((src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(src));
          resolve();
        };
        
        img.onerror = () => {
          setFailedImages(prev => new Set(prev).add(src));
          reject(new Error(`Failed to load image: ${src}`));
        };
        
        img.src = src;
      });
    }, []);

    const preloadImages = useCallback(async (srcs: string[]) => {
      const promises = srcs.map(src => preloadImage(src));
      await Promise.allSettled(promises);
    }, [preloadImage]);

    return {
      loadedImages,
      failedImages,
      preloadImage,
      preloadImages
    };
  }, []);

  // Code splitting hook
  const useCodeSplitting = useCallback(() => {
    const [loadedModules, setLoadedModules] = useState<Map<string, any>>(new Map());

    const loadModule = useCallback(async (modulePath: string) => {
      if (loadedModules.has(modulePath)) {
        return loadedModules.get(modulePath);
      }

      try {
        const module = await import(/* webpackChunkName: "[request]" */ modulePath);
        setLoadedModules(prev => new Map(prev).set(modulePath, module));
        return module;
      } catch (error) {
        throw error;
      }
    }, [loadedModules]);

    return { loadModule, loadedModules };
  }, []);

  // Service Worker hook
  const useServiceWorker = useCallback(() => {
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
    const [updateAvailable, setUpdateAvailable] = useState(false);

    useEffect(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/sw.js')
          .then(reg => {
            setRegistration(reg);
            
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    setUpdateAvailable(true);
                  }
                });
              }
            });
          })
          .catch(error => {
          });
      }
    }, []);

    const updateServiceWorker = useCallback(() => {
      if (registration && updateAvailable) {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        setUpdateAvailable(false);
        window.location.reload();
      }
    }, [registration, updateAvailable]);

    return { registration, updateAvailable, updateServiceWorker };
  }, []);

  // Performance monitoring effect
  useEffect(() => {
    // Measure initial load time
    const loadTime = performance.now();
    setMetrics(prev => ({ ...prev, loadTime }));

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      const memory = getMemoryUsage();
      if (memory) {
        setMetrics(prev => ({
          ...prev,
          memoryUsage: memory.used
        }));
      }
    }, 5000);

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // 50ms threshold
          }
        }
      });
      
      observer.observe({ entryTypes: ['longtask'] });
    }

    return () => {
      clearInterval(memoryInterval);
    };
  }, [getMemoryUsage]);

  return {
    metrics,
    measureRender,
    trackNetworkRequest,
    trackCacheHit,
    trackCacheMiss,
    debounce,
    throttle,
    useIntersectionObserver,
    useVirtualScrolling,
    useImageOptimization,
    useCodeSplitting,
    useServiceWorker,
    getMemoryUsage
  };
};

// React.memo wrapper with performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  const WrappedComponent = React.memo((props: P) => {
    const { measureRender } = usePerformanceOptimization();
    
    useEffect(() => {
      return measureRender();
    }, [measureRender]);

    return <Component {...props} />;
  });

  WrappedComponent.displayName = componentName || Component.displayName || 'WithPerformanceMonitoring';
  
  return WrappedComponent;
};

// Lazy loading wrapper
export const withLazyLoading = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) => {
  const LazyComponent = React.lazy(() => 
    Promise.resolve({ default: Component })
  );

  const WrappedComponent = (props: P) => (
    <React.Suspense fallback={fallback || <div>Loading...</div>}>
      <LazyComponent {...props} />
    </React.Suspense>
  );

  WrappedComponent.displayName = Component.displayName || 'WithLazyLoading';
  
  return WrappedComponent;
};

// Error boundary with performance monitoring
export class PerformanceErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    
    // Log performance metrics when error occurs
    if ('performance' in window) {
      const metrics = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>Please refresh the page or contact support if the problem persists.</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}