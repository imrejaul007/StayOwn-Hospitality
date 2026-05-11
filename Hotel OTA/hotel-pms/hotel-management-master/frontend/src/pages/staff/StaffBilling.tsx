import React from 'react';
import BillingHistory from '../admin/BillingHistory';
import { withErrorBoundary } from '../../components/ErrorBoundary';

/**
 * StaffBilling — Staff portal billing & payments page.
 *
 * Staff can view the billing history for their assigned property (invoices,
 * payments, refunds, bookings). Read-only refund actions are restricted to
 * admin/manager roles at the backend RBAC layer, so no extra UI guard is
 * needed here.
 *
 * The underlying BillingHistory component queries /billing-history which is
 * tenant-scoped by the backend ensureTenantContext middleware — staff only
 * ever see their own hotel's data.
 */
const StaffBilling: React.FC = () => {
  return <BillingHistory />;
};

export default withErrorBoundary(StaffBilling);
