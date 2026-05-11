import React from 'react';
import BillingHistory from '../admin/BillingHistory';
import { withErrorBoundary } from '../../components/ErrorBoundary';

/**
 * FrontDeskBilling — Front-desk billing & payments page.
 *
 * Frontdesk staff have the same read access to billing history as admin/manager.
 * They are also authorised by the backend RBAC to initiate refunds
 * (payments.refund policy includes 'frontdesk').
 *
 * The underlying BillingHistory component queries /billing-history which is
 * tenant-scoped by the backend ensureTenantContext middleware — frontdesk staff
 * only ever see their own hotel's data.
 */
const FrontDeskBilling: React.FC = () => {
  return <BillingHistory />;
};

export default withErrorBoundary(FrontDeskBilling);
