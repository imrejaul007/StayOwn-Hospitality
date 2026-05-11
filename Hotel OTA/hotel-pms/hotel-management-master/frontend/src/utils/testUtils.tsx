import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

// Mock data generators for testing
export const mockDashboardData = {
  realTime: {
    totalStats: {
      totalGuests: 1234,
      totalHotels: 5,
      totalBookings: 856,
      totalRooms: 200,
    },
    todayStats: {
      newBookings: 12,
      checkIns: 34,
      checkOuts: 28,
      newServiceRequests: 6,
    },
    monthlyStats: {
      monthlyBookings: 345,
      monthlyRevenue: 125000,
    },
    occupancyData: {
      totalRooms: 200,
      occupiedRooms: 156,
      occupancyRate: 78,
      availableRooms: 44,
      outOfOrderRooms: 3,
    },
    revenueData: {
      totalRevenue: 125000,
      todayRevenue: 8500,
      averageBookingValue: 350,
      revenueGrowth: 12.5,
    },
    activeServices: [],
    recentBookings: [],
    alerts: [],
    systemHealth: {
      overall: 'healthy' as const,
      database: 'connected' as const,
      api: 'operational' as const,
      storage: 'normal' as const,
    },
    lastUpdated: new Date().toISOString(),
  },

  kpis: {
    totalRevenue: 125000,
    totalBookings: 856,
    averageOccupancy: 78,
    guestSatisfaction: 4.5,
    totalRooms: 200,
    activeGuests: 156,
    todayCheckIns: 34,
    todayCheckOuts: 28,
    pendingMaintenance: 5,
    activeIncidents: 2,
    revenueGrowth: 12.5,
    bookingGrowth: 8.3,
    occupancyGrowth: 3.2,
    satisfactionGrowth: 0.2,
  },

  revenue: {
    summary: {
      totalRevenue: 125000,
      totalBookings: 856,
      averageBookingValue: 350,
      revenueGrowth: 12.5,
      bookingGrowth: 8.3,
    },
    timeSeries: [
      { date: '2024-01-01', revenue: 8500, bookings: 25, averageRate: 340 },
      { date: '2024-01-02', revenue: 9200, bookings: 28, averageRate: 329 },
      { date: '2024-01-03', revenue: 7800, bookings: 22, averageRate: 355 },
    ],
    bySource: [
      { source: 'Direct', amount: 45000, percentage: 36, bookings: 128 },
      { source: 'Booking.com', amount: 38000, percentage: 30.4, bookings: 115 },
      { source: 'Expedia', amount: 25000, percentage: 20, bookings: 71 },
    ],
    byRoomType: [
      { roomType: 'Standard', revenue: 50000, percentage: 40, bookings: 142, averageRate: 352 },
      { roomType: 'Deluxe', revenue: 45000, percentage: 36, bookings: 90, averageRate: 500 },
      { roomType: 'Suite', revenue: 30000, percentage: 24, bookings: 43, averageRate: 698 },
    ],
    periodComparison: {
      current: 125000,
      previous: 111000,
      change: 14000,
      changePercentage: 12.6,
    },
    forecast: [
      { date: '2024-01-04', projectedRevenue: 8800 },
      { date: '2024-01-05', projectedRevenue: 9100 },
    ],
  },

  alerts: {
    alerts: [
      {
        id: '1',
        type: 'incident' as const,
        severity: 'high' as const,
        title: 'Room 205 - AC Unit Malfunction',
        message: 'Guest reported AC unit not cooling properly',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        hotel: 'Grand Hotel',
        guest: 'John Smith',
      },
      {
        id: '2',
        type: 'maintenance' as const,
        severity: 'medium' as const,
        title: 'Elevator Maintenance Required',
        message: 'Scheduled maintenance for elevator B',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        hotel: 'Grand Hotel',
      },
    ],
    summary: {
      total: 5,
      critical: 0,
      high: 1,
      medium: 2,
      low: 2,
    },
    lastUpdated: new Date().toISOString(),
  },
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

const createWrapper = (options: CustomRenderOptions = {}) => {
  const { initialEntries = ['/'], queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
    },
  }) } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );

  return Wrapper;
};

export const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } => {
  const user = userEvent.setup();
  const Wrapper = createWrapper(options);
  
  return {
    user,
    ...render(ui, { wrapper: Wrapper, ...options }),
  };
};

// Mock API responses
export const mockApiResponse = <T>(data: T, delay: number = 100): Promise<{ data: T }> & { cancel: () => void } => {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<{ data: T }>((resolve) => {
    timer = setTimeout(() => {
      resolve({ data });
    }, delay);
  }) as Promise<{ data: T }> & { cancel: () => void };
  promise.cancel = () => clearTimeout(timer);
  return promise;
};

