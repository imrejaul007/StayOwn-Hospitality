import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Gift, 
  Star, 
  Clock, 
  Circle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Calendar
} from 'lucide-react';
import { loyaltyService } from '../../services/loyaltyService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const getTransactionIcon = (type: string) => {
  switch (type) {
    case 'earned': return <TrendingUp className="h-4 w-4" />;
    case 'redeemed': return <Gift className="h-4 w-4" />;
    case 'bonus': return <Star className="h-4 w-4" />;
    case 'expired': return <Clock className="h-4 w-4" />;
    default: return <Circle className="h-4 w-4" />;
  }
};

const getTransactionTypeInfo = (type: string) => {
  const typeInfo = loyaltyService.getTransactionTypeInfo(type);
  return typeInfo;
};

function LoyaltyTransactions() {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { data: transactionData, isLoading, error, refetch } = useQuery({
    queryKey: ['loyalty-transactions', selectedType, currentPage],
    queryFn: () => loyaltyService.getHistory(currentPage, itemsPerPage, selectedType === 'all' ? undefined : selectedType),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleTypeFilter = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPointsDisplay = (points: number) => {
    const isPositive = points > 0;
    return (
      <span className={`font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{loyaltyService.formatPoints(points)} pts
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load transaction history</p>
        <Button 
          onClick={() => refetch()} 
          variant="secondary" 
          className="mt-4"
        >
          Try Again
        </Button>
      </div>
    );
  }

  const transactions = transactionData?.transactions || [];
  const pagination = transactionData?.pagination || {};

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/app/loyalty')}
            className="flex items-center space-x-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to Loyalty Dashboard</span>
          </Button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Transaction History
        </h1>
        <p className="text-gray-600">
          View your complete loyalty points transaction history
        </p>
      </div>

      {/* Filters and Stats */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <Select value={selectedType} onValueChange={handleTypeFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All transactions</SelectItem>
              <SelectItem value="earned">Earned</SelectItem>
              <SelectItem value="redeemed">Redeemed</SelectItem>
              <SelectItem value="bonus">Bonus</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Stats (this page) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Earned (this page)</p>
                <p className="font-semibold text-green-600">
                  {loyaltyService.formatPoints(
                    transactions
                      .filter((t: { type: string }) => t.type === 'earned')
                      .reduce((sum: number, t: { points: number }) => sum + t.points, 0)
                  )} pts
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Gift className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm text-gray-600">Redeemed (this page)</p>
                <p className="font-semibold text-red-600">
                  {loyaltyService.formatPoints(
                    Math.abs(transactions
                      .filter((t: { type: string }) => t.type === 'redeemed')
                      .reduce((sum: number, t: { points: number }) => sum + t.points, 0))
                  )} pts
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm text-gray-600">Bonus (this page)</p>
                <p className="font-semibold text-yellow-600">
                  {loyaltyService.formatPoints(
                    transactions
                      .filter((t: { type: string }) => t.type === 'bonus')
                      .reduce((sum: number, t: { points: number }) => sum + t.points, 0)
                  )} pts
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="font-semibold text-blue-600">{pagination.totalItems || transactions.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Transactions List */}
      <Card className="p-6">
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Clock className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p>Your loyalty transaction history will appear here</p>
            </div>
          ) : (
            transactions.map((transaction) => {
              const typeInfo = getTransactionTypeInfo(transaction.type);
              
              return (
                <div 
                  key={transaction._id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-full ${typeInfo.color}`}>
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <p className="font-medium text-gray-900">
                          {transaction.description}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {typeInfo.label}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{formatDate(transaction.createdAt)}</span>
                        {transaction.bookingId && (
                          <span>
                            Booking: {transaction.bookingId.bookingNumber}
                          </span>
                        )}
                        {transaction.offerId && (
                          <span>
                            Offer: {transaction.offerId.title}
                          </span>
                        )}
                        {transaction.hotelId && (
                          <span>
                            Hotel: {transaction.hotelId.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {getPointsDisplay(transaction.points)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Showing {((pagination.currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(pagination.currentPage * itemsPerPage, pagination.totalItems)} of{' '}
              {pagination.totalItems} transactions
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.currentPage} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                disabled={currentPage >= pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export default withErrorBoundary(LoyaltyTransactions);
