import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DollarSign,
  X,
  RefreshCw,
  AlertCircle,
  BarChart3,
  PieChart,
  TrendingUp,
  Layers
} from 'lucide-react';
import { api } from '../../services/api';

interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

interface RevenueAccount {
  _id: string;
  name: string;
  category: string;
  totalAmount: number;
}

interface RevenueSummary {
  totalAccounts: number;
  totalRevenue: number;
  categories: CategoryBreakdown[];
}

interface RevenueAnalysis {
  topAccounts: RevenueAccount[];
}

interface RevenueTrackingDashboardProps {
  hotelId: string;
  onClose: () => void;
}

export default function RevenueTrackingDashboard({ hotelId, onClose }: RevenueTrackingDashboardProps) {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [topAccounts, setTopAccounts] = useState<RevenueAccount[]>([]);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const { data } = await api.get(`/revenue-accounts/hotels/${hotelId}/summary`, {
        params: { page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        setSummary({
          totalAccounts: data.data.totalAccounts ?? 0,
          totalRevenue: data.data.totalRevenue ?? 0,
          categories: Array.isArray(data.data.categories) ? data.data.categories : [],
        });
      } else {
        setSummary(null);
      }
    } catch {
      setSummary(null);
      setSummaryError('Unable to load revenue summary.');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchRevenueAnalysis = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const { data } = await api.get('/analytics/reports/revenue-analysis', {
        params: { hotelId, page: 1, limit: 20 },
      });
      if (data.success && data.data) {
        setTopAccounts(Array.isArray(data.data.topAccounts) ? data.data.topAccounts : []);
      } else {
        setTopAccounts([]);
      }
    } catch {
      setTopAccounts([]);
      setAnalysisError('Unable to load revenue analysis.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  useEffect(() => {
    if (hotelId) {
      fetchSummary();
      fetchRevenueAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId]);

  const handleRefresh = () => {
    fetchSummary();
    fetchRevenueAnalysis();
  };

  const isLoading = summaryLoading || analysisLoading;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);

  const renderSkeleton = (rows: number) => (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-200 rounded" />
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

  const getCategoryColor = (index: number) => {
    const colors = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-purple-100 text-purple-800',
      'bg-amber-100 text-amber-800',
      'bg-rose-100 text-rose-800',
      'bg-teal-100 text-teal-800',
      'bg-indigo-100 text-indigo-800',
      'bg-orange-100 text-orange-800',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Revenue Tracking</h2>
          <p className="text-sm text-gray-500 mt-1">Revenue accounts and category breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            Revenue Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-gray-200 rounded-lg" />
                </div>
              ))}
            </div>
          ) : summaryError ? (
            renderErrorState(summaryError)
          ) : !summary ? (
            renderEmptyState('No revenue summary data available.')
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Total Accounts</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summary.totalAccounts}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <PieChart className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600 uppercase">Categories</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{summary.categories.length}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Revenue by Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            renderSkeleton(4)
          ) : summaryError ? (
            renderErrorState(summaryError)
          ) : !summary || summary.categories.length === 0 ? (
            renderEmptyState('No category breakdown data available.')
          ) : (
            <div className="space-y-3">
              {summary.categories.map((cat, index) => (
                <div key={cat.category} className="flex items-center gap-3">
                  {/* Category name */}
                  <div className="w-36 flex-shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(index)}`}>
                      {cat.category}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1">
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="h-2.5 rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Amount and percentage */}
                  <div className="w-40 flex-shrink-0 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(cat.amount)}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      ({cat.percentage.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Revenue Accounts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            Top Revenue Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analysisLoading ? (
            renderSkeleton(5)
          ) : analysisError ? (
            renderErrorState(analysisError)
          ) : topAccounts.length === 0 ? (
            renderEmptyState('No revenue account data available.')
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Account Name</TableHead>
                    <TableHead className="text-left">Category</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topAccounts.map((account, index) => (
                    <TableRow key={account._id}>
                      <TableCell className="font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-mono w-5">
                            {index + 1}.
                          </span>
                          {account.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" size="sm">{account.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(account.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
