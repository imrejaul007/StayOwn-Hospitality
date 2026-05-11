import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BarChart3,
  Activity,
  Package,
  RefreshCw,
  AlertCircle,
  Hash,
  TrendingUp,
  Star,
  ArrowRight,
  CheckCircle,
  Clock,
  Search
} from 'lucide-react';
import { api } from '../../services/api';

interface CounterAnalytics {
  totalCounters: number;
  activeCounters: number;
  averageDailyTransactions: number;
  busiestCounter: string;
}

interface ModeAnalytics {
  totalModes: number;
  mostCommonArrivalType: string;
  mostCommonDepartureType: string;
}

interface LostFoundAnalytics {
  totalItems: number;
  claimedItems: number;
  claimRate: number;
  pendingItems: number;
}

export default function OperationalAnalytics() {
  const [counterData, setCounterData] = useState<CounterAnalytics | null>(null);
  const [modeData, setModeData] = useState<ModeAnalytics | null>(null);
  const [lostFoundData, setLostFoundData] = useState<LostFoundAnalytics | null>(null);

  const [counterLoading, setCounterLoading] = useState(true);
  const [modeLoading, setModeLoading] = useState(true);
  const [lostFoundLoading, setLostFoundLoading] = useState(true);

  const [counterError, setCounterError] = useState<string | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);
  const [lostFoundError, setLostFoundError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchCounterAnalytics = async () => {
    setCounterLoading(true);
    setCounterError(null);
    try {
      const { data } = await api.get('/operational-management/analytics/counters', {
        params: { startDate, endDate, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        setCounterData(data.data);
      } else {
        setCounterData(null);
      }
    } catch {
      setCounterData(null);
      setCounterError('Unable to load counter analytics.');
    } finally {
      setCounterLoading(false);
    }
  };

  const fetchModeAnalytics = async () => {
    setModeLoading(true);
    setModeError(null);
    try {
      const { data } = await api.get('/operational-management/analytics/modes', {
        params: { startDate, endDate, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        setModeData(data.data);
      } else {
        setModeData(null);
      }
    } catch {
      setModeData(null);
      setModeError('Unable to load mode analytics.');
    } finally {
      setModeLoading(false);
    }
  };

  const fetchLostFoundAnalytics = async () => {
    setLostFoundLoading(true);
    setLostFoundError(null);
    try {
      const { data } = await api.get('/operational-management/analytics/lost-found', {
        params: { startDate, endDate, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        setLostFoundData(data.data);
      } else {
        setLostFoundData(null);
      }
    } catch {
      setLostFoundData(null);
      setLostFoundError('Unable to load lost & found analytics.');
    } finally {
      setLostFoundLoading(false);
    }
  };

  useEffect(() => {
    fetchCounterAnalytics();
    fetchModeAnalytics();
    fetchLostFoundAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleRefresh = () => {
    fetchCounterAnalytics();
    fetchModeAnalytics();
    fetchLostFoundAnalytics();
  };

  const isLoading = counterLoading || modeLoading || lostFoundLoading;

  const renderSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse">
          <div className="h-24 bg-gray-200 rounded-lg" />
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (message: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-gray-400">
      <AlertCircle className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );

  const renderErrorState = (message: string) => (
    <div className="flex flex-col items-center justify-center py-8 text-red-400">
      <AlertCircle className="w-10 h-10 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operational Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Overview of counters, operational modes, and lost &amp; found metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40 text-sm"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Counter Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-blue-600" />
            Counter Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {counterLoading ? (
            renderSkeleton()
          ) : counterError ? (
            renderErrorState(counterError)
          ) : !counterData ? (
            renderEmptyState('No counter analytics data available for the selected period.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Total Counters</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{counterData.totalCounters}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Active Counters</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{counterData.activeCounters}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600 uppercase">Avg Daily Transactions</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {counterData.averageDailyTransactions.toFixed(1)}
                </p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-medium text-amber-600 uppercase">Busiest Counter</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 truncate" title={counterData.busiestCounter}>
                  {counterData.busiestCounter || 'N/A'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mode Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            Mode Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {modeLoading ? (
            renderSkeleton()
          ) : modeError ? (
            renderErrorState(modeError)
          ) : !modeData ? (
            renderEmptyState('No mode analytics data available for the selected period.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-indigo-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-medium text-indigo-600 uppercase">Total Modes</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{modeData.totalModes}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="w-4 h-4 text-teal-600" />
                  <span className="text-xs font-medium text-teal-600 uppercase">Most Common Arrival</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 truncate" title={modeData.mostCommonArrivalType}>
                  {modeData.mostCommonArrivalType || 'N/A'}
                </p>
              </div>
              <div className="bg-rose-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowRight className="w-4 h-4 text-rose-600 rotate-180" />
                  <span className="text-xs font-medium text-rose-600 uppercase">Most Common Departure</span>
                </div>
                <p className="text-2xl font-bold text-gray-900 truncate" title={modeData.mostCommonDepartureType}>
                  {modeData.mostCommonDepartureType || 'N/A'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lost & Found Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-orange-600" />
            Lost &amp; Found Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lostFoundLoading ? (
            renderSkeleton()
          ) : lostFoundError ? (
            renderErrorState(lostFoundError)
          ) : !lostFoundData ? (
            renderEmptyState('No lost & found analytics data available for the selected period.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-600 uppercase">Total Items</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{lostFoundData.totalItems}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Claimed Items</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{lostFoundData.claimedItems}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Claim Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{lostFoundData.claimRate.toFixed(1)}%</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-xs font-medium text-yellow-600 uppercase">Pending Items</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{lostFoundData.pendingItems}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
