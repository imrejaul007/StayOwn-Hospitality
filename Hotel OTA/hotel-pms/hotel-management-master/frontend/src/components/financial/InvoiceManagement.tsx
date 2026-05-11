import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, Eye, Download, Mail, User, Building, FileText, Calendar } from 'lucide-react';
import financialService from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';

interface Invoice {
  _id: string;
  invoiceId: string;
  invoiceNumber: string;
  type: string;
  customer: {
    type: string;
    details: {
      name: string;
      email?: string;
      phone?: string;
      address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
      };
    };
  };
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxRate: number;
    taxAmount: number;
  }>;
}

interface InvoiceManagementProps {
  readOnly?: boolean;
}

const InvoiceManagement: React.FC<InvoiceManagementProps> = ({ readOnly = false }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const invoiceTypes = [
    { value: 'guest_folio', label: 'Guest Folio' },
    { value: 'corporate_billing', label: 'Corporate Billing' },
    { value: 'group_billing', label: 'Group Billing' },
    { value: 'vendor_invoice', label: 'Vendor Invoice' },
    { value: 'pro_forma', label: 'Pro Forma' }
  ];

  const invoiceStatuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'paid', label: 'Paid' },
    { value: 'partially_paid', label: 'Partially Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, dateRange]);

  useEffect(() => {
    fetchInvoices();
  }, [searchTerm, filterType, filterStatus, dateRange, currentPage]);


  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      const filters: Record<string, unknown> = {};
      if (filterType) filters.type = filterType;
      if (filterStatus) filters.status = filterStatus;
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
      if (searchTerm.trim()) filters.customer = searchTerm.trim();
      filters.page = currentPage;
      filters.limit = ITEMS_PER_PAGE;
      
      
      const response = await financialService.getInvoices(filters);

      const invoicesData = response.data?.invoices || [];
      
      setInvoices(invoicesData);
      const pagination = response.data?.pagination || response.pagination;
      const total = pagination?.total || 0;
      const pages = pagination?.pages || 1;
      setTotalInvoices(total);
      setTotalPages(Math.max(1, pages));
      
    } catch (error: unknown) {
      toast.error('Failed to fetch invoices: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'default';
      case 'issued':
        return 'secondary';
      case 'draft':
        return 'outline';
      case 'overdue':
        return 'destructive';
      case 'cancelled':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'guest_folio':
        return <User className="w-4 h-4" />;
      case 'corporate_billing':
        return <Building className="w-4 h-4" />;
      case 'vendor_invoice':
        return <span className="w-4 h-4 text-lg font-bold">₹</span>;
      default:
        return <span className="w-4 h-4 text-lg font-bold">₹</span>;
    }
  };

  const totalAmount = (Array.isArray(invoices) ? invoices : []).reduce((sum, invoice) => sum + (invoice.totalAmount || 0), 0);
  const paidInvoices = (Array.isArray(invoices) ? invoices : []).filter(invoice => invoice.status === 'paid').length;
  const overdueInvoices = (Array.isArray(invoices) ? invoices : []).filter(invoice => invoice.status === 'overdue').length;

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoice Management</h1>
          <p className="text-gray-600">Manage invoices and billing</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          {!readOnly && (
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Create a new invoice for your customers
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Invoice Type</Label>
                <Select defaultValue="guest">
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Guest Invoice</SelectItem>
                    <SelectItem value="corporate">Corporate Invoice</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Guest / Company Name *</Label>
                  <Input id="inv-customer" placeholder="Enter customer name" className="mt-1" />
                </div>
                <div>
                  <Label>Amount (INR) *</Label>
                  <Input id="inv-amount" type="number" min="0" step="0.01" placeholder="0.00" className="mt-1" />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input id="inv-description" placeholder="Invoice description" className="mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Due Date</Label>
                  <Input id="inv-dueDate" type="date" className="mt-1" />
                </div>
                <div>
                  <Label>Reference</Label>
                  <Input id="inv-reference" placeholder="Booking ref / PO number" className="mt-1" />
                </div>
              </div>
              <Button className="w-full" onClick={async () => {
                const customer = (document.getElementById('inv-customer') as HTMLInputElement)?.value;
                const amount = parseFloat((document.getElementById('inv-amount') as HTMLInputElement)?.value || '0');
                const description = (document.getElementById('inv-description') as HTMLInputElement)?.value;
                const dueDate = (document.getElementById('inv-dueDate') as HTMLInputElement)?.value;
                const reference = (document.getElementById('inv-reference') as HTMLInputElement)?.value;
                if (!customer || amount <= 0) { toast.error('Customer name and valid amount are required'); return; }
                try {
                  await financialService.createInvoice({
                    customerName: customer, totalAmount: amount, description,
                    dueDate: dueDate || undefined, reference: reference || undefined,
                    type: 'guest', status: 'draft',
                    items: [{ description: description || 'Invoice item', quantity: 1, unitPrice: amount, amount }]
                  });
                  toast.success('Invoice created');
                  fetchInvoices();
                } catch { toast.error('Failed to create invoice'); }
              }}>
                <Plus className="w-4 h-4 mr-2" /> Create Invoice
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
             <span className="h-4 w-4 text-muted-foreground text-lg font-bold">₹</span>
           </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              Total amount: {formatCurrency(totalAmount)}
            </p>
          </CardContent>
        </Card>
        
                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
             <span className="h-4 w-4 text-green-600 text-lg font-bold">₹</span>
           </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidInvoices}</div>
            <p className="text-xs text-muted-foreground">
              Successfully collected
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <Calendar className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInvoices}</div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>
        
                 <Card>
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
             <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
             <span className="h-4 w-4 text-orange-600 text-lg font-bold">₹</span>
           </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {filteredInvoices.length - paidInvoices}
            </div>
            <p className="text-xs text-muted-foreground">
              Pending collection
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                {invoiceTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                {invoiceStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              placeholder="Start date"
            />
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              placeholder="End date"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
              <CardTitle>Invoices ({totalInvoices})</CardTitle>
          <CardDescription>
            All invoices and billing records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="text-gray-400 mb-2">
                      <FileText className="h-10 w-10 mx-auto" />
                    </div>
                    <p className="text-gray-500 font-medium">No invoices found</p>
                    <p className="text-gray-400 text-sm mt-1">Create your first invoice or adjust your filters</p>
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((invoice) => (
                <TableRow key={invoice._id}>
                  <TableCell className="font-mono font-medium">
                    {invoice.invoiceNumber || invoice.invoiceId}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{invoice.customer?.details?.name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">
                        {invoice.customer?.details?.email || 'No email'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(invoice.type)}
                      <span className="capitalize">
                        {invoiceTypes.find(t => t.value === invoice.type)?.label || invoice.type}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString('en-IN') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(invoice.totalAmount || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(invoice.status)}>
                      {invoice.status?.toUpperCase() || 'UNKNOWN'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info('Invoice PDF download coming soon')}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toast.info('Invoice email sending coming soon')}>
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          {totalInvoices > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, totalInvoices)} of{' '}
                {totalInvoices} invoices
              </p>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Details Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Details - {selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Complete invoice information and line items
            </DialogDescription>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Name:</strong> {selectedInvoice.customer?.details?.name}</p>
                    <p><strong>Email:</strong> {selectedInvoice.customer?.details?.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedInvoice.customer?.details?.phone || 'N/A'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Invoice Details</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Invoice #:</strong> {selectedInvoice.invoiceNumber}</p>
                    <p><strong>Type:</strong> {invoiceTypes.find(t => t.value === selectedInvoice.type)?.label}</p>
                    <p><strong>Status:</strong> {selectedInvoice.status}</p>
                    <p><strong>Currency:</strong> {selectedInvoice.currency}</p>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <h3 className="font-semibold mb-3">Line Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Tax Rate</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lineItems?.map((item, index) => (
                      <TableRow key={`item-${index}`}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                        <TableCell>{item.taxRate}%</TableCell>
                        <TableCell>{formatCurrency(item.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="text-right space-y-2">
                <p><strong>Subtotal:</strong> {formatCurrency(selectedInvoice.lineItems?.reduce((sum, item) => sum + item.amount, 0) || 0)}</p>
                <p><strong>Tax:</strong> {formatCurrency(selectedInvoice.lineItems?.reduce((sum, item) => sum + item.taxAmount, 0) || 0)}</p>
                <p className="text-lg font-bold">Total: {formatCurrency(selectedInvoice.totalAmount)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoiceManagement;