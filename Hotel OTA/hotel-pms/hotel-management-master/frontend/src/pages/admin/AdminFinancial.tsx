import React from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import ChartOfAccounts from '../../components/financial/ChartOfAccounts';
import GeneralLedger from '../../components/financial/GeneralLedger';
import InvoiceManagement from '../../components/financial/InvoiceManagement';
import PaymentManagement from '../../components/financial/PaymentManagement';
import BankAccountManagement from '../../components/financial/BankAccountManagement';
import BudgetManagement from '../../components/financial/BudgetManagement';
import FinancialReports from '../../components/financial/FinancialReports';
import AccountingIntegrationDashboard from '../../components/financial/AccountingIntegrationDashboard';

const AdminFinancial: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const { user } = useAuth();
  const readOnly = !['admin', 'manager'].includes(user?.role || '');

  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to view financial management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Property Breadcrumb */}
      <div className="p-6 pb-0">
        <PropertyBreadcrumb items={['Financial']} />
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="accounts">Chart of Accounts</TabsTrigger>
          <TabsTrigger value="ledger">General Ledger</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="banks">Bank Accounts</TabsTrigger>
          <TabsTrigger value="budgets">Budgets</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AccountingIntegrationDashboard readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="accounts">
          <ChartOfAccounts readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="ledger">
          <GeneralLedger readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoiceManagement readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentManagement readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="banks">
          <BankAccountManagement readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="budgets">
          <BudgetManagement readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="reports">
          <FinancialReports readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(AdminFinancial);