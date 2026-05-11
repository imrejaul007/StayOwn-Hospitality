import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/utils/toast';
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Calculator,
  FileText,
  CreditCard,
  Building,
  Users,
  Calendar,
  Clock,
  RefreshCw,
  Settings,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Receipt,
  PieChart,
  BarChart3,
  Activity,
  Globe,
  Smartphone,
  Zap,
  Target,
  Eye,
  Plus
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import financialService from '@/services/financialService';
import { api } from '@/services/api';
import { withErrorBoundary } from '../ErrorBoundary';

interface AccountingIntegration {
  id: string;
  name: string;
  type: 'erp' | 'accounting' | 'banking' | 'payment';
  logo: string;
  isConnected: boolean;
  status: 'active' | 'inactive' | 'error' | 'syncing';
  lastSync: Date;
  autoSync: boolean;
  syncInterval: number;
  settings: {
    companyCode?: string;
    chartOfAccounts: { [key: string]: string };
    taxSettings: {
      defaultTaxRate: number;
      taxAccounts: { [key: string]: string };
    };
    currencies: string[];
    fiscalYearStart: string;
  };
}

interface FinancialTransaction {
  id: string;
  type: 'revenue' | 'expense' | 'receivable' | 'payable' | 'adjustment';
  date: Date;
  amount: number;
  currency: string;
  description: string;
  account: string;
  reference: string;
  status: 'pending' | 'posted' | 'reconciled' | 'error';
  guestName?: string;
  bookingId?: string;
  departmentId?: string;
  paymentMethod?: string;
  taxAmount?: number;
}

interface AgingReport {
  category: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  accountsReceivable: number;
  accountsPayable: number;
  cashFlow: number;
  currentRatio: number;
  revenueGrowth: number;
  expenseRatio: number;
  dsoRatio: number; // Days Sales Outstanding
}

interface CurrencyRate {
  currency: string;
  rate: number;
  lastUpdated: Date;
  trend: 'up' | 'down' | 'stable';
}

interface AccountingIntegrationDashboardProps {
  readOnly?: boolean;
}

