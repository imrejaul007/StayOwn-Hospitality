import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus, Search, Eye, Download, RefreshCw,
  CreditCard, Smartphone, Banknote, Building2, CheckCircle2,
  XCircle, Clock, AlertTriangle, TrendingUp
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import financialService from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';
import { withErrorBoundary } from '../ErrorBoundary';

interface Payment {
  _id: string;
  paymentId: string;
  type: 'payment' | 'refund' | 'adjustment' | 'receipt';
  method: 'cash' | 'credit_card' | 'debit_card' | 'upi' | 'bank_transfer' | 'mobile_payment' | 'online';
  date: string;
  amount: number;
  currency: string;
  reference: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reconciled: boolean;
  customer: {
    type: string;
    name: string;
    guestId?: {
      name: string;
      email: string;
    };
  };
  bankAccount: {
    accountName: string;
  };
  netAmount: number;
  fees: {
    processingFee?: number;
    gatewayFee?: number;
    bankFee?: number;
  };
  notes: string;
  invoice?: {
    invoiceNumber: string;
    totalAmount: number;
  };
  paymentDetails?: {
    cardLast4?: string;
    authCode?: string;
    transactionId?: string;
    upiId?: string;
    bankReference?: string;
  };
  failureReason?: string;
  retryCount?: number;
  processedAt?: string;
  reconciledDate?: string;
}

interface PaymentStats {
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  totalAmount: number;
  completedAmount: number;
  pendingAmount: number;
}

interface PaymentManagementProps {
  readOnly?: boolean;
}

