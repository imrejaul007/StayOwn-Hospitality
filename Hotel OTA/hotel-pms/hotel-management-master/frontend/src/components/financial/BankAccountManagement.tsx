import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  Upload,
  RefreshCw,
  Building,
  CreditCard,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Wallet,
  Receipt
} from 'lucide-react';
import financialService from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { withErrorBoundary } from '../ErrorBoundary';

interface BankAccount {
  _id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit' | 'investment';
  currency: string;
  currentBalance: number;
  availableBalance: number;
  openingBalance: number;
  openingDate: Date;
  glAccountId: string;
  branchName?: string;
  ifscCode?: string;
  swiftCode?: string;
  isActive: boolean;
  isPrimary: boolean;
  lastReconciliationDate?: Date;
  nextReconciliationDate?: Date;
  transactions: Transaction[];
  reconciliationStatus: 'reconciled' | 'pending' | 'discrepancy';
  metadata?: Record<string, unknown>;
}

interface Transaction {
  _id: string;
  transactionDate: Date;
  description: string;
  referenceNumber?: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  transactionType: 'Deposit' | 'Withdrawal' | 'Transfer' | 'Fee' | 'Interest' | 'Adjustment';
  isReconciled: boolean;
  reconciledDate?: Date;
  journalEntryId?: string;
}

interface ReconciliationData {
  statementDate: Date;
  statementBalance: number;
  reconciledBalance: number;
  difference: number;
  items: ReconciliationItem[];
}

interface ReconciliationItem {
  transactionId: string;
  date: Date;
  description: string;
  amount: number;
  cleared: boolean;
}

const ITEMS_PER_PAGE = 20;

interface BankAccountManagementProps {
  readOnly?: boolean;
}

