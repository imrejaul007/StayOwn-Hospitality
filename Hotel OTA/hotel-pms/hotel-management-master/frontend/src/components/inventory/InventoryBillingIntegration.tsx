import React, { useState, useEffect, useRef} from 'react';
import { api } from '../../services/api';
import {
  IndianRupee,
  FileText,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  User,
  Calendar,
  Receipt,
  Printer,
  Send,
  Eye,
  RefreshCw
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  type: 'checkout_charges' | 'replacement_charges' | 'overage_charges';
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount?: number;
  currency: string;
  paymentMethod?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    category: string;
    itemDetails?: unknown;
  }>;
  breakdown: {
    equipment: number;
    inventory: number;
    damages: number;
    cleaning: number;
    extras: number;
  };
  notes?: string;
  metadata?: unknown;
}

interface BillingSummary {
  totalCharges: number;
  replacementCharges: number;
  damageCharges: number;
  equipmentCharges: number;
  cleaningCharges: number;
  transactions: number;
  inspections: number;
  invoices: number;
  pendingAmount: number;
  paidAmount: number;
  details: {
    transactions: unknown[];
    inspections: unknown[];
    invoices: Invoice[];
  };
}

interface InventoryBillingIntegrationProps {
  bookingId: string;
  roomId: string;
  guestId?: string;
  onPaymentComplete?: (invoice: Invoice) => void;
}