const PaymentManagementInner: React.FC<PaymentManagementProps> = ({ readOnly = false }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats>({
    totalPayments: 0,
    completedPayments: 0,
    pendingPayments: 0,
    failedPayments: 0,
    totalAmount: 0,
    completedAmount: 0,
    pendingAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updateStatusValue, setUpdateStatusValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [paymentForm, setPaymentForm] = useState({
    type: 'payment',
    method: 'cash',
    amount: '',
    currency: 'INR',
    reference: '',
    customerName: '',
    customerEmail: '',
    customerType: 'guest',
    bankAccount: '',
    notes: '',
    invoiceId: ''
  });

  const paymentStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
  const paymentMethods = ['cash', 'credit_card', 'debit_card', 'upi', 'bank_transfer', 'mobile_payment', 'online'];
  const paymentTypes = ['payment', 'refund', 'adjustment', 'receipt'];

  useEffect(() => {
    fetchPayments();
  }, [filterStatus, filterMethod, filterType, dateRange.start, dateRange.end]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterMethod, filterType, dateRange.start, dateRange.end, searchTerm]);

  const fetchPayments = async () => {
    try {
      setLoading(true);

      // Build filters object
      const filters = {
        ...(filterStatus && { status: filterStatus }),
        ...(filterMethod && { method: filterMethod }),
        ...(filterType && { type: filterType }),
        ...(dateRange.start && { startDate: dateRange.start }),
        ...(dateRange.end && { endDate: dateRange.end }),
        includeStats: true
      };

      const response = await financialService.getPayments(filters);

      const paymentsData = response?.data || [];
      setPayments(paymentsData);

      // Use backend-calculated statistics if available, otherwise fallback to frontend calculation
      if (response?.statistics) {
        setStats({
          totalPayments: response.statistics.totalPayments || 0,
          completedPayments: response.statistics.completedPayments || 0,
          pendingPayments: response.statistics.pendingPayments || 0,
          failedPayments: response.statistics.failedPayments || 0,
          totalAmount: response.statistics.totalAmount || 0,
          completedAmount: response.statistics.completedAmount || 0,
          pendingAmount: response.statistics.pendingAmount || 0
        });
      } else {
        const stats = calculatePaymentStats(paymentsData);
        setStats(stats);
      }

    } catch (error: unknown) {
      toast.error('Failed to fetch payments: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setPayments([]);
      // Reset stats on error
      setStats({
        totalPayments: 0,
        completedPayments: 0,
        pendingPayments: 0,
        failedPayments: 0,
        totalAmount: 0,
        completedAmount: 0,
        pendingAmount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePaymentStats = (paymentsData: Payment[]): PaymentStats => {
    const calculatedStats = {
      totalPayments: paymentsData.length,
      completedPayments: 0,
      pendingPayments: 0,
      failedPayments: 0,
      totalAmount: 0,
      completedAmount: 0,
      pendingAmount: 0
    };

    paymentsData.forEach((payment) => {
      calculatedStats.totalAmount += payment.amount || 0;

      switch (payment.status) {
        case 'completed':
          calculatedStats.completedPayments++;
          calculatedStats.completedAmount += payment.amount || 0;
          break;
        case 'pending':
        case 'processing':
          calculatedStats.pendingPayments++;
          calculatedStats.pendingAmount += payment.amount || 0;
          break;
        case 'failed':
        case 'cancelled':
          calculatedStats.failedPayments++;
          break;
      }
    });

    return calculatedStats;
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = !searchTerm ||
      payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.paymentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.invoice?.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'cash':
        return <Banknote className="w-4 h-4 text-green-600" />;
      case 'credit_card':
      case 'debit_card':
        return <CreditCard className="w-4 h-4 text-blue-600" />;
      case 'upi':
      case 'mobile_payment':
        return <Smartphone className="w-4 h-4 text-purple-600" />;
      case 'bank_transfer':
        return <Building2 className="w-4 h-4 text-indigo-600" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleUpdatePaymentStatus = async (paymentId: string, newStatus: string) => {
    try {
      await financialService.updatePaymentStatus(paymentId, { status: newStatus });
      toast.success('Payment status updated');
      setShowUpdateDialog(false);
      fetchPayments();
    } catch (error: unknown) {
      toast.error('Failed to update payment status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const parsedAmount = parseFloat(paymentForm.amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error('Please enter a valid payment amount greater than zero');
        setSubmitting(false);
        return;
      }

      if (parsedAmount > 100000) {
        toast.info('Large payment amount detected. Please double-check before proceeding.');
      }

      const paymentData = {
        ...paymentForm,
        amount: parsedAmount,
        date: new Date().toISOString(),
        status: 'pending',
        reconciled: false,
        customer: {
          type: paymentForm.customerType,
          name: paymentForm.customerName,
        },
        customerEmail: paymentForm.customerEmail || undefined,
        netAmount: parsedAmount,
        fees: {},
        notes: paymentForm.notes
      };

      await financialService.createPayment(paymentData);
      toast.success('Payment created successfully');
      setShowAddPaymentDialog(false);
      resetPaymentForm();
      fetchPayments();
    } catch (error: unknown) {
      toast.error('Failed to create payment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentForm({
      type: 'payment',
      method: 'cash',
      amount: '',
      currency: 'INR',
      reference: '',
      customerName: '',
      customerEmail: '',
      customerType: 'guest',
      bankAccount: '',
      notes: '',
      invoiceId: ''
    });
  };

  const handleExportPayments = () => {
    if (!payments || payments.length === 0) {
      toast.error('No payments to export');
      return;
    }
    const headers = ['Date', 'Type', 'Method', 'Amount', 'Currency', 'Status', 'Reference', 'Customer'];
    const rows = payments.map((p: Record<string, unknown>) => [
      p.date ? new Date(p.date as string).toLocaleDateString() : '',
      p.type || '',
      p.method || '',
      p.amount || 0,
      p.currency || 'INR',
      p.status || '',
      p.reference || '',
      (p.customer as Record<string, unknown>)?.name || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Payments exported');
  };

  const handleReconcilePayment = async (paymentId: string) => {
    try {
      await financialService.reconcilePayment(paymentId);
      toast.success('Payment reconciled successfully');
      fetchPayments();
    } catch (error: unknown) {
      toast.error('Failed to reconcile payment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Payment Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPayments}</p>
              </div>
              <div className="flex items-center text-green-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completedPayments}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">{formatCurrency(stats.completedAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendingPayments}</p>
              </div>
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">{formatCurrency(stats.pendingAmount)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{stats.failedPayments}</p>
              </div>
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">Requires attention</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>Payment Management</CardTitle>
              <CardDescription>Track and manage all payment transactions</CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              {!readOnly && (
              <Button size="sm" onClick={() => setShowAddPaymentDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Payment
              </Button>
              )}
              <Button size="sm" onClick={fetchPayments} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportPayments}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by reference, customer, or payment ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              {paymentStatuses.map(status => (
                <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Methods</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>{method.replace(/_/g, ' ')}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              {paymentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate" className="text-sm">From:</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="endDate" className="text-sm">To:</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-40"
              />
            </div>
            {(dateRange.start || dateRange.end) && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDateRange({ start: '', end: '' })}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-2 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="min-w-[120px]">Reference</TableHead>
                  <TableHead className="min-w-[140px]">Customer</TableHead>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="w-24">Method</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="min-w-[120px] hidden sm:table-cell">Bank Account</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No payments found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((payment) => (
                    <TableRow key={payment._id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="text-sm">
                          {new Date(payment.date).toLocaleDateString('en-IN')}
                          <div className="text-xs text-gray-500">
                            {new Date(payment.date).toLocaleTimeString('en-IN')}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">{payment.reference}</div>
                        {payment.paymentId && (
                          <div className="text-xs text-gray-500">{payment.paymentId}</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div>
                          <div className="font-medium">{payment.customer?.name}</div>
                          <div className="text-xs text-gray-500 capitalize">{payment.customer?.type}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {payment.type}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPaymentMethodIcon(payment.method)}
                          <span className="text-sm capitalize">{payment.method.replace(/_/g, ' ')}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(payment.amount, { currency: payment.currency })}</div>
                          {payment.netAmount !== payment.amount && (
                            <div className="text-xs text-gray-500">
                              Net: {formatCurrency(payment.netAmount, { currency: payment.currency })}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(payment.status)}
                          <Badge className={getStatusColor(payment.status)}>
                            {payment.status}
                          </Badge>
                        </div>
                        {payment.reconciled && (
                          <div className="text-xs text-green-600 mt-1">Reconciled</div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">{payment.bankAccount?.accountName}</div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setShowPaymentDialog(true);
                            }}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>

                          {payment.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setShowUpdateDialog(true);
                              }}
                            >
                              Update
                            </Button>
                          )}

                          {payment.status === 'completed' && !payment.reconciled && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReconcilePayment(payment.paymentId)}
                            >
                              Reconcile
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {filteredPayments.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 px-2">
              <p className="text-sm text-gray-600">
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredPayments.length)} of {filteredPayments.length} payments
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage >= Math.ceil(filteredPayments.length / ITEMS_PER_PAGE)}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Details Dialog */}
      {selectedPayment && (
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getPaymentMethodIcon(selectedPayment.method)}
                Payment Details - {selectedPayment.reference}
              </DialogTitle>
              <DialogDescription>
                Complete payment information and transaction details
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-semibold">Payment Information</h4>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Payment ID:</span>
                    <span className="text-sm font-mono">{selectedPayment.paymentId}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Type:</span>
                    <Badge variant="outline" className="capitalize">{selectedPayment.type}</Badge>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Method:</span>
                    <div className="flex items-center gap-1">
                      {getPaymentMethodIcon(selectedPayment.method)}
                      <span className="text-sm capitalize">{selectedPayment.method.replace(/_/g, ' ')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Status:</span>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(selectedPayment.status)}
                      <Badge className={getStatusColor(selectedPayment.status)}>
                        {selectedPayment.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Date:</span>
                    <span className="text-sm">{new Date(selectedPayment.date).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Financial Details */}
              <div className="space-y-4">
                <h4 className="font-semibold">Financial Details</h4>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Amount:</span>
                    <span className="text-sm font-semibold">{formatCurrency(selectedPayment.amount, { currency: selectedPayment.currency })}</span>
                  </div>

                  {selectedPayment.fees?.processingFee && selectedPayment.fees.processingFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Processing Fee:</span>
                      <span className="text-sm text-red-600">-{formatCurrency(selectedPayment.fees?.processingFee ?? 0, { currency: selectedPayment.currency })}</span>
                    </div>
                  )}

                  {selectedPayment.fees?.gatewayFee && selectedPayment.fees.gatewayFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Gateway Fee:</span>
                      <span className="text-sm text-red-600">-{formatCurrency(selectedPayment.fees?.gatewayFee ?? 0, { currency: selectedPayment.currency })}</span>
                    </div>
                  )}

                  {selectedPayment.fees?.bankFee && selectedPayment.fees.bankFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Bank Fee:</span>
                      <span className="text-sm text-red-600">-{formatCurrency(selectedPayment.fees?.bankFee ?? 0, { currency: selectedPayment.currency })}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t pt-2">
                    <span className="text-sm font-semibold">Net Amount:</span>
                    <span className="text-sm font-semibold text-green-600">{formatCurrency(selectedPayment.netAmount, { currency: selectedPayment.currency })}</span>
                  </div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4">
                <h4 className="font-semibold">Customer Details</h4>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Name:</span>
                    <span className="text-sm">{selectedPayment.customer?.name}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Type:</span>
                    <span className="text-sm capitalize">{selectedPayment.customer?.type}</span>
                  </div>

                  {selectedPayment.customer?.guestId?.email && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Email:</span>
                      <span className="text-sm">{selectedPayment.customer?.guestId?.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Details */}
              {selectedPayment.paymentDetails && (
                <div className="space-y-4">
                  <h4 className="font-semibold">Transaction Details</h4>

                  <div className="space-y-2">
                    {selectedPayment.paymentDetails.cardLast4 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Card Last 4:</span>
                        <span className="text-sm font-mono">****{selectedPayment.paymentDetails.cardLast4}</span>
                      </div>
                    )}

                    {selectedPayment.paymentDetails.authCode && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Auth Code:</span>
                        <span className="text-sm font-mono">{selectedPayment.paymentDetails.authCode}</span>
                      </div>
                    )}

                    {selectedPayment.paymentDetails.transactionId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Transaction ID:</span>
                        <span className="text-sm font-mono">{selectedPayment.paymentDetails.transactionId}</span>
                      </div>
                    )}

                    {selectedPayment.paymentDetails.upiId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">UPI ID:</span>
                        <span className="text-sm">{selectedPayment.paymentDetails.upiId}</span>
                      </div>
                    )}

                    {selectedPayment.paymentDetails.bankReference && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Bank Reference:</span>
                        <span className="text-sm font-mono">{selectedPayment.paymentDetails.bankReference}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Additional Information */}
            <div className="space-y-4 border-t pt-4">
              {selectedPayment.invoice && (
                <div>
                  <h4 className="font-semibold mb-2">Invoice Information</h4>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice:</span>
                    <span className="text-sm">{selectedPayment.invoice?.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Invoice Total:</span>
                    <span className="text-sm">{formatCurrency(selectedPayment.invoice?.totalAmount ?? 0, { currency: selectedPayment.currency })}</span>
                  </div>
                </div>
              )}

              {selectedPayment.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{selectedPayment.notes}</p>
                </div>
              )}

              {selectedPayment.failureReason && (
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Failure Reason</h4>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{selectedPayment.failureReason}</p>
                  {selectedPayment.retryCount && selectedPayment.retryCount > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Retry attempts: {selectedPayment.retryCount}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Bank Account: {selectedPayment.bankAccount?.accountName}</span>
                {selectedPayment.reconciledDate && (
                  <span className="text-green-600">Reconciled: {new Date(selectedPayment.reconciledDate).toLocaleDateString('en-IN')}</span>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Update Payment Status Dialog */}
      {selectedPayment && (
        <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update Payment Status</AlertDialogTitle>
              <AlertDialogDescription>
                Update the status of payment {selectedPayment.reference}. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4">
              <Label htmlFor="newStatus">New Status</Label>
              <select
                id="newStatus"
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={updateStatusValue || selectedPayment.status}
                onChange={(e) => setUpdateStatusValue(e.target.value)}
              >
                {paymentStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setUpdateStatusValue('')}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const newStatus = updateStatusValue || selectedPayment.status;
                  if (newStatus && selectedPayment) {
                    handleUpdatePaymentStatus(selectedPayment.paymentId, newStatus);
                    setUpdateStatusValue('');
                  }
                }}
              >
                Update Status
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Payment</DialogTitle>
            <DialogDescription>
              Create a new payment entry manually
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Payment Type</Label>
                <Select
                  value={paymentForm.type}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, type: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method} value={method}>
                        {method.replace(/_/g, ' ').charAt(0).toUpperCase() + method.replace(/_/g, ' ').slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={paymentForm.currency}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, currency: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  placeholder="Transaction reference"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerType">Customer Type</Label>
                <Select
                  value={paymentForm.customerType}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, customerType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={paymentForm.customerName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerName: e.target.value })}
                  placeholder="Customer full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email (Optional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={paymentForm.customerEmail}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerEmail: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankAccount">Bank Account</Label>
                <Input
                  id="bankAccount"
                  value={paymentForm.bankAccount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankAccount: e.target.value })}
                  placeholder="Bank account name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceId">Invoice ID (Optional)</Label>
                <Input
                  id="invoiceId"
                  value={paymentForm.invoiceId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, invoiceId: e.target.value })}
                  placeholder="Related invoice ID"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                placeholder="Additional notes about this payment..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddPaymentDialog(false);
                  resetPaymentForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Payment'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const PaymentManagement = withErrorBoundary(PaymentManagementInner, { level: 'component' });
export default PaymentManagement;