const AccountingIntegrationDashboard: React.FC<AccountingIntegrationDashboardProps> = ({ readOnly: _readOnly = false }) => {
  const [integrations, setIntegrations] = useState<AccountingIntegration[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [agingReport, setAgingReport] = useState<AgingReport[]>([]);
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<AccountingIntegration | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCurrencies, setActiveCurrencies] = useState<Record<string, boolean>>({
    USD: false, EUR: false, GBP: false, AED: false, SGD: false
  });
  const [autoUpdateRates, setAutoUpdateRates] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Currency-aware formatting: converts INR amounts to selected currency
  const formatAmount = (amountInINR: number) => {
    if (baseCurrency === 'INR') {
      return formatCurrency(amountInINR);
    }
    // Find the exchange rate for selected currency
    const rate = currencyRates.find(r => r.currency === baseCurrency);
    if (rate && rate.rate > 0) {
      const converted = amountInINR / rate.rate; // rate is ₹ per 1 foreign unit
      return formatCurrency(converted, { currency: baseCurrency });
    }
    return formatCurrency(amountInINR);
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchFinancialData();
  }, [baseCurrency]);

  const fetchFinancialData = async () => {
    setIsLoading(true);
    try {
      
      // Fetch real financial data from backend APIs with improved error handling
      const [dashboardData, journalEntries, invoicesData, paymentsData, bankAccountsData] = await Promise.all([
        financialService.getFinancialDashboard(filterStartDate && filterEndDate ? 'custom' : 'all', filterStartDate, filterEndDate).catch((error) => {
          toast.error('Failed to load financial dashboard data');
          return {
            success: false,
            data: {
              summary: {
                totalRevenue: 0,
                totalExpenses: 0,
                netProfit: 0,
                profitMargin: 0,
                totalAssets: 0,
                totalLiabilities: 0,
                cashFlow: 0,
                accountsReceivable: 0,
                accountsPayable: 0
              },
              revenueBreakdown: { roomRevenue: 0, foodBeverage: 0, otherRevenue: 0 },
              expenseBreakdown: { operatingExpenses: 0, payroll: 0, utilities: 0, marketing: 0, other: 0 },
              trends: { labels: [], revenue: [], expenses: [], profit: [] },
              topAccounts: [],
              cashFlowData: { operating: 0, investing: 0, financing: 0, netCashFlow: 0 }
            }
          };
        }),
        financialService.getJournalEntries({
          ...(filterStartDate ? { startDate: filterStartDate } : {}),
          ...(filterEndDate ? { endDate: filterEndDate } : {})
        }).catch(() => {
          return { data: { entries: [] } };
        }),
        financialService.getInvoices({
          ...(filterStartDate ? { startDate: filterStartDate } : {}),
          ...(filterEndDate ? { endDate: filterEndDate } : {})
        }).catch(() => {
          return { data: [] };
        }),
        financialService.getPayments({
          ...(filterStartDate ? { startDate: filterStartDate } : {}),
          ...(filterEndDate ? { endDate: filterEndDate } : {})
        }).catch(() => {
          return { data: [] };
        }),
        financialService.getBankAccounts().catch((error) => {
          toast.error('Failed to load bank accounts');
          return { data: [] };
        })
      ]);


      // Set integrations (static for now, but connected to backend data availability)
      const hasDashboard = !!(dashboardData?.data || dashboardData);
      const hasBookings = (dashboardData?.data?.summary?.bookingCount || 0) > 0;
      const liveIntegrations: AccountingIntegration[] = [
        {
          id: 'booking_system',
          name: 'Booking & Revenue System',
          type: 'accounting',
          logo: '/logos/quickbooks.png',
          isConnected: hasDashboard,
          status: hasDashboard ? 'active' : 'inactive',
          lastSync: new Date(Date.now() - 300000),
          autoSync: true,
          syncInterval: 60,
          settings: {
            companyCode: 'HOTEL001',
            chartOfAccounts: {
              'room_revenue': '4000',
              'fb_revenue': '4100',
              'other_revenue': '4900',
              'cost_of_sales': '5000',
              'operating_expenses': '6000',
              'accounts_receivable': '1200',
              'accounts_payable': '2100'
            },
            taxSettings: {
              defaultTaxRate: 18,
              taxAccounts: {
                'cgst': '2300',
                'sgst': '2301',
                'igst': '2302'
              }
            },
            currencies: ['INR', 'USD', 'EUR', 'GBP'],
            fiscalYearStart: '04-01'
          }
        },
        {
          id: 'financial_system',
          name: 'Chart of Accounts & Ledger',
          type: 'accounting',
          logo: '/logos/system.png',
          isConnected: hasDashboard,
          status: hasDashboard ? 'active' : 'inactive',
          lastSync: new Date(),
          autoSync: true,
          syncInterval: 30,
          settings: {
            companyCode: 'HOTEL',
            chartOfAccounts: {
              'room_revenue': '4000',
              'fb_revenue': '4100',
              'accounts_receivable': '1200',
              'accounts_payable': '2100'
            },
            taxSettings: {
              defaultTaxRate: 18,
              taxAccounts: {
                'input_tax': '2400',
                'output_tax': '2300'
              }
            },
            currencies: ['INR', 'USD'],
            fiscalYearStart: '04-01'
          }
        }
      ];

      // Transform journal entries to transactions
      const transformedTransactions: FinancialTransaction[] = [];
      const entriesArray = journalEntries?.data?.entries || journalEntries?.entries || [];

      if (Array.isArray(entriesArray) && entriesArray.length > 0) {
        entriesArray.slice(0, 10).forEach((entry: Record<string, unknown>) => {
          if (entry?.lines && Array.isArray(entry.lines)) {
            entry.lines.forEach((line: Record<string, unknown>, index: number) => {
              transformedTransactions.push({
                id: `${entry._id}-${index}`,
                type: line.debitAmount > 0 ? 'expense' : 'revenue',
                date: new Date(entry.entryDate || entry.createdAt || new Date()),
                amount: line.debitAmount || line.creditAmount || 0,
                currency: line.currency || 'INR',
                description: line.description || entry.description || 'Financial Entry',
                account: line.accountId?._id || line.accountId || '1000',
                reference: entry.referenceNumber || entry.entryNumber || 'N/A',
                status: entry.status?.toLowerCase() === 'posted' ? 'posted' : 'pending'
              });
            });
          }
        });
      }

      // Transform payments to transactions
      const paymentsArray = paymentsData?.data?.payments || paymentsData?.data || [];
      if (Array.isArray(paymentsArray) && paymentsArray.length > 0) {
        paymentsArray.slice(0, 10).forEach((payment: Record<string, unknown>) => {
          transformedTransactions.push({
            id: `pay-${payment._id}`,
            type: 'revenue',
            date: new Date(payment.paymentDate || payment.createdAt || new Date()),
            amount: (payment.amount as number) || 0,
            currency: (payment.currency as string) || 'INR',
            description: `Payment - ${payment.method || 'Unknown method'}`,
            account: '1001',
            reference: (payment.transactionId as string) || (payment.referenceNumber as string) || 'N/A',
            status: payment.status === 'completed' ? 'posted' : 'pending',
            guestName: payment.guestName as string || undefined
          });
        });
      }

      // If no financial transactions yet, pull from real bookings
      if (transformedTransactions.length === 0) {
        try {
          const bookingsResponse = await api.get('/bookings', {
            params: {
              limit: 10,
              sort: '-createdAt',
              ...(filterStartDate ? { startDate: filterStartDate } : {}),
              ...(filterEndDate ? { endDate: filterEndDate } : {})
            }
          });
          const bookingsArray = bookingsResponse.data?.data?.bookings || bookingsResponse.data?.bookings || [];
          if (Array.isArray(bookingsArray)) {
            bookingsArray.slice(0, 10).forEach((booking: Record<string, unknown>) => {
              transformedTransactions.push({
                id: `bkg-${booking._id}`,
                type: 'revenue',
                date: new Date((booking.checkIn as string) || (booking.createdAt as string) || new Date()),
                amount: (booking.totalAmount as number) || 0,
                currency: 'INR',
                description: `Booking - Room ${(booking.roomNumber as string) || (booking.rooms as unknown[])?.length || ''} (${(booking.status as string) || 'confirmed'})`,
                account: '4000',
                reference: (booking.bookingNumber as string) || (booking.confirmationNumber as string) || String(booking._id).slice(-8),
                status: ['checked_out', 'completed'].includes(booking.status as string) ? 'posted' : 'pending',
                guestName: (booking.guestName as string) || (booking.guest as Record<string, string>)?.name || undefined
              });
            });
          }
        } catch {
          // Bookings API not available — that's fine
        }
      }

      // Transform invoices to receivables
      const invoicesArray = invoicesData?.data || invoicesData || [];

      if (Array.isArray(invoicesArray) && invoicesArray.length > 0) {
        invoicesArray.slice(0, 5).forEach((invoice: Record<string, unknown>) => {
          if (invoice?.status !== 'paid' && invoice?.balanceAmount > 0) {
            transformedTransactions.push({
              id: `inv-${invoice._id}`,
              type: 'receivable',
              date: new Date(invoice.issueDate || invoice.createdAt || new Date()),
              amount: invoice.balanceAmount || invoice.totalAmount || 0,
              currency: invoice.currency || 'INR',
              description: `Invoice - ${invoice.invoiceNumber || invoice.invoiceId || 'Unknown'}`,
              account: '1200',
              reference: invoice.invoiceNumber || invoice.invoiceId || 'N/A',
              status: invoice.status === 'sent' ? 'pending' : 'posted',
              guestName: invoice.customer?.details?.name || invoice.customer?.name
            });
          }
        });
      }

      // Calculate aging report from invoices
      const agingReport: AgingReport[] = [
        {
          category: 'Guest Folios',
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0
        },
        {
          category: 'Corporate Accounts', 
          current: 0,
          days30: 0,
          days60: 0,
          days90: 0,
          over90: 0,
          total: 0
        }
      ];

      // Process invoices for aging
      if (Array.isArray(invoicesArray) && invoicesArray.length > 0) {
        invoicesArray.forEach((invoice: Record<string, unknown>) => {
          if (invoice?.status !== 'paid' && (invoice?.balanceAmount || 0) > 0) {
            const daysDiff = Math.floor(
              (new Date().getTime() - new Date(invoice.issueDate || invoice.createdAt || new Date()).getTime()) /
              (1000 * 3600 * 24)
            );
            const amount = (invoice.balanceAmount as number) || 0;
            const categoryIndex = (invoice.customer as Record<string, unknown>)?.type === 'corporate' ? 1 : 0;

            if (daysDiff <= 30) agingReport[categoryIndex].current += amount;
            else if (daysDiff <= 60) agingReport[categoryIndex].days30 += amount;
            else if (daysDiff <= 90) agingReport[categoryIndex].days60 += amount;
            else if (daysDiff <= 120) agingReport[categoryIndex].days90 += amount;
            else agingReport[categoryIndex].over90 += amount;
            agingReport[categoryIndex].total += amount;
          }
        });
      }

      // If no invoice aging data, calculate from real bookings with outstanding balances
      if (agingReport[0].total === 0 && agingReport[1].total === 0) {
        try {
          const bookingsForAging = await api.get('/bookings', {
            params: { limit: 200, sort: '-checkIn' }
          });
          const bkgs = bookingsForAging.data?.data?.bookings || bookingsForAging.data?.bookings || [];
          if (Array.isArray(bkgs)) {
            bkgs.forEach((bkg: Record<string, unknown>) => {
              const total = (bkg.totalAmount as number) || 0;
              const paid = ((bkg.paymentDetails as Record<string, number>)?.totalPaid) || 0;
              const outstanding = total - paid;
              if (outstanding <= 0) return;

              const checkIn = new Date((bkg.checkIn as string) || (bkg.createdAt as string));
              const daysDiff = Math.floor((Date.now() - checkIn.getTime()) / (1000 * 3600 * 24));

              if (daysDiff <= 30) agingReport[0].current += outstanding;
              else if (daysDiff <= 60) agingReport[0].days30 += outstanding;
              else if (daysDiff <= 90) agingReport[0].days60 += outstanding;
              else if (daysDiff <= 120) agingReport[0].days90 += outstanding;
              else agingReport[0].over90 += outstanding;
              agingReport[0].total += outstanding;
            });
          }
        } catch {
          // Bookings not available
        }
      }

      // Calculate metrics from dashboard data
      let calculatedMetrics: FinancialMetrics;
      
      // Handle both response formats - with or without success wrapper
      const actualDashboardData = dashboardData?.data || dashboardData;
      
      if (actualDashboardData && actualDashboardData.summary) {
        calculatedMetrics = {
          totalRevenue: actualDashboardData.summary.totalRevenue || 0,
          totalExpenses: actualDashboardData.summary.totalExpenses || 0,
          netIncome: (actualDashboardData.summary.totalRevenue || 0) - (actualDashboardData.summary.totalExpenses || 0),
          accountsReceivable: actualDashboardData.summary.accountsReceivable || agingReport.reduce((sum, cat) => sum + cat.total, 0),
          accountsPayable: actualDashboardData.summary.accountsPayable || 0,
          cashFlow: actualDashboardData.summary.cashFlow || 0,
          currentRatio: actualDashboardData.ratios?.currentRatio || 1.0,
          revenueGrowth: actualDashboardData.growth?.revenueGrowth || 0,
          expenseRatio: actualDashboardData.ratios?.expenseRatio || 0,
          dsoRatio: actualDashboardData.ratios?.dsoRatio || 30
        };
      } else {
        // Fallback calculation from available data
        const totalRevenue = transformedTransactions
          .filter(t => t.type === 'revenue')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = transformedTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + t.amount, 0);
        const totalReceivables = agingReport.reduce((sum, cat) => sum + cat.total, 0);
        
        calculatedMetrics = {
          totalRevenue,
          totalExpenses,
          netIncome: totalRevenue - totalExpenses,
          accountsReceivable: totalReceivables,
          accountsPayable: 0,
          cashFlow: totalRevenue - totalExpenses,
          currentRatio: 1.0,
          revenueGrowth: 0,
          expenseRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
          dsoRatio: 30
        };
      }

      // Fetch real exchange rates from currency API
      let fetchedRates: CurrencyRate[] = [];
      try {
        const ratesResponse = await api.get('/currencies/conversion-rates', {
          params: { baseCurrency: 'INR', targetCurrencies: 'USD,EUR,GBP' }
        });
        const ratesData = ratesResponse.data?.data?.conversionRates || ratesResponse.data?.conversionRates || ratesResponse.data?.data?.rates || ratesResponse.data?.rates || {};
        fetchedRates = Object.entries(ratesData).map(([currency, info]: [string, unknown]) => ({
          currency,
          rate: (() => {
            const rawRate = typeof info === 'object' && info !== null ? (info as Record<string, number>).rate || 0 : Number(info) || 0;
            // If base is INR, rates are fractions (0.012 for USD). Invert to show ₹ per 1 foreign unit.
            return rawRate > 0 && rawRate < 1 ? Number((1 / rawRate).toFixed(2)) : rawRate;
          })(),
          lastUpdated: new Date(),
          trend: 'stable' as const
        }));
      } catch {
        // No fallback — rates section will show empty if API unavailable
        fetchedRates = [];
      }

      // Only set integrations on first load — preserve user toggles after that
      setIntegrations(prev => prev.length === 0 ? liveIntegrations : prev.map(existing => {
        const live = liveIntegrations.find(l => l.id === existing.id);
        return live ? { ...live, isConnected: existing.isConnected, status: existing.isConnected ? live.status : 'inactive' } : existing;
      }));
      setTransactions(transformedTransactions);
      setAgingReport(agingReport);
      setMetrics(calculatedMetrics);
      setCurrencyRates(fetchedRates);
    } catch (error) {
      toast.error('Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIntegration = (integrationId: string, connected: boolean) => {
    // Update UI immediately
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, isConnected: connected, status: connected ? 'active' : 'inactive' }
        : integration
    ));
    toast.success(`${connected ? 'Connected to' : 'Disconnected from'} integration`);

    // Persist to backend in background (don't await)
    api.put(`/financial/integrations/${integrationId}/settings`, {
      isConnected: connected,
      status: connected ? 'active' : 'inactive'
    }).catch(() => {});
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: 'syncing' }
          : integration
      ));

      // Actually re-fetch financial data
      await fetchFinancialData();
      if (!isMountedRef.current) return;

      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: 'active', lastSync: new Date() }
          : integration
      ));
      
      toast.success('Synchronization completed');
      fetchFinancialData(); // Refresh data
    } catch (error) {
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId 
          ? { ...integration, status: 'error' }
          : integration
      ));
      toast.error('Synchronization failed');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'syncing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'inactive': return <Clock className="w-4 h-4 text-gray-400" />;
      default: return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'syncing': return 'bg-blue-100 text-blue-700';
      case 'error': return 'bg-red-100 text-red-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'revenue': return <ArrowUpRight className="w-4 h-4 text-green-600" />;
      case 'expense': return <ArrowDownRight className="w-4 h-4 text-red-600" />;
      case 'receivable': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'payable': return <CreditCard className="w-4 h-4 text-orange-600" />;
      default: return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getIntegrationIcon = (type: string) => {
    switch (type) {
      case 'erp': return <Building className="w-5 h-5" />;
      case 'accounting': return <Calculator className="w-5 h-5" />;
      case 'banking': return <Wallet className="w-5 h-5" />;
      case 'payment': return <CreditCard className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const getCurrencyTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-green-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Activity className="w-3 h-3 text-gray-500" />;
    }
  };

  const exportFinancialData = async (format: 'excel' | 'pdf' | 'csv') => {
    try {
      if (!metrics || transactions.length === 0) {
        toast.error('No financial data available to export');
        return;
      }
      // Build CSV from real transaction data
      const lines: string[] = ['Type,Date,Description,Reference,Amount,Status'];
      transactions.forEach(t => {
        lines.push(`${t.type},${t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date},"${(t.description || '').replace(/"/g, '""')}",${t.reference},${t.amount},${t.status}`);
      });
      const csvContent = lines.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `financial-transactions-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'csv' : format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      if (!isMountedRef.current) return;
      toast.success(`Financial data exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (isLoading && !metrics) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Financial & Accounting Integration</h1>
          <p className="text-gray-600">Connect and sync with your accounting systems</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INR">INR</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-36"
              placeholder="From"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-36"
              placeholder="To"
            />
          </div>

          <Button variant="outline" onClick={fetchFinancialData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {filterStartDate || filterEndDate ? 'Apply' : 'Refresh'}
          </Button>
          {(filterStartDate || filterEndDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterStartDate(''); setFilterEndDate(''); setTimeout(fetchFinancialData, 0); }}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      {metrics && (
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatAmount(metrics.totalRevenue)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">+{metrics.revenueGrowth}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Net Income</p>
                  <p className="text-2xl font-bold text-green-600">{formatAmount(metrics.netIncome)}</p>
                </div>
                <Target className="w-6 h-6 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Accounts Receivable</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatAmount(metrics.accountsReceivable)}</p>
                </div>
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="text-xs text-gray-500 mt-1">DSO: {metrics.dsoRatio} days</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cash Flow</p>
                  <p className="text-2xl font-bold text-blue-600">{formatAmount(metrics.cashFlow)}</p>
                </div>
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Current Ratio</p>
                  <p className="text-2xl font-bold">{(metrics.currentRatio ?? 0).toFixed(2)}</p>
                </div>
                <BarChart3 className="w-6 h-6 text-purple-500" />
              </div>
              <div className="text-xs text-gray-500 mt-1">Liquidity measure</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Integration Dashboard - No Tabs, Just Dashboard Content */}
      <div className="space-y-6">
        {/* Integration Cards */}
        <div>
          <h3 className="text-lg font-medium mb-4">System Integrations</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {integrations.map(integration => (
              <Card key={integration.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getIntegrationIcon(integration.type)}
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <p className="text-sm text-gray-500 capitalize">{integration.type}</p>
                      </div>
                    </div>

                    <Badge className={getStatusColor(integration.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(integration.status)}
                        <span className="text-xs capitalize">{integration.status}</span>
                      </div>
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-sm">
                    <p className="text-gray-600">Last Sync: {integration.lastSync.toLocaleString()}</p>
                    <p className="text-gray-600">Auto Sync: {integration.autoSync ? 'Enabled' : 'Disabled'}</p>
                    {integration.settings.companyCode && (
                      <p className="text-gray-600">Company: {integration.settings.companyCode}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={integration.isConnected}
                        onCheckedChange={(checked) => toggleIntegration(integration.id, checked)}
                        size="sm"
                      />
                      <span className="text-sm text-gray-600">
                        {integration.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      {integration.isConnected && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncIntegration(integration.id)}
                          disabled={integration.status === 'syncing'}
                        >
                          <RefreshCw className={`w-3 h-3 ${integration.status === 'syncing' ? 'animate-spin' : ''}`} />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedIntegration(integration);
                          setSettingsDialogOpen(true);
                        }}
                      >
                        <Settings className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Transactions Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => exportFinancialData('excel')}>
                  <Download className="w-3 h-3 mr-1" />
                  Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.json,.xlsx';
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    toast.success(`File "${file.name}" selected. Import processing is not yet available.`);
                  };
                  input.click();
                }}>
                  <Upload className="w-3 h-3 mr-1" />
                  Import
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      No transactions found. Transactions will appear here once bookings and payments are processed.
                    </TableCell>
                  </TableRow>
                )}
                {transactions.slice(0, 5).map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <span className="capitalize">{transaction.type}</span>
                      </div>
                    </TableCell>
                    <TableCell>{transaction.date instanceof Date ? transaction.date.toLocaleDateString('en-IN') : new Date(transaction.date).toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        {transaction.guestName && (
                          <p className="text-xs text-gray-500">{transaction.guestName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{transaction.reference}</TableCell>
                    <TableCell>
                      <div className="text-right">
                        <p className={`font-medium ${
                          transaction.type === 'revenue' ? 'text-green-600' :
                          transaction.type === 'expense' ? 'text-red-600' :
                          'text-gray-600'
                        }`}>
                          {formatAmount(transaction.amount)}
                        </p>
                        {transaction.taxAmount && (
                          <p className="text-xs text-gray-500">
                            Tax: {formatAmount(transaction.taxAmount)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        transaction.status === 'posted' ? 'bg-green-100 text-green-700' :
                        transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        transaction.status === 'reconciled' ? 'bg-blue-100 text-blue-700' :
                        'bg-red-100 text-red-700'
                      }>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {transactions.length > 5 && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm">
                  <Eye className="w-3 h-3 mr-1" />
                  View All Transactions
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts Receivable Aging Report */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts Receivable Aging Report</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>31-60 Days</TableHead>
                  <TableHead>61-90 Days</TableHead>
                  <TableHead>91-120 Days</TableHead>
                  <TableHead>Over 120 Days</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agingReport.map(report => (
                  <TableRow key={report.category}>
                    <TableCell className="font-medium">{report.category}</TableCell>
                    <TableCell>{formatAmount(report.current)}</TableCell>
                    <TableCell>{formatAmount(report.days30)}</TableCell>
                    <TableCell>{formatAmount(report.days60)}</TableCell>
                    <TableCell>{formatAmount(report.days90)}</TableCell>
                    <TableCell className={report.over90 > 0 ? 'text-red-600' : ''}>
                      {formatAmount(report.over90)}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatAmount(report.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exchange Rates */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Exchange Rates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {currencyRates.map(rate => (
                <div key={rate.currency} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{rate.currency}</span>
                    <div className="flex items-center gap-1">
                      {getCurrencyTrendIcon(rate.trend)}
                      <span className="text-sm text-gray-500">{rate.trend}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">₹{rate.rate.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      {rate.lastUpdated.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full mt-4" onClick={async () => {
                try {
                  const ratesResponse = await api.get('/currencies/conversion-rates', {
                    params: { baseCurrency, targetCurrencies: 'USD,EUR,GBP,AED,SGD' }
                  });
                  const ratesData = ratesResponse.data?.data?.conversionRates || ratesResponse.data?.conversionRates || ratesResponse.data?.data?.rates || ratesResponse.data?.rates || {};
                  const updated: CurrencyRate[] = Object.entries(ratesData).map(([currency, info]: [string, unknown]) => ({
                    currency,
                    rate: (() => {
            const rawRate = typeof info === 'object' && info !== null ? (info as Record<string, number>).rate || 0 : Number(info) || 0;
            // If base is INR, rates are fractions (0.012 for USD). Invert to show ₹ per 1 foreign unit.
            return rawRate > 0 && rawRate < 1 ? Number((1 / rawRate).toFixed(2)) : rawRate;
          })(),
                    lastUpdated: new Date(),
                    trend: 'stable' as const
                  }));
                  if (updated.length > 0) setCurrencyRates(updated);
                  toast.success('Exchange rates updated');
                } catch {
                  toast.error('Failed to update exchange rates');
                }
              }}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Rates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Currency Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Base Currency</Label>
                <Select value={baseCurrency} onValueChange={setBaseCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">Indian Rupee (INR)</SelectItem>
                    <SelectItem value="USD">US Dollar (USD)</SelectItem>
                    <SelectItem value="EUR">Euro (EUR)</SelectItem>
                    <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Active Currencies</Label>
                <div className="space-y-2">
                  {['USD', 'EUR', 'GBP', 'AED', 'SGD'].map(currency => (
                    <div key={currency} className="flex items-center gap-2">
                      <Switch
                        checked={activeCurrencies[currency] || false}
                        onCheckedChange={(checked) => setActiveCurrencies(prev => ({ ...prev, [currency]: checked }))}
                      />
                      <span className="text-sm">{currency}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Auto-Update Rates</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={autoUpdateRates}
                    onCheckedChange={setAutoUpdateRates}
                  />
                  <span className="text-sm text-gray-600">Daily at 9:00 AM</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={async () => {
                try {
                  await api.put('/financial/integrations/currency_settings/settings', {
                    baseCurrency,
                    activeCurrencies,
                    autoUpdateRates
                  });
                  toast.success('Currency settings saved');
                } catch {
                  toast.error('Failed to save currency settings');
                }
              }}>
                Save Currency Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Integration Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedIntegration && `${selectedIntegration.name} Settings`}
            </DialogTitle>
            <DialogDescription>
              Configure integration-specific settings and account mappings
            </DialogDescription>
          </DialogHeader>
          
          {selectedIntegration && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sync Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={selectedIntegration.syncInterval}
                    onChange={(e) => {
                      const updated = { ...selectedIntegration, syncInterval: parseInt(e.target.value) };
                      setSelectedIntegration(updated);
                    }}
                  />
                </div>
                <div>
                  <Label>Company Code</Label>
                  <Input
                    value={selectedIntegration.settings.companyCode || ''}
                    onChange={(e) => {
                      const updated = {
                        ...selectedIntegration,
                        settings: { ...selectedIntegration.settings, companyCode: e.target.value }
                      };
                      setSelectedIntegration(updated);
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={selectedIntegration.autoSync}
                  onCheckedChange={(checked) => {
                    const updated = { ...selectedIntegration, autoSync: checked };
                    setSelectedIntegration(updated);
                  }}
                />
                <Label>Enable Auto Sync</Label>
              </div>

              <div>
                <Label>Chart of Accounts Mapping</Label>
                <div className="space-y-2 mt-2">
                  {Object.entries(selectedIntegration.settings.chartOfAccounts).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-2 gap-2">
                      <Input value={key} disabled className="bg-gray-50" />
                      <Input 
                        value={value}
                        onChange={(e) => {
                          const updated = {
                            ...selectedIntegration,
                            settings: {
                              ...selectedIntegration.settings,
                              chartOfAccounts: {
                                ...selectedIntegration.settings.chartOfAccounts,
                                [key]: e.target.value
                              }
                            }
                          };
                          setSelectedIntegration(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={async () => {
                    try {
                      // Persist integration settings to backend
                      await api.put(`/financial/integrations/${selectedIntegration.id}/settings`, {
                        syncInterval: selectedIntegration.syncInterval,
                        companyCode: selectedIntegration.settings.companyCode,
                        autoSync: selectedIntegration.autoSync,
                        chartOfAccounts: selectedIntegration.settings.chartOfAccounts,
                        taxSettings: selectedIntegration.settings.taxSettings
                      });
                      setIntegrations(prev => prev.map(i =>
                        i.id === selectedIntegration.id ? selectedIntegration : i
                      ));
                      setSettingsDialogOpen(false);
                      toast.success('Integration settings saved');
                    } catch {
                      // Fallback: save to local state even if backend fails
                      setIntegrations(prev => prev.map(i =>
                        i.id === selectedIntegration.id ? selectedIntegration : i
                      ));
                      setSettingsDialogOpen(false);
                      toast.success('Integration settings updated locally');
                    }
                  }}
                >
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withErrorBoundary(AccountingIntegrationDashboard, { level: 'component' });