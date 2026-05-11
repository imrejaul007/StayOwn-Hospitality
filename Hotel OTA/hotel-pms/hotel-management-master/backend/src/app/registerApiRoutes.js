export function registerApiRoutes(app, deps) {
  const {
    roomCacheMiddleware,
    settingsCacheMiddleware,
    roomTypeCacheMiddleware,
    authRoutes,
    roomRoutes,
    enhancedBookingRoutes,
    noShowRoutes,
    bookingRoutes,
    extraPersonPricingRoutes,
    settlementsRoutes,
    posSettlementIntegrationRoutes,
    approvalRoutes,
    paymentRoutes,
    housekeepingRoutes,
    inventoryRoutes,
    inventoryAnalyticsRoutes,
    guestRoutes,
    reportRoutes,
    otaRoutes,
    webhookRoutes,
    adminTravelDashboardRoutes,
    adminHotelServicesRoutes,
    adminBypassManagementRoutes,
    bypassFinancialAnalyticsRoutes,
    adminDashboardRoutes,
    adminRoutes,
    systemIntegrationRoutes,
    staffDashboardRoutes,
    staffAlertsRoutes,
    staffMeetUpRoutes,
    dailyInventoryCheckRoutes,
    inventoryNotificationRoutes,
    guestServiceRoutes,
    serviceTypesRoutes,
    reviewRoutes,
    maintenanceRoutes,
    incidentRoutes,
    invoiceRoutes,
    supplyRequestRoutes,
    communicationRoutes,
    messageTemplateRoutes,
    bookingConversationRoutes,
    contactRoutes,
    billingHistoryRoutes,
    loyaltyRoutes,
    adminLoyaltyRoutes,
    offerFavoriteRoutes,
    hotelServicesRoutes,
    staffServicesRoutes,
    notificationRoutes,
    settlementNotificationRoutes,
    userPreferencesRoutes,
    hotelSettingsRoutes,
    checkoutInventoryRoutes,
    integrationsRoutes,
    uploadRoutes,
    digitalKeyRoutes,
    meetUpRequestRoutes,
    meetUpResourceRoutes,
    travelAgentRoutes,
    dashboardUpdatesRoutes,
    roomInventoryRoutes,
    photoUploadRoutes,
    documentUploadRoutes,
    staffTaskRoutes,
    settingsRoutes,
    scheduledUpdatesRoutes,
    dailyRoutineCheckRoutes,
    testCheckoutsRoutes,
    attractionsRoutes,
    corporateRoutes,
    analyticsRoutes,
    posRoutes,
    revenueManagementRoutes,
    channelManagerRoutes,
    bookingEngineRoutes,
    financialRoutes,
    tapeChartRoutes,
    auditTrailRoutes,
    dashboardRoutes,
    roomBlockRoutes,
    assignmentRulesRoutes,
    waitingListRoutes,
    waitlistRoutes,
    billingSessionRoutes,
    posReportsRoutes,
    guestLookupRoutes,
    availabilityRoutes,
    rateManagementRoutes,
    seasonalPricingRoutes,
    addOnServicesRoutes,
    dayUseRoutes,
    roomTypesRoutes,
    channelManagementRoutes,
    otaWebhookRoutes,
    rezOtaWebhookRoutes,
    hotelOtaWebhookRoutes,
    externalBookingsRoutes,
    inventoryManagementRoutes,
    mappingRoutes,
    currencyRoutes,
    languageRoutes,
    translationRoutes,
    channelLocalizationRoutes,
    otaAmendmentRoutes,
    auditRoutes,
    auditLogRoutes,
    laundryRoutes,
    aiRoutes,
    roomTaxRoutes,
    revenueAccountRoutes,
    roomChargeRoutes,
    phoneExtensionRoutes,
    billMessageRoutes,
    hotelAreaRoutes,
    webSettingsRoutes,
    webOptimizationRoutes,
    salutationRoutes,
    guestImportRoutes,
    blacklistRoutes,
    vipRoutes,
    customFieldRoutes,
    userManagementRoutes,
    usersRoutes,
    loginActivityRoutes,
    userAnalyticsRoutes,
    bookingFormRoutes,
    allotmentRoutes,
    centralizedRatesRoutes,
    propertyGroupsRoutes,
    portfolioRoutes,
    propertyRoomsRoutes,
    departmentRoutes,
    reasonRoutes,
    paymentMethodRoutes,
    guestManagementRoutes,
    operationalManagementRoutes,
    apiManagementRoutes,
    gdprRoutes,
    credentialRoutes,
    rolePermissionRoutes,
    dataPrivacyRoutes,
    securityMonitoringRoutes,
    checkoutAutomationRoutes,
    laundryTemplatesRoutes,
    inventoryAutomationRoutes,
    housekeepingAutomationRoutes,
    workflowRoutes,
    departmentBudgetRoutes,
    vendorRoutes,
    purchaseOrderRoutes,
    enhancedAnalyticsRoutes,
    requestTemplatesRoutes,
    requestCategoriesRoutes,
    vendorComparisonRoutes,
    reorderRoutes,
    stockMovementsRoutes,
    inventoryConsumptionRoutes,
    emailCampaignRoutes,
    crmRoutes,
    segmentationRoutes,
    personalizationRoutes,
    featureFlagRoutes,
    nightAuditRoutes,
    cancellationRoutes,
    dashboardConfigRoutes,
    discountPricingRoutes
  } = deps;

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/rooms', roomCacheMiddleware, roomRoutes);
  app.use('/api/v1/bookings/enhanced', enhancedBookingRoutes);
  app.use('/api/v1/bookings/no-show', noShowRoutes);
  app.use('/api/v1/bookings', bookingRoutes);
  app.use('/api/v1/extra-person-pricing', extraPersonPricingRoutes);
  app.use('/api/v1/settlements', settlementsRoutes);
  app.use('/api/v1/pos-settlements', posSettlementIntegrationRoutes);
  app.use('/api/v1/approvals', approvalRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/housekeeping', housekeepingRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/inventory/analytics', inventoryAnalyticsRoutes);
  app.use('/api/v1/guests', guestRoutes);
  app.use('/api/v1/reports', reportRoutes);
  app.use('/api/v1/ota', otaRoutes);
  app.use('/api/v1/webhooks', webhookRoutes);
  app.use('/api/v1/admin/travel-dashboard', adminTravelDashboardRoutes);
  app.use('/api/v1/admin/hotel-services', adminHotelServicesRoutes);
  app.use('/api/v1/admin/service-types', serviceTypesRoutes);
  app.use('/api/v1/admin/loyalty', adminLoyaltyRoutes);
  app.use('/api/v1/admin-bypass-management', adminBypassManagementRoutes);
  app.use('/api/v1/admin-bypass-management/analytics', bypassFinancialAnalyticsRoutes);
  app.use('/api/v1/admin-dashboard', adminDashboardRoutes);
  // IMPORTANT: generic /admin mount MUST come after all specific /admin/* sub-routes
  // because admin.js has router.use(authorize('admin')) that blocks non-admin roles
  app.use('/api/v1/admin', adminRoutes);
  app.use('/api/v1/system-integration', systemIntegrationRoutes);
  app.use('/api/v1/staff-dashboard', staffDashboardRoutes);
  app.use('/api/v1/staff/alerts', staffAlertsRoutes);
  app.use('/api/v1/staff-meetups', staffMeetUpRoutes);
  app.use('/api/v1/daily-inventory-checks', dailyInventoryCheckRoutes);
  app.use('/api/v1/inventory-notifications', inventoryNotificationRoutes);
  app.use('/api/v1/guest-services', guestServiceRoutes);
  app.use('/api/v1/reviews', reviewRoutes);
  app.use('/api/v1/maintenance', maintenanceRoutes);
  app.use('/api/v1/incidents', incidentRoutes);
  app.use('/api/v1/invoices', invoiceRoutes);
  app.use('/api/v1/supply-requests', supplyRequestRoutes);
  app.use('/api/v1/communications', communicationRoutes);
  app.use('/api/v1/message-templates', messageTemplateRoutes);
  app.use('/api/v1/booking-conversations', bookingConversationRoutes);
  app.use('/api/v1/contact', contactRoutes);
  app.use('/api/v1/billing-history', billingHistoryRoutes);
  app.use('/api/v1/loyalty', loyaltyRoutes);
  app.use('/api/v1/loyalty/favorites', offerFavoriteRoutes);
  app.use('/api/v1/hotel-services', hotelServicesRoutes);
  app.use('/api/v1/staff/services', staffServicesRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/settlement-notifications', settlementNotificationRoutes);
  app.use('/api/v1/user-preferences', userPreferencesRoutes);
  app.use('/api/v1/hotel-settings', settingsCacheMiddleware, hotelSettingsRoutes);
  app.use('/api/v1/checkout-inventory', checkoutInventoryRoutes);
  app.use('/api/v1/integrations', integrationsRoutes);
  app.use('/api/v1/upload', uploadRoutes);
  app.use('/api/v1/digital-keys', digitalKeyRoutes);
  app.use('/api/v1/meet-up-requests', meetUpRequestRoutes);
  app.use('/api/v1/meetup-resources', meetUpResourceRoutes);
  app.use('/api/v1/travel-agents', travelAgentRoutes);
  app.use('/api/v1/dashboard-updates', dashboardUpdatesRoutes);
  app.use('/api/v1/room-inventory', roomInventoryRoutes);
  app.use('/api/v1/photos', photoUploadRoutes);
  app.use('/api/v1/documents', documentUploadRoutes);
  app.use('/api/v1/staff-tasks', staffTaskRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/scheduled-updates', scheduledUpdatesRoutes);
  app.use('/api/v1/daily-routine-check', dailyRoutineCheckRoutes);
  app.use('/api/v1/test', testCheckoutsRoutes);
  app.use('/api/v1/attractions', attractionsRoutes);
  app.use('/api/v1/corporate', corporateRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/pos', posRoutes);
  app.use('/api/v1/revenue-management', revenueManagementRoutes);
  app.use('/api/v1/channel-manager', channelManagerRoutes);
  app.use('/api/v1/booking-engine', bookingEngineRoutes);
  app.use('/api/v1/financial', financialRoutes);
  app.use('/api/v1/tape-chart', tapeChartRoutes);
  app.use('/api/v1/audit-trail', auditTrailRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/room-blocks', roomBlockRoutes);
  app.use('/api/v1/assignment-rules', assignmentRulesRoutes);
  app.use('/api/v1/waiting-list', waitingListRoutes);
  app.use('/api/v1/waitlist', waitlistRoutes);
  app.use('/api/v1/billing-sessions', billingSessionRoutes);
  app.use('/api/v1/pos/reports', posReportsRoutes);
  app.use('/api/v1/guest-lookup', guestLookupRoutes);
  app.use('/api/v1/availability', availabilityRoutes);
  app.use('/api/v1/rates', rateManagementRoutes);
  app.use('/api/v1/seasonal-pricing', seasonalPricingRoutes);
  app.use('/api/v1/add-on-services', addOnServicesRoutes);
  app.use('/api/v1/day-use', dayUseRoutes);
  app.use('/api/v1/room-types', roomTypeCacheMiddleware, roomTypesRoutes);
  app.use('/api/v1/channels', channelManagementRoutes);
  // More-specific REZ OTA sub-route MUST be registered before the generic OTA webhook
  // prefix, otherwise Express matches '/api/v1/ota-webhooks' first and the rez-ota
  // router is never reached (Express prefix matching swallows the longer path).
  app.use('/api/v1/ota-webhooks/rez-ota', rezOtaWebhookRoutes);
  app.use('/api/v1/ota-webhooks/hotel-ota', hotelOtaWebhookRoutes);
  app.use('/api/v1/ota-webhooks', otaWebhookRoutes);
  app.use('/api/v1/external', externalBookingsRoutes);
  app.use('/api/v1/inventory-management', inventoryManagementRoutes);
  app.use('/api/v1/mappings', mappingRoutes);
  app.use('/api/v1/currencies', currencyRoutes);
  app.use('/api/v1/languages', languageRoutes);
  app.use('/api/v1/translations', translationRoutes);
  app.use('/api/v1/channel-localization', channelLocalizationRoutes);
  app.use('/api/v1/ota-amendments', otaAmendmentRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/audit-log', auditLogRoutes);
  app.use('/api/v1/laundry', laundryRoutes);
  app.use('/api/v1/ai', aiRoutes);
  app.use('/api/v1/room-taxes', roomTaxRoutes);
  app.use('/api/v1/revenue-accounts', revenueAccountRoutes);
  app.use('/api/v1/room-charges', roomChargeRoutes);
  app.use('/api/v1/phone-extensions', phoneExtensionRoutes);
  app.use('/api/v1/bill-messages', billMessageRoutes);
  app.use('/api/v1/hotel-areas', hotelAreaRoutes);
  app.use('/api/v1/web-settings', webSettingsRoutes);
  app.use('/api/v1/web-optimization', webOptimizationRoutes);
  app.use('/api/v1/salutations', salutationRoutes);
  app.use('/api/v1/guest-import', guestImportRoutes);
  app.use('/api/v1/blacklist', blacklistRoutes);
  app.use('/api/v1/vip', vipRoutes);
  app.use('/api/v1/custom-fields', customFieldRoutes);
  app.use('/api/v1/user-management', userManagementRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/login-activity', loginActivityRoutes);
  app.use('/api/v1/user-analytics', userAnalyticsRoutes);
  app.use('/api/v1/booking-forms', bookingFormRoutes);
  app.use('/api/v1/allotments', allotmentRoutes);
  app.use('/api/v1/centralized-rates', centralizedRatesRoutes);
  app.use('/api/v1/property-groups', propertyGroupsRoutes);
  app.use('/api/v1/portfolio', portfolioRoutes);
  app.use('/api/v1/property-rooms', propertyRoomsRoutes);
  app.use('/api/v1/departments', departmentRoutes);
  app.use('/api/v1/reasons', reasonRoutes);
  app.use('/api/v1/payment-methods', paymentMethodRoutes);
  app.use('/api/v1/guest-management', guestManagementRoutes);
  app.use('/api/v1/operational-management', operationalManagementRoutes);
  app.use('/api/v1/api-management', apiManagementRoutes);
  app.use('/api/v1/gdpr', gdprRoutes);
  app.use('/api/v1/credentials', credentialRoutes);
  app.use('/api/v1/roles', rolePermissionRoutes);
  app.use('/api/v1/data-privacy', dataPrivacyRoutes);
  app.use('/api/v1/security-monitoring', securityMonitoringRoutes);
  app.use('/api/v1/checkout-automation', checkoutAutomationRoutes);
  app.use('/api/v1/laundry-templates', laundryTemplatesRoutes);
  app.use('/api/v1/inventory-automation', inventoryAutomationRoutes);
  app.use('/api/v1/housekeeping-automation', housekeepingAutomationRoutes);
  app.use('/api/v1/workflow', workflowRoutes);
  app.use('/api/v1/department-budget', departmentBudgetRoutes);
  app.use('/api/v1/vendors', vendorRoutes);
  app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
  app.use('/api/v1/enhanced-analytics', enhancedAnalyticsRoutes);
  app.use('/api/v1/request-templates', requestTemplatesRoutes);
  app.use('/api/v1/request-categories', requestCategoriesRoutes);
  app.use('/api/v1/vendor-comparison', vendorComparisonRoutes);
  app.use('/api/v1/reorder', reorderRoutes);
  app.use('/api/v1/stock-movements', stockMovementsRoutes);
  app.use('/api/v1/inventory/consumption', inventoryConsumptionRoutes);
  app.use('/api/v1/email-campaigns', emailCampaignRoutes);
  app.use('/api/v1/crm', crmRoutes);
  app.use('/api/v1/segmentation', segmentationRoutes);
  app.use('/api/v1/personalization', personalizationRoutes);
  app.use('/api/v1/feature-flags', featureFlagRoutes);
  app.use('/api/v1/night-audit', nightAuditRoutes);
  if (dashboardConfigRoutes) {
    app.use('/api/v1/dashboard-configs', dashboardConfigRoutes);
  }

  if (cancellationRoutes) {
    app.use('/api/v1/cancellations', cancellationRoutes);
  }

  if (discountPricingRoutes) {
    app.use('/api/v1/discount-pricing', discountPricingRoutes);
  }
}
