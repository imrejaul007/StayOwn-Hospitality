import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/utils/toast';
import {
  Clock,
  Package,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Eye,
  Edit,
  Calendar,
  Timer,
  IndianRupee,
  TrendingUp,
  Filter,
  Search,
  MoreHorizontal,
  CheckSquare,
  XCircle,
  AlertCircle,
  Info,
  MapPin,
  User,
  Phone,
  Mail
} from 'lucide-react';
import laundryService, { LaundryTransaction } from '@/services/laundryService';
import { formatCurrency } from '@/utils/currencyUtils';

interface LaundryStatusTrackerProps {
  className?: string;
}

const LaundryStatusTracker: React.FC<LaundryStatusTrackerProps> = ({ className = '' }) => {
  const [transactions, setTransactions] = useState<LaundryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<LaundryTransaction | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchTransactions();
    const interval = setInterval(fetchTransactions, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [selectedStatus]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: Record<string, unknown> = {};
      if (selectedStatus !== 'all') {
        filters.status = selectedStatus;
      }

      const data = await laundryService.getLaundryStatus(filters);
      setTransactions(data);
      setLastUpdate(new Date());
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch laundry transactions');
      toast.error('Failed to load laundry transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (transactionId: string, newStatus: string) => {
    try {
      let updatedTransaction: LaundryTransaction;

      switch (newStatus) {
        case 'in_laundry':
          updatedTransaction = await laundryService.markItemsAsInLaundry(transactionId);
          break;
        case 'cleaning':
          updatedTransaction = await laundryService.markItemsAsCleaning(transactionId);
          break;
        case 'ready':
          updatedTransaction = await laundryService.markItemsAsReady(transactionId);
          break;
        case 'returned':
          updatedTransaction = await laundryService.returnItemsFromLaundry(transactionId);
          break;
        case 'lost':
          updatedTransaction = await laundryService.markItemsAsLost(transactionId, 'Marked as lost');
          break;
        case 'damaged':
          updatedTransaction = await laundryService.markItemsAsDamaged(transactionId, 'Marked as damaged');
          break;
        default:
          throw new Error('Invalid status update');
      }

      // Update local state
      setTransactions(prev => 
        prev.map(t => t._id === transactionId ? updatedTransaction : t)
      );

      toast.success(`Status updated to ${laundryService.getStatusText(newStatus)}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'in_laundry':
        return <Package className="w-4 h-4" />;
      case 'cleaning':
        return <RefreshCw className="w-4 h-4" />;
      case 'ready':
        return <CheckCircle className="w-4 h-4" />;
      case 'returned':
        return <CheckSquare className="w-4 h-4" />;
      case 'lost':
        return <XCircle className="w-4 h-4" />;
      case 'damaged':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    return laundryService.getStatusColor(status);
  };

  const getStatusText = (status: string) => {
    return laundryService.getStatusText(status);
  };

  const getPriorityColor = (priority: string) => {
    return laundryService.getPriorityColor(priority);
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = searchTerm === '' || 
      transaction.itemId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.roomId.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusProgress = (transaction: LaundryTransaction) => {
    const statusOrder = ['pending', 'in_laundry', 'cleaning', 'ready', 'returned'];
    const currentIndex = statusOrder.indexOf(transaction.status);
    return ((currentIndex + 1) / statusOrder.length) * 100;
  };

  if (loading && transactions.length === 0) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Transactions</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchTransactions} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laundry Status Tracker</h1>
          <p className="text-gray-600">
            Monitor and manage laundry transactions in real-time
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button onClick={fetchTransactions} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search by item, room, or tracking number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_laundry">In Laundry</SelectItem>
            <SelectItem value="cleaning">Cleaning</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
            <SelectItem value="damaged">Damaged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transactions List */}
      <div className="space-y-4">
        {filteredTransactions.map((transaction) => (
          <Card key={transaction._id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${getStatusColor(transaction.status)}`}>
                    {getStatusIcon(transaction.status)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {transaction.itemId.name}
                      </h3>
                      <Badge className={`${getStatusColor(transaction.status)} text-white`}>
                        {getStatusText(transaction.status)}
                      </Badge>
                      {transaction.isUrgent && (
                        <Badge className="bg-red-500 text-white">
                          Urgent
                        </Badge>
                      )}
                      {transaction.isOverdue && (
                        <Badge className="bg-orange-500 text-white">
                          {transaction.daysOverdue} days overdue
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Room {transaction.roomId.roomNumber}
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        {transaction.quantity} items
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Sent: {laundryService.formatDate(transaction.sentDate)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        Expected: {laundryService.formatDate(transaction.expectedReturnDate)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      Tracking: {transaction.trackingNumber} • 
                      Cost: {formatCurrency(transaction.totalCost)} • 
                      Days in laundry: {transaction.daysInLaundry}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                        <DialogDescription>
                          Complete information about this laundry transaction
                        </DialogDescription>
                      </DialogHeader>
                      {selectedTransaction && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Item</Label>
                              <p className="text-gray-900">{selectedTransaction.itemId.name}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Room</Label>
                              <p className="text-gray-900">Room {selectedTransaction.roomId.roomNumber}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Quantity</Label>
                              <p className="text-gray-900">{selectedTransaction.quantity} items</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Total Cost</Label>
                              <p className="text-gray-900">{formatCurrency(selectedTransaction.totalCost)}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Status</Label>
                              <Badge className={`${getStatusColor(selectedTransaction.status)} text-white`}>
                                {getStatusText(selectedTransaction.status)}
                              </Badge>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Priority</Label>
                              <Badge className={`${getPriorityColor(selectedTransaction.priority)} text-white`}>
                                {selectedTransaction.priority}
                              </Badge>
                            </div>
                          </div>
                          {selectedTransaction.notes && (
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Notes</Label>
                              <p className="text-gray-900">{selectedTransaction.notes}</p>
                            </div>
                          )}
                          {selectedTransaction.specialInstructions && (
                            <div>
                              <Label className="text-sm font-medium text-gray-600">Special Instructions</Label>
                              <p className="text-gray-900">{selectedTransaction.specialInstructions}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusUpdate(transaction._id, 'returned')}
                    disabled={transaction.status === 'returned' || transaction.status === 'lost' || transaction.status === 'damaged'}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Mark Returned
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Transactions Found</h3>
          <p className="text-gray-600">
            {searchTerm ? 'No transactions match your search criteria.' : 'No laundry transactions available.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default LaundryStatusTracker;