export function InventoryBillingIntegration({
  bookingId,
  roomId,
  guestId,
  onPaymentComplete
}: InventoryBillingIntegrationProps) {
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'room_charge'>('card');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchBillingSummary();
  }, [bookingId]);

  const fetchBillingSummary = async () => {
    try {
      setLoading(true);
      // Fetch real checkout inventory billing data
      const { data } = await api.get(`/checkout-inventory/booking/${bookingId}`);
      if (data.status === 'success' && data.data?.checkoutInventory) {
        const checkout = data.data.checkoutInventory;
        const items = checkout.items || [];

        // Calculate charges from real data
        let replacementCharges = 0;
        let damageCharges = 0;
        let equipmentCharges = 0;
        const lineItems: Invoice['lineItems'] = [];

        for (const item of items) {
          const charge = item.chargeable ? (item.chargeAmount || 0) : 0;
          if (item.status === 'damaged') {
            damageCharges += charge;
          } else if (item.status === 'missing') {
            replacementCharges += charge;
          } else {
            equipmentCharges += charge;
          }
          if (charge > 0) {
            lineItems.push({
              description: `${item.itemName || 'Item'} - ${item.status || 'charged'}`,
              quantity: item.quantity || 1,
              unitPrice: charge / (item.quantity || 1),
              totalPrice: charge,
              category: item.status === 'damaged' ? 'equipment_damage' : 'inventory_charge'
            });
          }
        }

        const totalCharges = replacementCharges + damageCharges + equipmentCharges;
        const taxAmount = totalCharges * 0.1;

        const realSummary: BillingSummary = {
          totalCharges,
          replacementCharges,
          damageCharges,
          equipmentCharges,
          cleaningCharges: 0,
          transactions: items.length,
          inspections: checkout.inspectionDate ? 1 : 0,
          invoices: totalCharges > 0 ? 1 : 0,
          pendingAmount: checkout.paymentStatus === 'paid' ? 0 : totalCharges,
          paidAmount: checkout.paymentStatus === 'paid' ? totalCharges : 0,
          details: {
            transactions: [],
            inspections: [],
            invoices: totalCharges > 0 ? [{
              _id: checkout._id,
              invoiceNumber: `INV-${checkout._id?.slice(-6)?.toUpperCase() || '000000'}`,
              type: 'checkout_charges' as const,
              status: (checkout.paymentStatus === 'paid' ? 'paid' : 'pending') as Invoice['status'],
              issueDate: checkout.createdAt || new Date().toISOString(),
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              subtotal: totalCharges,
              taxAmount,
              totalAmount: totalCharges + taxAmount,
              currency: 'INR',
              lineItems,
              breakdown: {
                equipment: equipmentCharges,
                inventory: replacementCharges,
                damages: damageCharges,
                cleaning: 0,
                extras: 0
              }
            }] as Invoice[] : []
          }
        };
        setBillingSummary(realSummary);
      } else {
        // No checkout data found - show empty state
        setBillingSummary(null);
      }
    } catch {
      // No billing data available for this booking
      setBillingSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const processPayment = async (invoiceId: string, amount: number) => {
    try {
      setProcessing(true);
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
    if (!isMountedRef.current) return;
      
      // Update invoice status
      if (billingSummary) {
        const updatedInvoices = billingSummary.details.invoices.map(invoice =>
          invoice._id === invoiceId
            ? {
                ...invoice,
                status: 'paid' as const,
                paidDate: new Date().toISOString(),
                paidAmount: amount,
                paymentMethod: paymentMethod
              }
            : invoice
        );
        
        setBillingSummary({
          ...billingSummary,
          details: {
            ...billingSummary.details,
            invoices: updatedInvoices
          },
          pendingAmount: billingSummary.pendingAmount - amount,
          paidAmount: billingSummary.paidAmount + amount
        });

        const paidInvoice = updatedInvoices.find(inv => inv._id === invoiceId);
        if (paidInvoice) {
          onPaymentComplete?.(paidInvoice);
        }
      }
      
      setShowPaymentModal(false);
      setSelectedInvoice(null);
    } catch {
      // Error handled silently
    } finally {
      setProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'equipment_damage': return <FileText className="w-4 h-4" />;
      case 'inventory_charge': return <Package className="w-4 h-4" />;
      case 'room_damage': return <AlertTriangle className="w-4 h-4" />;
      case 'item_replacement': return <RefreshCw className="w-4 h-4" />;
      case 'complimentary_overage': return <IndianRupee className="w-4 h-4" />;
      default: return <Receipt className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!billingSummary) {
    return (
      <div className="text-center p-8">
        <AlertTriangle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Billing Data</h3>
        <p className="text-gray-600">Unable to load billing information for this booking.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Billing Summary</h2>
          <Badge 
            variant="secondary" 
            className={billingSummary.pendingAmount > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
          >
            {billingSummary.pendingAmount > 0 ? 'Pending Charges' : 'All Paid'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(billingSummary.totalCharges)}</div>
            <div className="text-sm text-blue-700">Total Charges</div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-yellow-900">{formatCurrency(billingSummary.pendingAmount)}</div>
            <div className="text-sm text-yellow-700">Pending Payment</div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-900">{formatCurrency(billingSummary.paidAmount)}</div>
            <div className="text-sm text-green-700">Paid Amount</div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-gray-900">{billingSummary.invoices}</div>
            <div className="text-sm text-gray-700">Total Invoices</div>
          </div>
        </div>

        {/* Charges Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(billingSummary.replacementCharges)}</div>
            <div className="text-xs text-gray-600">Replacements</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(billingSummary.damageCharges)}</div>
            <div className="text-xs text-gray-600">Damages</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(billingSummary.equipmentCharges)}</div>
            <div className="text-xs text-gray-600">Equipment</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(billingSummary.cleaningCharges)}</div>
            <div className="text-xs text-gray-600">Cleaning</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{formatCurrency(billingSummary.totalCharges - billingSummary.replacementCharges - billingSummary.damageCharges - billingSummary.equipmentCharges - billingSummary.cleaningCharges)}</div>
            <div className="text-xs text-gray-600">Other</div>
          </div>
        </div>
      </Card>

      {/* Invoices */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
          <Button
            onClick={fetchBillingSummary}
            size="sm"
            variant="secondary"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {billingSummary.details.invoices.map(invoice => (
            <Card key={invoice._id} className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Receipt className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{invoice.invoiceNumber}</h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {invoice.type.replace('_', ' ')} • Issued {formatDate(invoice.issueDate)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    {formatCurrency(invoice.totalAmount)}
                  </div>
                  <Badge variant="secondary" className={getStatusColor(invoice.status)}>
                    {invoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2 mb-4">
                {invoice.lineItems.map((item, index) => (
                  <div key={`invoice-lineItems-${index}-${item.category}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(item.category)}
                      <div>
                        <span className="text-sm font-medium text-gray-900">{item.description}</span>
                        <div className="text-xs text-gray-600">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                    </div>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Invoice Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setSelectedInvoice(invoice)}
                    size="sm"
                    variant="secondary"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  <Button
                    onClick={() => window.print()}
                    size="sm"
                    variant="secondary"
                  >
                    <Printer className="w-4 h-4 mr-1" />
                    Print
                  </Button>
                </div>

                {invoice.status === 'pending' && (
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowPaymentModal(true);
                      }}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CreditCard className="w-4 h-4 mr-1" />
                      Pay Now
                    </Button>
                  </div>
                )}

                {invoice.status === 'paid' && invoice.paidDate && (
                  <div className="text-right">
                    <div className="text-sm text-green-600 font-medium">
                      ✓ Paid {formatDate(invoice.paidDate)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {invoice.paymentMethod?.toUpperCase()}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {billingSummary.details.invoices.length === 0 && (
            <div className="text-center py-8">
              <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Invoices</h4>
              <p className="text-gray-600">No inventory charges have been generated for this booking.</p>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Process Payment</h3>
              <Button
                onClick={() => setShowPaymentModal(false)}
                size="sm"
                variant="secondary"
              >
                ×
              </Button>
            </div>

            <div className="mb-6">
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <div className="text-sm text-gray-600">Invoice</div>
                <div className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</div>
                <div className="text-sm text-gray-600 mt-1">{selectedInvoice.type.replace('_', ' ')}</div>
              </div>

              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(selectedInvoice.totalAmount)}
                </div>
                <div className="text-sm text-gray-600">Total Amount Due</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as unknown)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="card">Credit/Debit Card</option>
                  <option value="cash">Cash</option>
                  <option value="room_charge">Charge to Room</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={() => setShowPaymentModal(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => processPayment(selectedInvoice._id, selectedInvoice.totalAmount)}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay {formatCurrency(selectedInvoice.totalAmount)}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && !showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Invoice Details</h3>
              <Button
                onClick={() => setSelectedInvoice(null)}
                size="sm"
                variant="secondary"
              >
                ×
              </Button>
            </div>

            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Invoice Number</div>
                  <div className="font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Issue Date</div>
                  <div className="font-semibold text-gray-900">{formatDate(selectedInvoice.issueDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Due Date</div>
                  <div className="font-semibold text-gray-900">{formatDate(selectedInvoice.dueDate)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Status</div>
                  <Badge variant="secondary" className={getStatusColor(selectedInvoice.status)}>
                    {selectedInvoice.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Charges</h4>
                <div className="space-y-2">
                  {selectedInvoice.lineItems.map((item, index) => (
                    <div key={`selectedInvoice-lineItems-${index}-${item.category}`} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(item.category)}
                        <div>
                          <div className="font-medium text-gray-900">{item.description}</div>
                          <div className="text-sm text-gray-600">
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(item.totalPrice)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div>
                  <div className="text-sm text-gray-600 mb-1">Notes</div>
                  <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                    {selectedInvoice.notes}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}