export const mockApiError = (message: string = 'API Error', delay: number = 100): Promise<never> & { cancel: () => void } => {
  let timer: ReturnType<typeof setTimeout>;
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, delay);
  }) as Promise<never> & { cancel: () => void };
  promise.cancel = () => clearTimeout(timer);
  return promise;
};

// Mock intersection observer
export const mockIntersectionObserver = () => {
  const mockIntersectionObserver = jest.fn();
  mockIntersectionObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });
  
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });

  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: mockIntersectionObserver,
  });
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  const mockResizeObserver = jest.fn();
  mockResizeObserver.mockReturnValue({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  });

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: mockResizeObserver,
  });
};

// Mock window.matchMedia
export const mockMatchMedia = (matches: boolean = false) => {
  const mockMatchMedia = jest.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: mockMatchMedia,
  });

  return mockMatchMedia;
};

// Test utilities for charts
export const mockChart = () => {
  const mockChart = {
    destroy: jest.fn(),
    update: jest.fn(),
    resize: jest.fn(),
    render: jest.fn(),
  };

  // Mock Recharts components
  jest.mock('recharts', () => ({
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Line: () => <div data-testid="line" />,
    Bar: () => <div data-testid="bar" />,
    Pie: () => <div data-testid="pie" />,
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    Cell: () => <div data-testid="cell" />,
  }));

  return mockChart;
};

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => Promise<void> | void): Promise<number> => {
  const start = performance.now();
  await renderFn();
  const end = performance.now();
  return end - start;
};

export const waitForAnimationFrame = (): Promise<void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

// Accessibility testing helpers
export const getByRole = (container: HTMLElement, role: string, options?: Record<string, unknown>) => {
  return container.querySelector(`[role="${role}"]`) as HTMLElement;
};

export const getAllByRole = (container: HTMLElement, role: string) => {
  return Array.from(container.querySelectorAll(`[role="${role}"]`)) as HTMLElement[];
};

export const checkAccessibility = (element: HTMLElement) => {
  const violations = [];

  // Check for alt text on images
  const images = element.querySelectorAll('img');
  images.forEach((img, index) => {
    if (!img.hasAttribute('alt')) {
      violations.push(`Image at index ${index} is missing alt text`);
    }
  });

  // Check for aria-labels on buttons without text
  const buttons = element.querySelectorAll('button');
  buttons.forEach((button, index) => {
    const hasText = button.textContent?.trim();
    const hasAriaLabel = button.hasAttribute('aria-label') || button.hasAttribute('aria-labelledby');
    if (!hasText && !hasAriaLabel) {
      violations.push(`Button at index ${index} has no accessible name`);
    }
  });

  // Check for heading hierarchy
  const headings = Array.from(element.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  let previousLevel = 0;
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    if (level > previousLevel + 1 && previousLevel > 0) {
      violations.push(`Heading hierarchy violation at index ${index}: skipped from h${previousLevel} to h${level}`);
    }
    previousLevel = level;
  });

  return violations;
};

// Mock local storage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};

  return {
    getItem: jest.fn().mockImplementation((key: string) => store[key] || null),
    setItem: jest.fn().mockImplementation((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn().mockImplementation((key: string) => {
      delete store[key];
    }),
    clear: jest.fn().mockImplementation(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: 0,
    key: jest.fn(),
  };
};

// Test data factories
export const createMockBooking = (overrides = {}) => ({
  _id: 'booking-1',
  bookingNumber: 'BK001',
  checkIn: new Date().toISOString(),
  checkOut: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  status: 'confirmed',
  totalAmount: 350,
  userId: {
    _id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
  },
  rooms: [
    {
      roomId: {
        _id: 'room-1',
        roomNumber: '101',
        type: 'standard',
      },
      rate: 350,
    },
  ],
  ...overrides,
});

export const createMockAlert = (overrides = {}) => ({
  id: 'alert-1',
  type: 'incident',
  severity: 'medium',
  title: 'Test Alert',
  message: 'This is a test alert',
  timestamp: new Date().toISOString(),
  hotel: 'Test Hotel',
  ...overrides,
});

export const createMockRoom = (overrides = {}) => ({
  _id: 'room-1',
  roomNumber: '101',
  floor: 1,
  type: 'standard',
  status: 'vacant_clean',
  currentBooking: null,
  nextBooking: null,
  housekeepingStatus: 'completed',
  maintenanceRequired: false,
  ...overrides,
});

// Export everything for easy importing
export * from '@testing-library/react';
export { userEvent };
export { customRender as render };