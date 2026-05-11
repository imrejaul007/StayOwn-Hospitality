import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, RotateCcw } from 'lucide-react';
import financialService, { JournalEntry, ChartOfAccount } from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as Record<string, unknown>).message);
  return 'An unexpected error occurred';
};

interface EntryFormData {
  date: string;
  reference: string;
  description: string;
  journal: string;
  entries: Array<{
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;
}

interface GeneralLedgerProps {
  readOnly?: boolean;
}

const GeneralLedger: React.FC<GeneralLedgerProps> = ({ readOnly = false }) => {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterJournal, setFilterJournal] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDialog, setShowDialog] = useState(false);
  const [reverseEntry, setReverseEntry] = useState<JournalEntry | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const [formData, setFormData] = useState<EntryFormData>({
    date: new Date().toISOString().split('T')[0],
    reference: '',
    description: '',
    journal: 'general',
    entries: [
      { account: '', debit: 0, credit: 0, description: '' },
      { account: '', debit: 0, credit: 0, description: '' }
    ]
  });

  const journalTypes = [
    { value: 'general', label: 'General Journal' },
    { value: 'sales', label: 'Sales Journal' },
    { value: 'purchase', label: 'Purchase Journal' },
    { value: 'cash_receipts', label: 'Cash Receipts' },
    { value: 'cash_disbursements', label: 'Cash Disbursements' },
    { value: 'payroll', label: 'Payroll Journal' }
  ];

  useEffect(() => {
    fetchJournalEntries();
    fetchAccounts();
  }, [filterJournal, filterStatus, dateRange]);

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      const filters: Record<string, unknown> = {};
      if (filterJournal) filters.journal = filterJournal;
      if (filterStatus) filters.status = filterStatus;
      if (dateRange.start) filters.startDate = dateRange.start;
      if (dateRange.end) filters.endDate = dateRange.end;
      
      const response = await financialService.getJournalEntries(filters);

      // Use standardized backend response structure: response.data.entries
      const entriesData = response.data?.entries || [];

      setJournalEntries(entriesData);
    } catch (error: unknown) {
      toast.error('Failed to fetch journal entries: ' + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await financialService.getAccounts({ active: true });

      // Use standardized backend response structure: response.data.accounts
      const accountsData = response.data?.accounts || [];

      setAccounts(accountsData);
    } catch (error: unknown) {
      toast.error('Failed to fetch accounts: ' + getErrorMessage(error));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate balanced entry
    const totalDebits = formData.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredits = formData.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      toast.error('Journal entry must be balanced. Total debits must equal total credits.');
      return;
    }

    try {
      const entryData = {
        ...formData,
        entryId: `JE-${Date.now()}`,
        totalDebit: totalDebits,
        totalCredit: totalCredits,
        period: {
          month: new Date(formData.date).getMonth() + 1,
          year: new Date(formData.date).getFullYear()
        },
        entries: formData.entries.filter(entry => entry.account && (entry.debit > 0 || entry.credit > 0))
      };

      await financialService.createJournalEntry(entryData);
      toast.success('Journal entry created successfully');
      
      setShowDialog(false);
      resetForm();
      fetchJournalEntries();
    } catch (error: unknown) {
      toast.error('Failed to create journal entry: ' + getErrorMessage(error));
    }
  };

  const handleReverse = async () => {
    if (!reverseEntry) return;
    
    try {
      await financialService.reverseJournalEntry(reverseEntry._id);
      toast.success('Journal entry reversed successfully');
      setReverseEntry(null);
      fetchJournalEntries();
    } catch (error: unknown) {
      toast.error('Failed to reverse journal entry: ' + getErrorMessage(error));
    }
  };

  const addEntry = () => {
    setFormData({
      ...formData,
      entries: [...formData.entries, { account: '', debit: 0, credit: 0, description: '' }]
    });
  };

  const removeEntry = (index: number) => {
    if (formData.entries.length > 2) {
      const newEntries = formData.entries.filter((_, i) => i !== index);
      setFormData({ ...formData, entries: newEntries });
    }
  };

  const updateEntry = (index: number, field: string, value: unknown) => {
    const newEntries = [...formData.entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    setFormData({ ...formData, entries: newEntries });
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      reference: '',
      description: '',
      journal: 'general',
      entries: [
        { account: '', debit: 0, credit: 0, description: '' },
        { account: '', debit: 0, credit: 0, description: '' }
      ]
    });
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterJournal, filterStatus, dateRange]);

  const filteredEntries = (Array.isArray(journalEntries) ? journalEntries : []).filter(entry =>
    entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.referenceNumber || entry.reference)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.entryNumber || entry.entryId)?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / ITEMS_PER_PAGE));
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTotalDebits = () => {
    return formData.entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  };

  const getTotalCredits = () => {
    return formData.entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  };

  const isBalanced = () => {
    return Math.abs(getTotalDebits() - getTotalCredits()) < 0.01;
  };

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
          <h1 className="text-3xl font-bold">General Ledger</h1>
          <p className="text-gray-600">Manage journal entries and transactions</p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          {!readOnly && (
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Entry
            </Button>
          </DialogTrigger>
          )}
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
              <DialogDescription>
                Create a new journal entry with balanced debits and credits
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="journal">Journal Type</Label>
                  <Select
                    value={formData.journal}
                    onValueChange={(value) => setFormData({ ...formData, journal: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {journalTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference">Reference</Label>
                  <Input
                    id="reference"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    placeholder="e.g., INV-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Journal entry description"
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-lg font-medium">Journal Entries</Label>
                  <Button type="button" onClick={addEntry} variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.entries.map((entry, index) => (
                        <TableRow key={`formData-entries-${index}`}>
                          <TableCell className="w-48">
                            <Select
                              value={entry.account}
                              onValueChange={(value) => updateEntry(index, 'account', value)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select account" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Array.isArray(accounts) ? accounts : []).map(account => (
                                  <SelectItem key={account._id} value={account._id}>
                                    {account.accountCode} - {account.accountName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              value={entry.description}
                              onChange={(e) => updateEntry(index, 'description', e.target.value)}
                              placeholder="Line description"
                              className="w-full"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry.debit || ''}
                              onChange={(e) => updateEntry(index, 'debit', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={entry.credit || ''}
                              onChange={(e) => updateEntry(index, 'credit', parseFloat(e.target.value) || 0)}
                              className="w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeEntry(index)}
                              disabled={formData.entries.length <= 2}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <span className="text-sm text-gray-600">Total Debits:</span>
                      <div className="font-bold text-lg">{formatCurrency(getTotalDebits())}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Total Credits:</span>
                      <div className="font-bold text-lg">{formatCurrency(getTotalCredits())}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={isBalanced() ? "default" : "destructive"}>
                      {isBalanced() ? 'Balanced' : 'Out of Balance'}
                    </Badge>
                    {!isBalanced() && (
                      <div className="text-sm text-red-600 mt-1">
                        Difference: {formatCurrency(Math.abs(getTotalDebits() - getTotalCredits()))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!isBalanced()}>
                  Create Entry
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterJournal} onValueChange={setFilterJournal}>
              <SelectTrigger>
                <SelectValue placeholder="All journals" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Journals</SelectItem>
                {journalTypes.map(type => (
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="reversed">Reversed</SelectItem>
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

      {/* Journal Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entries ({filteredEntries.length})</CardTitle>
          <CardDescription>
            All journal entries and transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Journal</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No journal entries found. Create your first entry or adjust your filters.
                  </TableCell>
                </TableRow>
              )}
                             {paginatedEntries.map((entry) => (
                 <TableRow key={entry._id}>
                   <TableCell className="font-mono">{entry.entryNumber || entry.entryId}</TableCell>
                   <TableCell>{entry.entryDate ? new Date(entry.entryDate).toLocaleDateString('en-IN') : 'N/A'}</TableCell>
                   <TableCell>{entry.referenceNumber || entry.reference || 'N/A'}</TableCell>
                   <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                   <TableCell>
                     <Badge variant="outline">
                       {entry.entryType || 'Manual'}
                     </Badge>
                   </TableCell>
                   <TableCell>{formatCurrency(entry.totalDebit || 0)}</TableCell>
                   <TableCell>
                     <Badge 
                       variant={
                         entry.status === 'Posted' ? 'default' : 
                         entry.status === 'Draft' ? 'secondary' : 
                         'destructive'
                       }
                     >
                       {entry.status || 'Unknown'}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <div className="flex space-x-2">
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => setReverseEntry(entry)}
                         disabled={readOnly || entry.status !== 'Posted'}
                       >
                         <RotateCcw className="w-4 h-4" />
                       </Button>
                     </div>
                   </TableCell>
                 </TableRow>
               ))}
            </TableBody>
          </Table>
          {/* Pagination Controls */}
          {filteredEntries.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredEntries.length)} of{' '}
                {filteredEntries.length} entries
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

      {/* Reverse Entry Confirmation Dialog */}
      <AlertDialog open={!!reverseEntry} onOpenChange={() => setReverseEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Journal Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reverse journal entry "{reverseEntry?.entryId}"? 
              This will create a reversing entry with opposite debits and credits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReverse}>
              Reverse Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GeneralLedger;