import { useState, useEffect } from 'react';
import { dashboardService } from '../services/dashboardService';

interface DashboardCounts {
  frontDesk: {
    total: number;
    checkIn: number;
    checkOut: number;
  };
  reservations: {
    total: number;
    confirmed: number;
    pending: number;
    checkedIn: number;
  };
  housekeeping: {
    total: number;
    dirty: number;
    maintenance: number;
    outOfOrder: number;
  };
  guestServices: {
    total: number;
    pending: number;
    inProgress: number;
    vipGuests: number;
    corporate: number;
  };
}

export const useDashboardCounts = () => {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getDashboardCounts();
      setCounts(data);
    } catch (err) {
      setError('Failed to load dashboard data');
      
      // Fallback to static data if API fails
      setCounts({
        frontDesk: { total: 5, checkIn: 3, checkOut: 2 },
        reservations: { total: 12, confirmed: 8, pending: 3, checkedIn: 1 },
        housekeeping: { total: 8, dirty: 3, maintenance: 3, outOfOrder: 2 },
        guestServices: { total: 6, pending: 2, inProgress: 1, vipGuests: 4, corporate: 7 }
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshCounts = () => {
    fetchCounts();
  };

  useEffect(() => {
    fetchCounts();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    counts,
    loading,
    error,
    refreshCounts
  };
};