const BankAccountManagementInner: React.FC<BankAccountManagementProps> = ({ readOnly = false }) => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showReconcileDialog, setShowReconcileDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null);
  const [selectedTab, setSelectedTab] = useState('accounts');
  const [reconciliationData, setReconciliationData] = useState<ReconciliationData | null>(null);
  const [accountPage, setAccountPage] = useState(1);
  const [txnPage, setTxnPage] = useState(1);

  const safeFormatDate = (dateStr: string | Date | undefined, fmt: string) => {
    try { return dateStr ? format(new Date(dateStr), fmt) : 'N/A'; } catch { return 'N/A'; }
  };
  
     const [accountFormData, setAccountFormData] = useState({
     accountNumber: '',
     accountName: '',
     bankName: '',
     accountType: 'savings' as string,
     currency: 'INR',
     openingBalance: 0,
     openingDate: new Date().toISOString().split('T')[0],
     branchName: '',
     ifscCode: '',
     swiftCode: '',
     isPrimary: false
   });

  const [transactionFormData, setTransactionFormData] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    description: '',
    referenceNumber: '',
    transactionType: 'Deposit' as string,
    amount: 0
  });

  const accountTypes = [
    { value: 'checking', label: 'Checking Account' },
    { value: 'savings', label: 'Savings Account' },
    { value: 'credit', label: 'Credit Card' },
    { value: 'cash', label: 'Cash Account' },
    { value: 'loan', label: 'Loan Account' },
    { value: 'investment', label: 'Investment Account' }
  ];

  const transactionTypes = [
    { value: 'Deposit', label: 'Deposit' },
    { value: 'Withdrawal', label: 'Withdrawal' },
    { value: 'Transfer', label: 'Transfer' },
    { value: 'Fee', label: 'Bank Fee' },
    { value: 'Interest', label: 'Interest' },
    { value: 'Adjustment', label: 'Adjustment' }
  ];

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  useEffect(() => {
    
    if (selectedAccount) {
      // Reset transactions first to avoid showing stale data
      setTransactions([]);
      fetchTransactions(selectedAccount._id);
    } else {
      // Clear transactions when no account is selected
      setTransactions([]);
    }
  }, [selectedAccount, dateRange]);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      
      const response = await financialService.getBankAccounts();
      
      // Handle different response structures
      let accountsData = [];
      if (Array.isArray(response)) {
        accountsData = response;
      } else if (response.data && Array.isArray(response.data)) {
        accountsData = response.data;
      } else if (response.data && response.data.accounts && Array.isArray(response.data.accounts)) {
        accountsData = response.data.accounts;
      } else if (response.accounts && Array.isArray(response.accounts)) {
        accountsData = response.accounts;
      } else {
      }
      
      
      setAccounts(accountsData);
      
      if (accountsData.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsData[0]);
        // Reset transactions when setting a new selected account
        setTransactions([]);
      }
    } catch (error: unknown) {
      toast.error('Failed to fetch bank accounts: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (accountId: string) => {
    try {
      
      const filters: Record<string, unknown> = {};
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
      
      
      const response = await financialService.getBankTransactions(accountId, filters);
      
      if (response && response.data && response.data.transactions) {
        setTransactions(response.data.transactions);
      } else if (response && response.data && Array.isArray(response.data)) {
        // Handle case where response.data is directly an array
        setTransactions(response.data);
      } else {
        setTransactions([]);
      }
    } catch (error: unknown) {
      toast.error('Failed to fetch transactions: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

     const handleAddAccount = () => {
     setEditMode(false);
     setAccountFormData({
       accountNumber: '',
       accountName: '',
       bankName: '',
       accountType: 'savings',
       currency: 'INR',
       openingBalance: 0,
       openingDate: new Date().toISOString().split('T')[0],
       branchName: '',
       ifscCode: '',
       swiftCode: '',
       isPrimary: false
     });
     setShowAccountDialog(true);
   };

  const handleEditAccount = (account: BankAccount) => {
    setEditMode(true);
    setAccountFormData({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      accountType: account.accountType,
      currency: account.currency,
      openingBalance: account.openingBalance,
      openingDate: safeFormatDate(account.openingDate, 'yyyy-MM-dd'),
      branchName: account.branchName || '',
      ifscCode: account.ifscCode || '',
      swiftCode: account.swiftCode || '',
      isPrimary: account.isPrimary
    });
    setShowAccountDialog(true);
  };

  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editMode && selectedAccount) {
        await financialService.updateBankAccount(selectedAccount._id, accountFormData);
        toast.success('Bank account updated successfully');
      } else {
        await financialService.createBankAccount(accountFormData);
        toast.success('Bank account created successfully');
      }
      setShowAccountDialog(false);
      fetchBankAccounts();
    } catch (error: unknown) {
      toast.error('Failed to save bank account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (account: BankAccount) => {
    try {
      setSubmitting(true);
      await financialService.deleteBankAccount(account._id);
      toast.success('Bank account deactivated successfully');
      fetchBankAccounts();
      setDeleteAccount(null);
    } catch (error: unknown) {
      toast.error('Failed to deactivate account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTransaction = () => {
    if (!selectedAccount) { toast.error('Please select a bank account first'); return; }
    setTransactionFormData({
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      referenceNumber: '',
      transactionType: 'Deposit',
      amount: 0
    });
    setShowTransactionDialog(true);
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (selectedAccount) {
        // Prepare transaction data in the format expected by the backend
        const transactionData = {
          transactionDate: new Date(transactionFormData.transactionDate),
          description: transactionFormData.description,
          referenceNumber: transactionFormData.referenceNumber,
          transactionType: transactionFormData.transactionType,
          creditAmount: transactionFormData.transactionType === 'Deposit' || transactionFormData.transactionType === 'Interest'
            ? transactionFormData.amount
            : transactionFormData.transactionType === 'Adjustment' && transactionFormData.amount > 0
              ? transactionFormData.amount
              : 0,
          debitAmount: transactionFormData.transactionType === 'Withdrawal' || transactionFormData.transactionType === 'Fee' || transactionFormData.transactionType === 'Transfer'
            ? transactionFormData.amount
            : transactionFormData.transactionType === 'Adjustment' && transactionFormData.amount < 0
              ? Math.abs(transactionFormData.amount)
              : 0
        };

        await financialService.createBankTransaction(selectedAccount._id, transactionData);
        toast.success('Transaction added successfully');
        setShowTransactionDialog(false);
        fetchTransactions(selectedAccount._id);
        fetchBankAccounts(); // Refresh balances
      }
    } catch (error: unknown) {
      toast.error('Failed to add transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReconcile = async (account: BankAccount) => {
    setSelectedAccount(account);
    // Fetch unreconciled transactions
    try {
      const response = await financialService.getUnreconciledTransactions(account._id);
      setReconciliationData({
        statementDate: new Date(),
        statementBalance: 0,
        reconciledBalance: account.currentBalance,
        difference: 0,
                 items: response.data.map((t: Transaction) => ({
           transactionId: t._id,
           date: t.transactionDate,
           description: t.description,
           amount: t.creditAmount - t.debitAmount,
           cleared: false
         }))
      });
      setShowReconcileDialog(true);
    } catch (error: unknown) {
      toast.error('Failed to load reconciliation data: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleSubmitReconciliation = async () => {
    try {
      setSubmitting(true);
      if (selectedAccount && reconciliationData) {
        await financialService.reconcileBankAccount(selectedAccount._id, reconciliationData);
        toast.success('Account reconciled successfully');
        setShowReconcileDialog(false);
        fetchBankAccounts();
        fetchTransactions(selectedAccount._id);
      }
    } catch (error: unknown) {
      toast.error('Failed to reconcile account: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  // Reset pagination when filters change
  useEffect(() => { setAccountPage(1); }, [searchTerm, filterType, filterStatus]);
  useEffect(() => { setTxnPage(1); }, [dateRange, selectedAccount]);

  const filteredAccounts = (Array.isArray(accounts) ? accounts : []).filter(account => {
    const matchesSearch = account.accountName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.bankName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         account.accountNumber?.includes(searchTerm);
    const matchesType = filterType === 'all' || account.accountType === filterType;
    const matchesStatus = filterStatus === 'all' ||
                         (filterStatus === 'active' && account.isActive) ||
                         (filterStatus === 'inactive' && !account.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalAccountPages = Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE);
  const paginatedAccounts = filteredAccounts.slice((accountPage - 1) * ITEMS_PER_PAGE, accountPage * ITEMS_PER_PAGE);

  const totalTxnPages = Math.ceil((Array.isArray(transactions) ? transactions.length : 0) / ITEMS_PER_PAGE);
  const paginatedTransactions = (Array.isArray(transactions) ? transactions : []).slice((txnPage - 1) * ITEMS_PER_PAGE, txnPage * ITEMS_PER_PAGE);

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'checking': return <Building className="w-4 h-4" />;
      case 'savings': return <Wallet className="w-4 h-4" />;
      case 'credit': return <CreditCard className="w-4 h-4" />;
      case 'cash': return <Wallet className="w-4 h-4" />;
      case 'loan': return <TrendingDown className="w-4 h-4" />;
      case 'investment': return <TrendingUp className="w-4 h-4" />;
      default: return <IndianRupee className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reconciled': return 'default';
      case 'pending': return 'secondary';
      case 'discrepancy': return 'destructive';
      default: return 'outline';
    }
  };

  const totalBalance = (Array.isArray(accounts) ? accounts : []).reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  const activeAccounts = (Array.isArray(accounts) ? accounts : []).filter(acc => acc.isActive).length;

  // Log state changes for debugging

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bank Account Management</h1>
          <p className="text-gray-600">Manage bank accounts and reconciliation</p>
        </div>
        {!readOnly && (
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => toast.info('Bank statement import coming soon')}>
            <Upload className="w-4 h-4 mr-2" />
            Import Statement
          </Button>
          <Button onClick={handleAddAccount}>
            <Plus className="w-4 h-4 mr-2" />
            Add Account
          </Button>
        </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
              <IndianRupee className="w-5 h-5 text-gray-400" />
            </div>
            {totalBalance > 0 ? (
              <div className="flex items-center text-green-600 text-sm mt-1">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                <span>Positive Balance</span>
              </div>
            ) : totalBalance < 0 ? (
              <div className="flex items-center text-red-600 text-sm mt-1">
                <ArrowDownRight className="w-4 h-4 mr-1" />
                <span>Negative Balance</span>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold">{activeAccounts}</p>
              <Building className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              of {Array.isArray(accounts) ? accounts.length : 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Reconciliation</CardTitle>
          </CardHeader>
          <CardContent>
                         <div className="flex items-center justify-between">
               <p className="text-2xl font-bold">
                 {(Array.isArray(accounts) ? accounts : []).filter(acc => Array.isArray(acc.transactions) && acc.transactions.some(t => !t.isReconciled)).length}
               </p>
               <AlertCircle className="w-5 h-5 text-yellow-500" />
             </div>
             <p className="text-sm text-gray-600 mt-1">
               Accounts need attention
             </p>
          </CardContent>
        </Card>

                 <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium text-gray-600">Last Activity</CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex items-center justify-between">
               <p className="text-sm font-medium">
                 {selectedAccount && Array.isArray(selectedAccount.transactions) && selectedAccount.transactions.length > 0
                   ? safeFormatDate(selectedAccount.transactions[selectedAccount.transactions.length - 1].transactionDate, 'MMM dd, yyyy')
                   : 'No activity'}
               </p>
               <Activity className="w-5 h-5 text-gray-400" />
             </div>
             <p className="text-sm text-gray-600 mt-1">
                               {selectedAccount ? `${Array.isArray(selectedAccount.transactions) ? selectedAccount.transactions.length : 0} transactions` : 'Select account'}
             </p>
           </CardContent>
         </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search accounts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Account Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {accountTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Accounts Table */}
          <Card>
            <CardHeader>
              <CardTitle>Bank Accounts ({filteredAccounts.length})</CardTitle>
              <CardDescription>Manage your organization's bank accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Reconciliation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAccounts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <p className="text-gray-600">No bank accounts found</p>
                      </TableCell>
                    </TableRow>
                  ) : paginatedAccounts.map((account) => (
                    <TableRow key={account._id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getAccountTypeIcon(account.accountType)}
                          <div>
                            <p className="font-medium">{account.accountName}</p>
                            {account.isPrimary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{account.bankName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.accountType?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        •••• {account.accountNumber?.slice(-4) || '****'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <p className={`font-medium ${account.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(account.currentBalance)}
                          </p>
                                                     <p className="text-xs text-gray-500">
                             Available: {formatCurrency(account.availableBalance)}
                           </p>
                        </div>
                      </TableCell>
                                             <TableCell>
                                                   <Badge variant={getStatusColor(Array.isArray(account.transactions) && account.transactions.some(t => !t.isReconciled) ? 'pending' : 'reconciled')}>
                            {Array.isArray(account.transactions) && account.transactions.some(t => !t.isReconciled) ? 'Pending' : 'Reconciled'}
                          </Badge>
                       </TableCell>
                      <TableCell>
                        <Badge variant={account.isActive ? 'default' : 'secondary'}>
                          {account.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedAccount(account)}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReconcile(account)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAccount(account)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteAccount(account)}
                            disabled={account.isPrimary}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalAccountPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {(accountPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(accountPage * ITEMS_PER_PAGE, filteredAccounts.length)} of {filteredAccounts.length}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAccountPage(p => Math.max(1, p - 1))} disabled={accountPage <= 1}>Previous</Button>
                    <Button size="sm" variant="outline" onClick={() => setAccountPage(p => Math.min(totalAccountPages, p + 1))} disabled={accountPage >= totalAccountPages}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {selectedAccount ? (
            <>
              {/* Selected Account Info */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>{selectedAccount.accountName}</CardTitle>
                      <CardDescription>
                        {selectedAccount.bankName} • {selectedAccount.accountNumber}
                      </CardDescription>
                    </div>
                    <Button onClick={handleAddTransaction}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Transaction
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Date Range Filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Transaction Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-4">
                    <div className="flex-1">
                      <Label htmlFor="startDate">Start Date</Label>
                      <Input
                        id="startDate"
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="endDate">End Date</Label>
                      <Input
                        id="endDate"
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button variant="outline" onClick={() => fetchTransactions(selectedAccount._id)}>
                        <Filter className="w-4 h-4 mr-2" />
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Transactions Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>Recent transactions for this account</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.length > 0 ? (
                        paginatedTransactions.map((transaction) => (
                        <TableRow key={transaction._id}>
                          <TableCell>
                            {safeFormatDate(transaction.transactionDate, 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                                                   <TableCell className="font-mono text-sm">
                           {transaction.referenceNumber || '-'}
                         </TableCell>
                         <TableCell>
                           <Badge variant="outline">
                             {transaction.transactionType}
                           </Badge>
                         </TableCell>
                         <TableCell className="text-right text-red-600">
                           {transaction.debitAmount > 0 ? formatCurrency(transaction.debitAmount) : '-'}
                         </TableCell>
                         <TableCell className="text-right text-green-600">
                           {transaction.creditAmount > 0 ? formatCurrency(transaction.creditAmount) : '-'}
                         </TableCell>
                         <TableCell className="text-right font-medium">
                           {formatCurrency(transaction.balance)}
                         </TableCell>
                         <TableCell>
                           {transaction.isReconciled ? (
                             <Badge variant="default">
                               <CheckCircle className="w-3 h-3 mr-1" />
                               Reconciled
                             </Badge>
                           ) : (
                             <Badge variant="secondary">Pending</Badge>
                           )}
                         </TableCell>
                        </TableRow>
                      ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <p className="text-gray-600">No transactions found for this account</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {totalTxnPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-gray-600">
                        Showing {(txnPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(txnPage * ITEMS_PER_PAGE, transactions.length)} of {transactions.length}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setTxnPage(p => Math.max(1, p - 1))} disabled={txnPage <= 1}>Previous</Button>
                        <Button size="sm" variant="outline" onClick={() => setTxnPage(p => Math.min(totalTxnPages, p + 1))} disabled={txnPage >= totalTxnPages}>Next</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-600">Select an account to view transactions</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reconciliation">
          <Card>
            <CardHeader>
              <CardTitle>Bank Reconciliation</CardTitle>
              <CardDescription>Reconcile your bank accounts with statements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Select an account to start reconciliation</p>
                {accounts.filter(a => a.isActive).map(account => (
                  <div key={account._id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{account.accountName}</p>
                      <p className="text-sm text-gray-500">{account.bankName} - {account.accountNumber?.slice(-4)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={account.reconciliationStatus === 'reconciled' ? 'default' : 'secondary'}>
                        {account.reconciliationStatus || 'pending'}
                      </Badge>
                      <Button size="sm" onClick={() => handleReconcile(account)}>Reconcile</Button>
                    </div>
                  </div>
                ))}
                {accounts.filter(a => a.isActive).length === 0 && (
                  <p className="text-center text-gray-500 py-4">No active accounts to reconcile</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle>Banking Reports</CardTitle>
              <CardDescription>View detailed banking reports and analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Report generation coming soon')}>
                  <FileText className="w-4 h-4 mr-2" />
                  Bank Statement Report
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Report generation coming soon')}>
                  <Receipt className="w-4 h-4 mr-2" />
                  Cash Position Report
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Report generation coming soon')}>
                  <Activity className="w-4 h-4 mr-2" />
                  Transaction Analysis
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => toast.info('Report generation coming soon')}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Cash Flow Forecast
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Account Dialog */}
      <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Edit Bank Account' : 'Add New Bank Account'}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'Update bank account information' : 'Add a new bank account to your organization'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitAccount} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  value={accountFormData.accountName}
                  onChange={(e) => setAccountFormData({...accountFormData, accountName: e.target.value})}
                  placeholder="e.g., Main Operating Account"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={accountFormData.accountNumber}
                  onChange={(e) => setAccountFormData({...accountFormData, accountNumber: e.target.value})}
                  placeholder="e.g., 1234567890"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={accountFormData.bankName}
                  onChange={(e) => setAccountFormData({...accountFormData, bankName: e.target.value})}
                  placeholder="e.g., State Bank of India"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountType">Account Type</Label>
                <Select
                  value={accountFormData.accountType}
                  onValueChange={(value: string) => setAccountFormData({...accountFormData, accountType: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="branchName">Branch Name</Label>
                <Input
                  id="branchName"
                  value={accountFormData.branchName}
                  onChange={(e) => setAccountFormData({...accountFormData, branchName: e.target.value})}
                  placeholder="e.g., Main Branch"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ifscCode">IFSC Code</Label>
                <Input
                  id="ifscCode"
                  value={accountFormData.ifscCode}
                  onChange={(e) => setAccountFormData({...accountFormData, ifscCode: e.target.value})}
                  placeholder="e.g., SBIN0001234"
                  pattern="^[A-Z]{4}0[A-Z0-9]{6}$"
                  title="Enter valid IFSC code (e.g., SBIN0001234)"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="swiftCode">SWIFT Code</Label>
                <Input
                  id="swiftCode"
                  value={accountFormData.swiftCode}
                  onChange={(e) => setAccountFormData({...accountFormData, swiftCode: e.target.value})}
                  placeholder="e.g., SBININBB"
                  pattern="^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$"
                  title="Enter valid SWIFT code (8 or 11 characters)"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="openingBalance">Opening Balance</Label>
                <Input
                  id="openingBalance"
                  type="number"
                  step="0.01"
                  value={accountFormData.openingBalance}
                  onChange={(e) => setAccountFormData({...accountFormData, openingBalance: parseFloat(e.target.value) || 0})}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="openingDate">Opening Date</Label>
                <Input
                  id="openingDate"
                  type="date"
                  value={accountFormData.openingDate}
                  onChange={(e) => setAccountFormData({...accountFormData, openingDate: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={accountFormData.currency}
                  onValueChange={(value) => setAccountFormData({...accountFormData, currency: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={accountFormData.isPrimary}
                onChange={(e) => setAccountFormData({...accountFormData, isPrimary: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="isPrimary">Set as primary account</Label>
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowAccountDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : `${editMode ? 'Update' : 'Create'} Account`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>
              Record a new transaction for {selectedAccount?.accountName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitTransaction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="transactionDate">Date</Label>
                <Input
                  id="transactionDate"
                  type="date"
                  value={transactionFormData.transactionDate}
                  onChange={(e) => setTransactionFormData({...transactionFormData, transactionDate: e.target.value})}
                  required
                />
              </div>
                             <div className="space-y-2">
                 <Label htmlFor="transactionType">Type</Label>
                 <Select
                   value={transactionFormData.transactionType}
                   onValueChange={(value: string) => setTransactionFormData({...transactionFormData, transactionType: value})}
                 >
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {transactionTypes.map(type => (
                       <SelectItem key={type.value} value={type.value}>
                         {type.label}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={transactionFormData.description}
                onChange={(e) => setTransactionFormData({...transactionFormData, description: e.target.value})}
                placeholder="Transaction description"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
                             <div className="space-y-2">
                 <Label htmlFor="referenceNumber">Reference</Label>
                 <Input
                   id="referenceNumber"
                   value={transactionFormData.referenceNumber}
                   onChange={(e) => setTransactionFormData({...transactionFormData, referenceNumber: e.target.value})}
                   placeholder="e.g., CHQ-001234"
                 />
               </div>
               <div className="space-y-2">
                 <Label htmlFor="amount">Amount</Label>
                 <Input
                   id="amount"
                   type="number"
                   step="0.01"
                   value={transactionFormData.amount}
                   onChange={(e) => setTransactionFormData({...transactionFormData, amount: parseFloat(e.target.value) || 0})}
                   placeholder="0.00"
                   required
                 />
               </div>
            </div>

            

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowTransactionDialog(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Adding...' : 'Add Transaction'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteAccount} onOpenChange={() => setDeleteAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Bank Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate "{deleteAccount?.accountName}"? 
              This account will be hidden from active lists but transaction history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAccount && handleDeleteAccount(deleteAccount)} disabled={submitting}>
              {submitting ? 'Deactivating...' : 'Deactivate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reconciliation Dialog */}
      <Dialog open={showReconcileDialog} onOpenChange={setShowReconcileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bank Reconciliation</DialogTitle>
            <DialogDescription>Reconcile bank account transactions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {reconciliationData ? (
              <div>
                <p>Statement Balance: {formatCurrency(reconciliationData.statementBalance)}</p>
                <p>Reconciled Balance: {formatCurrency(reconciliationData.reconciledBalance)}</p>
                <p>Difference: {formatCurrency(reconciliationData.difference)}</p>
                <p className="text-sm text-gray-500 mt-2">{reconciliationData.items?.length || 0} items to reconcile</p>
              </div>
            ) : (
              <p className="text-gray-500">Loading reconciliation data...</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowReconcileDialog(false)} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmitReconciliation} disabled={!reconciliationData || submitting}>
                {submitting ? 'Reconciling...' : 'Complete Reconciliation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const BankAccountManagement = withErrorBoundary(BankAccountManagementInner, { level: 'component' });
export default BankAccountManagement;