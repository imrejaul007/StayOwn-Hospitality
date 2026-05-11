import React from 'react';
import { render, screen, waitFor } from '../../utils/testUtils';
import { QueryClient } from '@tanstack/react-query';
import AdminDashboard from './AdminDashboard';
import * as dashboardHooks from '../../hooks/useDashboard';

// Mock the dashboard hooks
jest.mock('../../hooks/useDashboard');

const mockUseDashboardOverview = dashboardHooks.useDashboardOverview as jest.MockedFunction<
  typeof dashboardHooks.useDashboardOverview
>;

const mockUseOccupancyData = dashboardHooks.useOccupancyData as jest.MockedFunction<
  typeof dashboardHooks.useOccupancyData
>;

const mockUseRevenueData = dashboardHooks.useRevenueData as jest.MockedFunction<
  typeof dashboardHooks.useRevenueData
>;

describe('AdminDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  it('renders dashboard title and description', () => {
    // Mock successful data loading
    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: null },
      kpis: { data: null, isLoading: false, error: null },
      alerts: { data: null, isLoading: false, error: null },
      systemHealth: { data: null, isLoading: false, error: null },
      isLoading: false,
      error: null,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AdminDashboard />, { queryClient });

    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Real-time hotel management overview')).toBeInTheDocument();
  });

  it('displays loading state while fetching data', () => {
    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: true, error: null },
      kpis: { data: null, isLoading: true, error: null },
      alerts: { data: null, isLoading: true, error: null },
      systemHealth: { data: null, isLoading: true, error: null },
      isLoading: true,
      error: null,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    render(<AdminDashboard />, { queryClient });

    // Check for loading indicators on KPI cards
    const loadingElements = screen.getAllByRole('status');
    expect(loadingElements.length).toBeGreaterThan(0);
    loadingElements.forEach(element => {
      expect(element).toHaveClass('animate-pulse');
    });
  });

  it('displays error state when data loading fails', () => {
    const mockError = new Error('Failed to load dashboard data');

    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: mockError },
      kpis: { data: null, isLoading: false, error: mockError },
      alerts: { data: null, isLoading: false, error: mockError },
      systemHealth: { data: null, isLoading: false, error: mockError },
      isLoading: false,
      error: mockError,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: mockError,
      refetch: jest.fn(),
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: false,
      error: mockError,
      refetch: jest.fn(),
    });

    render(<AdminDashboard />, { queryClient });

    expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays KPI cards with correct data', async () => {
    const mockKPIData = {
      data: {
        data: {
          totalRevenue: 125000,
          averageOccupancy: 78,
          todayCheckIns: 34,
          guestSatisfaction: 4.5,
          revenueGrowth: 12.5,
          occupancyGrowth: 3.2,
          satisfactionGrowth: 0.2,
        },
      },
    };

    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: null },
      kpis: mockKPIData,
      alerts: { data: null, isLoading: false, error: null },
      systemHealth: { data: null, isLoading: false, error: null },
      isLoading: false,
      error: null,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    render(<AdminDashboard />, { queryClient });

    await waitFor(() => {
      expect(screen.getByText('$125,000')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      expect(screen.getByText('34')).toBeInTheDocument();
      expect(screen.getByText('4.5/5')).toBeInTheDocument();
    });
  });

  it('handles filter changes correctly', async () => {
    const { user } = render(<AdminDashboard />, { queryClient });

    // Mock the hooks with default data
    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: null },
      kpis: { data: null, isLoading: false, error: null },
      alerts: { data: null, isLoading: false, error: null },
      systemHealth: { data: null, isLoading: false, error: null },
      isLoading: false,
      error: null,
    });

    // Find the hotel filter dropdown
    const hotelSelect = screen.getByDisplayValue('All Hotels');
    
    // Change the selection
    await user.selectOptions(hotelSelect, 'hotel1');
    
    // Verify the selection changed
    expect(hotelSelect).toHaveValue('hotel1');
  });

  it('refreshes data when refresh button is clicked', async () => {
    const mockRefetch = jest.fn();
    
    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: null, refetch: mockRefetch },
      kpis: { data: null, isLoading: false, error: null, refetch: mockRefetch },
      alerts: { data: null, isLoading: false, error: null, refetch: mockRefetch },
      systemHealth: { data: null, isLoading: false, error: null, refetch: mockRefetch },
      isLoading: false,
      error: null,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    const { user } = render(<AdminDashboard />, { queryClient });

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('is accessible', () => {
    mockUseDashboardOverview.mockReturnValue({
      realTimeData: { data: null, isLoading: false, error: null },
      kpis: { data: null, isLoading: false, error: null },
      alerts: { data: null, isLoading: false, error: null },
      systemHealth: { data: null, isLoading: false, error: null },
      isLoading: false,
      error: null,
    });

    mockUseOccupancyData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    mockUseRevenueData.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const { container } = render(<AdminDashboard />, { queryClient });

    // Check for main heading
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
    expect(mainHeading).toHaveTextContent('Admin Dashboard');

    // Check for proper landmark structure
    const main = container.querySelector('main');
    if (main) {
      expect(main).toBeInTheDocument();
    }

    // Run accessibility checks
    const violations = require('../../utils/testUtils').checkAccessibility(container);
    expect(violations).toHaveLength(0);
  });
});