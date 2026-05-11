import { useState, useMemo, useCallback, useRef, useEffect } from 'react';

interface VirtualizationOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

interface VirtualItem {
  index: number;
  start: number;
  end: number;
  height: number;
}

export function useVirtualization<T>(
  items: T[],
  options: VirtualizationOptions
) {
  const { itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const totalHeight = items.length * itemHeight;
  const viewportHeight = containerHeight;

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(viewportHeight / itemHeight),
      items.length - 1
    );

    return {
      start: Math.max(0, startIndex - overscan),
      end: Math.min(items.length - 1, endIndex + overscan),
    };
  }, [scrollTop, itemHeight, viewportHeight, items.length, overscan]);

  const visibleItems: VirtualItem[] = useMemo(() => {
    const items = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight,
        height: itemHeight,
      });
    }
    return items;
  }, [visibleRange.start, visibleRange.end, itemHeight]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    if (scrollElementRef.current) {
      const scrollTop = index * itemHeight;
      scrollElementRef.current.scrollTo({
        top: scrollTop,
        behavior,
      });
    }
  }, [itemHeight]);

  const scrollToTop = useCallback((behavior: ScrollBehavior = 'auto') => {
    scrollToIndex(0, behavior);
  }, [scrollToIndex]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    scrollToIndex(items.length - 1, behavior);
  }, [scrollToIndex, items.length]);

  return {
    totalHeight,
    visibleItems,
    visibleRange,
    scrollElementRef,
    handleScroll,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    offsetY: visibleRange.start * itemHeight,
  };
}

// Hook for virtual table with dynamic row heights
export function useVirtualTable<T>(
  items: T[],
  options: {
    estimatedRowHeight: number;
    containerHeight: number;
    getItemHeight?: (item: T, index: number) => number;
    overscan?: number;
  }
) {
  const { estimatedRowHeight, containerHeight, getItemHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map());
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const getRowHeight = useCallback((index: number): number => {
    if (getItemHeight) {
      return getItemHeight(items[index], index);
    }
    return measuredHeights.get(index) ?? estimatedRowHeight;
  }, [items, getItemHeight, measuredHeights, estimatedRowHeight]);

  const { offsets, totalHeight } = useMemo(() => {
    const offsets = [0];
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      const height = getRowHeight(i);
      totalHeight += height;
      offsets.push(totalHeight);
    }

    return { offsets, totalHeight };
  }, [items.length, getRowHeight]);

  const visibleRange = useMemo(() => {
    const startIndex = offsets.findIndex(offset => offset >= scrollTop) - 1;
    const start = Math.max(0, startIndex - overscan);
    
    let endIndex = start;
    let currentOffset = offsets[start];
    
    while (currentOffset < scrollTop + containerHeight && endIndex < items.length - 1) {
      endIndex++;
      currentOffset = offsets[endIndex + 1] || totalHeight;
    }
    
    const end = Math.min(items.length - 1, endIndex + overscan);
    
    return { start, end };
  }, [scrollTop, containerHeight, offsets, totalHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const result = [];
    for (let i = visibleRange.start; i <= visibleRange.end; i++) {
      result.push({
        index: i,
        start: offsets[i],
        height: getRowHeight(i),
        item: items[i],
      });
    }
    return result;
  }, [visibleRange.start, visibleRange.end, offsets, getRowHeight, items]);

  const measureRow = useCallback((index: number, height: number) => {
    setMeasuredHeights(prev => {
      if (prev.get(index) !== height) {
        const newMap = new Map(prev);
        newMap.set(index, height);
        return newMap;
      }
      return prev;
    });
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    totalHeight,
    visibleItems,
    visibleRange,
    scrollElementRef,
    handleScroll,
    measureRow,
    offsetY: offsets[visibleRange.start] || 0,
  };
}