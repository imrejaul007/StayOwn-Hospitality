// @ts-check

import paymentRoutes from './paymentRoutes.js';
import invoiceRoutes from './invoiceRoutes.js';
import service from './service.js';
import repository from './repository.js';

/** @typedef {import('../../types/contracts').BillingModuleContract} BillingModuleContract */

/** @type {BillingModuleContract} */
const billingModule = {
  name: 'billing',
  paymentRoutes,
  invoiceRoutes,
  service,
  repository
};

export { paymentRoutes, invoiceRoutes, service, repository };
export default billingModule;
