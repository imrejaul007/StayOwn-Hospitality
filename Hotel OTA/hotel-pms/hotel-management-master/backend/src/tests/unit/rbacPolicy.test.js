import { authorizePolicy } from '../../middleware/rbacPolicy.js';

const createReq = (role) => ({
  user: { role }
});

describe('authorizePolicy middleware', () => {
  it('allows access when role is permitted', () => {
    const middleware = authorizePolicy('invoices', 'create');
    const req = createReq('admin');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('denies access when role is not permitted', () => {
    const middleware = authorizePolicy('invoices', 'create');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('returns 500 when policy is missing', () => {
    const middleware = authorizePolicy('unknown', 'missing');
    const req = createReq('admin');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
  });

  it('enforces booking operational role restrictions', () => {
    const middleware = authorizePolicy('bookings', 'checkIn');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows only admin for add-on service management policy', () => {
    const middleware = authorizePolicy('addOnServices', 'createService');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows admin-only policy for admin mutations', () => {
    const middleware = authorizePolicy('admin', 'createUser');
    const req = createReq('frontdesk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows manager in admin bypass base access policy', () => {
    const middleware = authorizePolicy('adminBypassManagement', 'baseAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-only allotment base policy', () => {
    const middleware = authorizePolicy('allotment', 'adminAccess');
    const req = createReq('frontdesk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows authenticated guest in notifications base policy', () => {
    const middleware = authorizePolicy('notifications', 'baseAccess');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in settings base policy', () => {
    const middleware = authorizePolicy('settings', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows manager in hotel settings modify policy', () => {
    const middleware = authorizePolicy('hotelSettings', 'modifyAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated guest in data privacy base policy', () => {
    const middleware = authorizePolicy('dataPrivacy', 'baseAccess');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in day-use base policy', () => {
    const middleware = authorizePolicy('dayUse', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in mapping base policy', () => {
    const middleware = authorizePolicy('mapping', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in seasonal pricing base policy', () => {
    const middleware = authorizePolicy('seasonalPricing', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows manager in system integration modify policy', () => {
    const middleware = authorizePolicy('systemIntegration', 'modifyAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-only web settings policy', () => {
    const middleware = authorizePolicy('webSettings', 'adminAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows travel agent in user preferences guest policy', () => {
    const middleware = authorizePolicy('userPreferences', 'guestAccess');
    const req = createReq('travel_agent');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows property staff roles for digital keys admin policy', () => {
    const middleware = authorizePolicy('digitalKeys', 'adminAccess');
    ['admin', 'manager', 'frontdesk', 'staff'].forEach((role) => {
      const req = createReq(role);
      const next = jest.fn();
      middleware(req, {}, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  it('denies guest for digital keys admin policy', () => {
    const middleware = authorizePolicy('digitalKeys', 'adminAccess');
    const req = createReq('guest');
    const next = jest.fn();

    middleware(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows manager in POS management policy', () => {
    const middleware = authorizePolicy('pos', 'manageAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in inventory consumption base policy', () => {
    const middleware = authorizePolicy('inventoryConsumption', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated staff in scheduled updates base policy', () => {
    const middleware = authorizePolicy('scheduledUpdates', 'baseAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager/admin policy for measurement unit mutations', () => {
    const middleware = authorizePolicy('measurementUnits', 'manageAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff in guest import staff policy', () => {
    const middleware = authorizePolicy('guestImport', 'staffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-manager policy for guest management', () => {
    const middleware = authorizePolicy('guestManagement', 'managerAccess');
    const req = createReq('frontdesk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows rate manager in centralized rates manage policy', () => {
    const middleware = authorizePolicy('centralizedRates', 'manageAccess');
    const req = createReq('rate_manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows authenticated user in auth base policy', () => {
    const middleware = authorizePolicy('auth', 'baseAccess');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows guest role in daily inventory guest policy', () => {
    const middleware = authorizePolicy('dailyInventoryCheck', 'guestAccess');
    const req = createReq('guest');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager/frontdesk policy in housekeeping automation', () => {
    const middleware = authorizePolicy('housekeepingAutomation', 'managerFrontdeskAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff role in photo upload staff policy', () => {
    const middleware = authorizePolicy('photoUpload', 'staffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-only policy for POS settlement bulk integration', () => {
    const middleware = authorizePolicy('posSettlementIntegration', 'adminAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff in room blocks policy', () => {
    const middleware = authorizePolicy('roomBlocks', 'adminStaffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows manager in rooms pricing policy', () => {
    const middleware = authorizePolicy('rooms', 'pricingAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows admin in settlement notifications admin policy', () => {
    const middleware = authorizePolicy('settlementNotifications', 'adminAccess');
    const req = createReq('admin');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager access policy for admin loyalty', () => {
    const middleware = authorizePolicy('adminLoyalty', 'managerAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff in checkout inventory policy', () => {
    const middleware = authorizePolicy('checkoutInventory', 'staffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager access in CRM manage policy', () => {
    const middleware = authorizePolicy('crm', 'manageAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows frontdesk in inventory request policy', () => {
    const middleware = authorizePolicy('inventory', 'requestAccess');
    const req = createReq('frontdesk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows content manager in language manage policy', () => {
    const middleware = authorizePolicy('language', 'manageAccess');
    const req = createReq('content_manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-only in extra person pricing admin policy', () => {
    const middleware = authorizePolicy('extraPersonPricing', 'adminAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows front_desk in inventory management read policy', () => {
    const middleware = authorizePolicy('inventoryManagement', 'readAccess');
    const req = createReq('front_desk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager/admin policy for staff alerts delete', () => {
    const middleware = authorizePolicy('staffAlerts', 'manageAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows manager in inventory vendor integration manage policy', () => {
    const middleware = authorizePolicy('inventoryVendorIntegration', 'manageAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager-only request categories manage policy', () => {
    const middleware = authorizePolicy('requestCategories', 'manageAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows manager in API management read policy', () => {
    const middleware = authorizePolicy('apiManagement', 'manageAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces admin-only in attractions policy', () => {
    const middleware = authorizePolicy('attractions', 'adminAccess');
    const req = createReq('manager');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff in housekeeping staff policy', () => {
    const middleware = authorizePolicy('housekeeping', 'staffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces frontdesk-only denial in OTA admin policy', () => {
    const middleware = authorizePolicy('ota', 'adminAccess');
    const req = createReq('frontdesk');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows admin in audit trail admin policy', () => {
    const middleware = authorizePolicy('auditTrail', 'adminAccess');
    const req = createReq('admin');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows compliance role in audit compliance policy', () => {
    const middleware = authorizePolicy('audit', 'complianceAccess');
    const req = createReq('compliance');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager access in availability manage policy', () => {
    const middleware = authorizePolicy('availability', 'manageAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows staff in health staff policy', () => {
    const middleware = authorizePolicy('health', 'staffAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager-only in inventory automation statistics policy', () => {
    const middleware = authorizePolicy('inventoryAutomation', 'managerAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('allows admin in night audit admin policy', () => {
    const middleware = authorizePolicy('nightAudit', 'adminAccess');
    const req = createReq('admin');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('enforces manager-only in no-show reversal policy', () => {
    const middleware = authorizePolicy('noShow', 'managerAccess');
    const req = createReq('staff');
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });
});
