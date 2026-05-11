import { ApplicationError } from './errorHandler.js';

const AUTHENTICATED_ROLES = ['guest', 'staff', 'admin', 'manager', 'frontdesk', 'housekeeping', 'travel_agent'];
const OPERATIONAL_ROLES = ['staff', 'admin', 'manager', 'frontdesk', 'housekeeping'];
const GUEST_SAFE_ROLES = ['guest', 'staff', 'admin', 'manager', 'frontdesk', 'housekeeping', 'travel_agent'];

export const RBAC_POLICIES = {
  admin: {
    createUser: ['admin'],
    updateUser: ['admin'],
    deleteUser: ['admin'],
    createHotel: ['admin'],
    updateHotelStatus: ['admin'],
    updateHotelDetails: ['admin'],
    deleteHotel: ['admin']
  },
  adminBypassManagement: {
    baseAccess: ['admin', 'manager', 'frontdesk']
  },
  allotment: {
    adminAccess: ['admin']
  },
  notifications: {
    baseAccess: AUTHENTICATED_ROLES
  },
  settings: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'manager']
  },
  hotelSettings: {
    readAccess: ['admin', 'manager', 'frontdesk'],
    modifyAccess: ['admin', 'manager']
  },
  dataPrivacy: {
    baseAccess: AUTHENTICATED_ROLES
  },
  dayUse: {
    baseAccess: AUTHENTICATED_ROLES
  },
  mapping: {
    baseAccess: OPERATIONAL_ROLES
  },
  rolePermissions: {
    baseAccess: OPERATIONAL_ROLES
  },
  meetUpRequests: {
    baseAccess: AUTHENTICATED_ROLES
  },
  hotelAreas: {
    baseAccess: OPERATIONAL_ROLES
  },
  seasonalPricing: {
    baseAccess: OPERATIONAL_ROLES
  },
  systemIntegration: {
    modifyAccess: ['admin', 'manager']
  },
  waitlist: {
    baseAccess: AUTHENTICATED_ROLES
  },
  bookingForm: {
    adminAccess: ['admin']
  },
  channelManagement: {
    baseAccess: OPERATIONAL_ROLES
  },
  gdpr: {
    baseAccess: AUTHENTICATED_ROLES
  },
  operationalManagement: {
    modifyAccess: ['admin', 'manager', 'staff', 'frontdesk'],
    readAccess: ['admin', 'manager', 'staff', 'frontdesk']
  },
  reorder: {
    baseAccess: OPERATIONAL_ROLES
  },
  serviceTypes: {
    baseAccess: AUTHENTICATED_ROLES
  },
  webSettings: {
    adminAccess: ['admin']
  },
  digitalKeys: {
    baseAccess: AUTHENTICATED_ROLES,
    /** Property-level key ops: list/analytics/export + generate/revoke on behalf of guests */
    adminAccess: ['admin', 'manager', 'frontdesk', 'staff']
  },
  roomQrs: {
    baseAccess: AUTHENTICATED_ROLES,
    /** Generate QR codes for rooms */
    create: ['admin', 'manager', 'frontdesk'],
    read: ['admin', 'manager', 'frontdesk', 'staff']
  },
  discountPricing: {
    modifyAccess: ['admin', 'manager', 'staff']
  },
  pos: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'manager']
  },
  adminHotelServices: {
    baseAccess: ['admin', 'manager', 'frontdesk']
  },
  bookingConversations: {
    baseAccess: AUTHENTICATED_ROLES,
    staffAccess: ['staff', 'admin', 'manager']
  },
  documentUpload: {
    baseAccess: AUTHENTICATED_ROLES,
    managerAccess: ['admin', 'manager'],
    staffAccess: ['admin', 'staff', 'frontdesk']
  },
  inventoryConsumption: {
    baseAccess: AUTHENTICATED_ROLES
  },
  enhancedBookings: {
    baseAccess: AUTHENTICATED_ROLES,
    priceAdjustAccess: ['admin', 'manager', 'staff', 'frontdesk'],
    priceReverseAccess: ['admin', 'manager']
  },
  personalization: {
    baseAccess: AUTHENTICATED_ROLES,
    managerAccess: ['admin', 'manager']
  },
  userPreferences: {
    baseAccess: AUTHENTICATED_ROLES,
    staffAccess: ['staff', 'housekeeping', 'frontdesk', 'manager', 'admin'],
    guestAccess: ['guest', 'travel_agent'],
    adminAccess: ['admin']
  },
  meetUpResources: {
    baseAccess: AUTHENTICATED_ROLES,
    adminAccess: ['admin']
  },
  scheduledUpdates: {
    baseAccess: ['admin', 'manager']
  },
  securityMonitoring: {
    baseAccess: ['admin', 'manager']
  },
  stockMovements: {
    baseAccess: OPERATIONAL_ROLES,
    staffAccess: ['admin', 'staff'],
    adminAccess: ['admin']
  },
  measurementUnits: {
    baseAccess: OPERATIONAL_ROLES,
    manageAccess: ['admin', 'manager']
  },
  bypassFinancialAnalytics: {
    managerAccess: ['admin', 'manager']
  },
  externalBookings: {
    baseAccess: AUTHENTICATED_ROLES
  },
  guestImport: {
    staffAccess: ['admin', 'manager', 'staff']
  },
  guestManagement: {
    managerAccess: ['admin', 'manager']
  },
  staffMeetUp: {
    staffAccess: ['staff', 'admin', 'manager', 'frontdesk']
  },
  centralizedRates: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'rate_manager']
  },
  guestServices: {
    baseAccess: AUTHENTICATED_ROLES,
    staffAccess: ['staff', 'admin', 'frontdesk', 'manager'],
    guestAccess: ['guest']
  },
  hotelServices: {
    baseAccess: AUTHENTICATED_ROLES
  },
  posTax: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'manager']
  },
  roomCharges: {
    baseAccess: OPERATIONAL_ROLES
  },
  staffDashboard: {
    // All operational roles need dashboard access; managers and frontdesk are
    // legitimate users of the staff dashboard view.
    staffAccess: ['staff', 'admin', 'manager', 'frontdesk', 'housekeeping']
  },
  staffServices: {
    staffAccess: ['staff']
  },
  testCheckouts: {
    adminAccess: ['admin']
  },
  upload: {
    baseAccess: AUTHENTICATED_ROLES
  },
  vendorComparison: {
    baseAccess: OPERATIONAL_ROLES
  },
  auth: {
    baseAccess: AUTHENTICATED_ROLES
  },
  adminTravelDashboard: {
    baseAccess: AUTHENTICATED_ROLES
  },
  analytics: {
    baseAccess: OPERATIONAL_ROLES
  },
  billMessages: {
    baseAccess: AUTHENTICATED_ROLES
  },
  bookingEngine: {
    baseAccess: AUTHENTICATED_ROLES,
    readAccess: AUTHENTICATED_ROLES
  },
  cancellations: {
    baseAccess: AUTHENTICATED_ROLES
  },
  channelLocalization: {
    baseAccess: AUTHENTICATED_ROLES
  },
  communications: {
    baseAccess: AUTHENTICATED_ROLES
  },
  dashboardUpdates: {
    baseAccess: AUTHENTICATED_ROLES
  },
  departmentBudget: {
    baseAccess: OPERATIONAL_ROLES
  },
  guests: {
    baseAccess: AUTHENTICATED_ROLES
  },
  integrations: {
    baseAccess: OPERATIONAL_ROLES
  },
  inventoryNotifications: {
    baseAccess: OPERATIONAL_ROLES
  },
  loyalty: {
    baseAccess: AUTHENTICATED_ROLES,
    adminAccess: ['admin', 'manager'],
    rulesManage: ['admin'],
    simulationAccess: ['admin', 'manager'],
    campaignManage: ['admin', 'manager'],
    operationsRun: ['admin', 'manager'],
    walletRepair: ['admin']
  },
  messageTemplates: {
    baseAccess: AUTHENTICATED_ROLES
  },
  otaAmendments: {
    baseAccess: AUTHENTICATED_ROLES
  },
  posAttributes: {
    baseAccess: AUTHENTICATED_ROLES
  },
  reasons: {
    baseAccess: OPERATIONAL_ROLES
  },
  requestTemplates: {
    baseAccess: AUTHENTICATED_ROLES
  },
  revenueAccounts: {
    baseAccess: OPERATIONAL_ROLES
  },
  reviews: {
    baseAccess: AUTHENTICATED_ROLES,
    staffAccess: ['staff', 'admin', 'manager', 'frontdesk'],
    adminAccess: ['admin', 'manager']
  },
  roomTax: {
    baseAccess: OPERATIONAL_ROLES
  },
  translations: {
    baseAccess: AUTHENTICATED_ROLES
  },
  users: {
    baseAccess: AUTHENTICATED_ROLES
  },
  tapeChart: {
    adminAccess: ['admin'],
    staffAccess: ['admin', 'staff', 'frontdesk'],
    staffFrontdeskAccess: ['admin', 'staff', 'frontdesk']
  },
  rateManagement: {
    manageAccess: ['admin', 'revenue_manager'],
    readAccess: ['admin', 'revenue_manager', 'manager']
  },
  revenueManagement: {
    manageAccess: ['admin', 'revenue_manager'],
    readAccess: ['admin', 'revenue_manager', 'manager']
  },
  channelManager: {
    manageAccess: ['admin', 'channel_manager', 'frontdesk'],
    readAccess: ['admin', 'channel_manager', 'manager', 'frontdesk']
  },
  departments: {
    manageAccess: ['admin', 'manager'],
    adminAccess: ['admin']
  },
  travelAgents: {
    manageAccess: ['admin', 'manager'],
    opsAccess: ['admin', 'manager', 'staff', 'frontdesk'],
    allAgentAccess: ['admin', 'manager', 'staff', 'frontdesk', 'travel_agent'],
    agentManageAccess: ['admin', 'manager', 'travel_agent'],
    frontdeskAgentAccess: ['admin', 'manager', 'frontdesk', 'travel_agent']
  },
  paymentMethods: {
    managerAccess: ['admin', 'manager'],
    adminAccess: ['admin'],
    supervisorAccess: ['admin', 'manager', 'supervisor']
  },
  billingSessions: {
    staffAccess: ['staff', 'admin', 'frontdesk']
  },
  credentials: {
    managerAccess: ['admin', 'manager'],
    staffAccess: ['admin', 'manager', 'staff'],
    adminAccess: ['admin']
  },
  waitingList: {
    staffAccess: ['admin', 'manager', 'staff'],
    managerAccess: ['admin', 'manager']
  },
  vendors: {
    managerAccess: ['admin', 'manager'],
    staffAccess: ['admin', 'manager', 'staff']
  },
  phoneExtensions: {
    staffAccess: ['admin', 'manager', 'frontdesk', 'maintenance'],
    manageAccess: ['admin', 'manager'],
    usageAccess: ['admin', 'manager', 'system', 'maintenance'],
    maintenanceAccess: ['admin', 'manager', 'maintenance'],
    adminAccess: ['admin']
  },
  settlements: {
    staffAccess: ['admin', 'staff', 'frontdesk'],
    adminAccess: ['admin']
  },
  financial: {
    chartBulkImport: ['admin', 'manager'],
    journalBulkCreate: ['admin', 'manager'],
    journalLifecycle: ['admin', 'manager'],
    bankTransactionCreate: ['admin', 'staff', 'manager'],
    bankReconcileImport: ['admin', 'manager'],
    budgetSubmitRevise: ['admin', 'manager'],
    budgetApprove: ['admin']
  },
  emailCampaigns: {
    managerAccess: ['admin', 'manager'],
    staffAccess: ['admin', 'manager', 'staff']
  },
  laundry: {
    staffFrontdeskAccess: ['admin', 'manager', 'staff', 'housekeeping', 'frontdesk'],
    housekeepingAccess: ['admin', 'manager', 'housekeeping'],
    managerAccess: ['admin', 'manager']
  },
  roomInventory: {
    staffAccess: ['admin', 'staff', 'frontdesk']
  },
  roomTypes: {
    readAccess: ['admin', 'manager', 'frontdesk', 'staff'],
    manageAccess: ['admin', 'manager'],
    channelManageAccess: ['admin', 'channel_manager'],
    adminAccess: ['admin']
  },
  advancedReservations: {
    staffAccess: ['admin', 'staff', 'frontdesk']
  },
  currency: {
    manageAccess: ['admin', 'revenue_manager'],
    adminAccess: ['admin'],
    batchAccess: ['admin', 'revenue_manager', 'frontdesk']
  },
  dailyRoutineCheck: {
    staffFrontdeskAccess: ['staff', 'admin', 'frontdesk', 'housekeeping'],
    staffOnlyAccess: ['staff', 'frontdesk', 'housekeeping'],
    managerFrontdeskAccess: ['admin', 'manager', 'frontdesk'],
    fullAccess: ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping']
  },
  propertyGroups: {
    managerAccess: ['admin', 'manager'],
    adminAccess: ['admin']
  },
  inventoryAnalytics: {
    managerAccess: ['admin', 'manager']
  },
  supplyRequests: {
    staffAccess: ['staff', 'admin', 'frontdesk'],
    managerAccess: ['admin', 'manager', 'frontdesk'],
    purchasingAccess: ['admin', 'manager', 'purchasing', 'frontdesk']
  },
  laundryTemplates: {
    staffAccess: ['admin', 'manager', 'staff', 'housekeeping', 'frontdesk'],
    managerAccess: ['admin', 'manager']
  },
  purchaseOrders: {
    staffAccess: ['admin', 'manager', 'staff'],
    managerAccess: ['admin', 'manager']
  },
  staffTasks: {
    // Staff, managers, frontdesk, and housekeeping can view/update tasks;
    // only admins can create, delete, or access hotel-wide task lists.
    staffAccess: ['staff', 'admin', 'manager', 'frontdesk', 'housekeeping'],
    adminAccess: ['admin', 'manager']
  },
  approvals: {
    frontdeskAccess: ['frontdesk', 'manager', 'admin'],
    managerAccess: ['manager', 'admin']
  },
  assignmentRules: {
    staffAccess: ['admin', 'staff'],
    adminAccess: ['admin']
  },
  adminDashboard: {
    adminFrontdeskAccess: ['admin', 'frontdesk']
  },
  enhancedAnalytics: {
    managerAccess: ['admin', 'manager']
  },
  featureFlags: {
    adminAccess: ['admin']
  },
  offerFavorites: {
    memberAccess: ['guest', 'member', 'vip']
  },
  reports: {
    staffAccess: ['admin', 'staff', 'frontdesk'],
    adminAccess: ['admin']
  },
  segmentation: {
    manageAccess: ['admin', 'manager']
  },
  dailyInventoryCheck: {
    staffAccess: ['staff', 'admin', 'manager', 'housekeeping', 'frontdesk'],
    guestAccess: ['staff', 'admin', 'guest']
  },
  housekeepingAutomation: {
    staffFrontdeskAccess: ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping'],
    managerFrontdeskAccess: ['admin', 'manager', 'frontdesk']
  },
  photoUpload: {
    staffAccess: ['staff', 'admin', 'frontdesk']
  },
  posSettlementIntegration: {
    adminStaffAccess: ['admin', 'staff', 'frontdesk'],
    adminAccess: ['admin']
  },
  roomBlocks: {
    adminStaffAccess: ['admin', 'staff', 'frontdesk']
  },
  rooms: {
    createUpdateAccess: ['admin', 'staff', 'frontdesk'],
    deleteAccess: ['admin'],
    pricingAccess: ['admin', 'manager'],
    priceHistoryAccess: ['admin', 'manager', 'staff'],
    bulkPricingAccess: ['admin', 'manager']
  },
  settlementNotifications: {
    adminStaffAccess: ['admin', 'staff', 'frontdesk'],
    adminAccess: ['admin']
  },
  adminLoyalty: {
    managerAccess: ['admin', 'manager']
  },
  checkoutAutomation: {
    managerAccess: ['admin', 'manager'],
    staffAccess: ['staff', 'admin', 'frontdesk']
  },
  checkoutInventory: {
    staffAccess: ['staff', 'admin', 'frontdesk']
  },
  crm: {
    staffAccess: ['admin', 'manager', 'staff'],
    manageAccess: ['admin', 'manager']
  },
  inventory: {
    readWriteAccess: ['admin', 'staff', 'frontdesk'],
    manageAccess: ['admin', 'frontdesk'],
    requestAccess: ['staff', 'frontdesk']
  },
  incidents: {
    staffAccess: ['staff', 'admin', 'frontdesk']
  },
  extraPersonPricing: {
    staffAccess: ['admin', 'staff'],
    adminAccess: ['admin']
  },
  inventoryManagement: {
    readAccess: ['admin', 'manager', 'frontdesk'],
    manageAccess: ['admin', 'manager']
  },
  staffAlerts: {
    staffAccess: ['staff', 'admin', 'manager', 'frontdesk'],
    manageAccess: ['admin', 'manager']
  },
  inventoryVendorIntegration: {
    manageAccess: ['admin', 'manager'],
    staffAccess: ['admin', 'manager', 'staff']
  },
  requestCategories: {
    manageAccess: ['admin', 'manager']
  },
  apiManagement: {
    manageAccess: ['admin', 'manager'],
    adminAccess: ['admin']
  },
  attractions: {
    adminAccess: ['admin']
  },
  auditTrail: {
    adminAccess: ['admin'],
    staffAccess: ['admin']
  },
  housekeeping: {
    staffAccess: ['admin', 'manager', 'staff', 'frontdesk', 'housekeeping'],
    inspectAccess: ['admin', 'manager', 'frontdesk']
  },
  maintenance: {
    staffAccess: ['staff', 'admin', 'frontdesk', 'manager', 'housekeeping', 'maintenance']
  },
  ota: {
    adminAccess: ['admin'],
    staffAccess: ['admin', 'staff']
  },
  audit: {
    adminAccess: ['admin'],
    staffAccess: ['admin', 'audit', 'compliance'],
    frontdeskAccess: ['admin', 'audit'],
    managementAccess: ['admin', 'audit', 'management'],
    complianceAccess: ['admin', 'compliance']
  },
  availability: {
    staffAccess: ['admin', 'manager', 'frontdesk'],
    manageAccess: ['admin', 'manager']
  },
  health: {
    staffAccess: ['admin', 'manager', 'staff'],
    adminAccess: ['admin']
  },
  inventoryAutomation: {
    staffAccess: ['admin', 'manager', 'staff', 'frontdesk'],
    managerAccess: ['admin', 'manager']
  },
  nightAudit: {
    adminAccess: ['admin'],
    readAccess: ['admin', 'manager', 'frontdesk']
  },
  noShow: {
    staffAccess: ['admin', 'staff', 'manager'],
    managerAccess: ['admin', 'manager']
  },
  language: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'content_manager'],
    adminAccess: ['admin'],
    translateAccess: ['admin', 'content_manager', 'translator'],
    reviewAccess: ['admin', 'content_manager', 'reviewer'],
    translationReadAccess: ['admin', 'content_manager', 'reviewer', 'translator'],
    revenueContentAccess: ['admin', 'revenue_manager', 'content_manager']
  },
  revenueOptimization: {
    baseAccess: AUTHENTICATED_ROLES,
    manageAccess: ['admin', 'revenue_manager'],
    revenueContentAccess: ['admin', 'revenue_manager', 'content_manager']
  },
  addOnServices: {
    bookService: AUTHENTICATED_ROLES,
    redeemInclusion: AUTHENTICATED_ROLES,
    createService: ['admin'],
    updateService: ['admin'],
    deleteService: ['admin'],
    bulkCreateServices: ['admin'],
    createInclusion: ['admin'],
    updateInclusion: ['admin']
  },
  bookings: {
    baseAccess: AUTHENTICATED_ROLES,
    getRoomBookings: ['admin', 'staff', 'frontdesk'],
    create: AUTHENTICATED_ROLES,
    update: AUTHENTICATED_ROLES,
    cancel: AUTHENTICATED_ROLES,
    changeRoom: ['admin', 'staff', 'frontdesk'],
    changeRoomByGuest: ['admin', 'staff', 'frontdesk'],
    createModificationRequest: AUTHENTICATED_ROLES,
    reviewModificationRequest: ['admin', 'staff', 'manager', 'frontdesk'],
    checkIn: ['admin', 'staff', 'frontdesk'],
    checkOut: ['admin', 'staff', 'frontdesk'],
    addExtraPerson: ['admin', 'staff', 'frontdesk'],
    removeExtraPerson: ['admin', 'staff', 'frontdesk'],
    updateExtraPersonCharge: ['admin', 'staff', 'frontdesk'],
    calculateExtraPersonCharges: ['admin', 'staff', 'frontdesk'],
    approveExtraPersonCharge: ['admin', 'staff', 'frontdesk'],
    payExtraPersonCharges: ['admin', 'staff', 'frontdesk'],
    getSettlement: ['admin', 'staff', 'frontdesk'],
    addSettlementAdjustment: ['admin', 'staff', 'frontdesk'],
    paySettlement: ['admin', 'staff', 'frontdesk'],
    markNoShow: ['admin', 'staff', 'frontdesk']
  },
  payments: {
    createIntent: AUTHENTICATED_ROLES,
    confirmIntent: AUTHENTICATED_ROLES,
    createExtraPersonIntent: ['staff', 'admin', 'manager', 'frontdesk'],
    createSettlementIntent: AUTHENTICATED_ROLES,
    // Refunds must be initiated by hotel staff/management — guests cannot
    // self-service a refund (they can request one via a service ticket).
    refund: ['admin', 'manager', 'staff', 'frontdesk'],
    roomCharge: AUTHENTICATED_ROLES,
    cashOnDelivery: AUTHENTICATED_ROLES
  },
  invoices: {
    create: ['staff', 'admin', 'frontdesk'],
    update: ['staff', 'admin', 'frontdesk'],
    addPayment: ['staff', 'admin', 'frontdesk'],
    addDiscount: ['staff', 'admin', 'frontdesk'],
    setupSplitBilling: ['staff', 'admin', 'frontdesk'],
    paySplit: ['staff', 'admin', 'frontdesk', 'guest'],
    getStats: ['staff', 'admin', 'frontdesk'],
    getOverdue: ['staff', 'admin', 'frontdesk'],
    createSupplementaryExtraPerson: ['staff', 'admin', 'frontdesk'],
    createSupplementarySettlement: ['staff', 'admin', 'frontdesk'],
    addExtraCharges: ['staff', 'admin', 'frontdesk']
  }
};

export const authorizePolicy = (resource, action) => {
  return (req, res, next) => {
    const allowedRoles = RBAC_POLICIES[resource]?.[action];
    if (!allowedRoles) {
      return next(new ApplicationError(`RBAC policy missing for ${resource}.${action}`, 500));
    }

    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return next(new ApplicationError('You do not have permission to perform this action', 403));
    }

    next();
  };
};

export default authorizePolicy;
