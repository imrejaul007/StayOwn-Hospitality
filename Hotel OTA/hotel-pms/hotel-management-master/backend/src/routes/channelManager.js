import express from 'express';
import channelController from '../controllers/channelManagerController.js';
import { authenticate } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true);

// Apply authentication and property access to all channel manager routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Channel Management Routes
router.post('/channels', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.createChannel);
router.get('/channels', authorizePolicy('channelManager', 'readAccess'), channelController.getChannels);
router.get('/channels/:id', authorizePolicy('channelManager', 'readAccess'), channelController.getChannel);
router.put('/channels/:id', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.updateChannel);
router.delete('/channels/:id', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.deleteChannel);
router.post('/channels/:channelId/test-connection', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.testChannelConnection);

// Synchronization Routes
router.post('/sync/channel/:channelId', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.syncToChannel);
router.post('/sync/all-channels', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.syncToAllChannels);
router.get('/sync/history', authorizePolicy('channelManager', 'readAccess'), channelController.getSyncHistory);

// Reservation Management Routes
router.post('/reservations/pull/:channelId', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.pullReservations);
router.get('/reservations/mappings', authorizePolicy('channelManager', 'readAccess'), channelController.getReservationMappings);

// Rate Parity Routes
router.post('/rate-parity/monitor', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.monitorRateParity);
router.get('/rate-parity/logs', authorizePolicy('channelManager', 'readAccess'), channelController.getRateParityLogs);

// Performance Routes
router.get('/performance/:channelId', authorizePolicy('channelManager', 'readAccess'), channelController.getChannelPerformance);
router.get('/performance', authorizePolicy('channelManager', 'readAccess'), channelController.getAllChannelsPerformance);

// Overbooking Protection Routes
router.post('/overbooking/check', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.checkOverbooking);
router.post('/overbooking/rules', authorizePolicy('channelManager', 'manageAccess'), validate(mutationBaselineSchema), channelController.createOverbookingRule);
router.get('/overbooking/rules', authorizePolicy('channelManager', 'readAccess'), channelController.getOverbookingRules);

// Dashboard and Analytics Routes
router.get('/dashboard/stats', authorizePolicy('channelManager', 'readAccess'), channelController.getDashboardStats);
router.get('/analytics', authorizePolicy('channelManager', 'readAccess'), channelController.getChannelAnalytics);

export default router;
