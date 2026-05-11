// @ts-check

import routes from './routes.js';
import service from './service.js';
import repository from './repository.js';

/** @typedef {import('../../types/contracts').BookingModuleContract} BookingModuleContract */

/** @type {BookingModuleContract} */
const bookingModule = {
  name: 'booking',
  routes,
  service,
  repository
};

export { routes, service, repository };
export default bookingModule;
