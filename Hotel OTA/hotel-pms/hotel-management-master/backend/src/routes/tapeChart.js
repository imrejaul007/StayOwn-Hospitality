import express from 'express';
import tapeChartController from '../controllers/tapeChartController.js';
import roomLockController from '../controllers/roomLockController.js';
import searchController from '../controllers/searchController.js';
import bulkOperationsController from '../controllers/bulkOperationsController.js';
import { authenticate } from '../middleware/auth.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// All routes require authentication and property access
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);

// Room Configuration Routes
router.post('/room-config', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.createRoomConfiguration);
router.get('/room-config', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getRoomConfigurations);
router.put('/room-config/:id', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), tapeChartController.updateRoomConfiguration);
router.delete('/room-config/:id', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), tapeChartController.deleteRoomConfiguration);

// Room Status Management Routes
router.put('/rooms/:roomId/status', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.updateRoomStatus);
router.get('/rooms/:roomId/status-history', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getRoomStatusHistory);
router.get('/rooms/available', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getAvailableRooms);

// Room Block Management Routes
router.post('/room-blocks', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.createRoomBlock);
router.get('/room-blocks', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getRoomBlocks);
router.get('/room-blocks/:id', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getRoomBlock);
router.put('/room-blocks/:id', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.updateRoomBlock);
router.post('/room-blocks/:id/release', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.releaseRoomBlock);

// Advanced Reservation Management Routes
router.post('/reservations', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.createAdvancedReservation);
router.get('/reservations', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getAdvancedReservations);
router.get('/reservations/:id', authenticate, authorizePolicy('tapeChart', 'staffAccess'), tapeChartController.getAdvancedReservation);
router.post('/reservations/:reservationId/assign-room', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.assignRoom);
router.post('/reservations/:reservationId/auto-assign', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.autoAssignRooms);
router.post('/reservations/:reservationId/upgrade', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.processUpgrade);

// Tape Chart View Management Routes
router.post('/views', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.createTapeChartView);
router.get('/views', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getTapeChartViews);
router.put('/views/:id', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.updateTapeChartView);
router.delete('/views/:id', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.deleteTapeChartView);

// Generate Tape Chart Data
router.get('/chart-data', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.generateTapeChartData);

// Room Assignment Rules Routes
router.post('/assignment-rules', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), tapeChartController.createAssignmentRule);
router.get('/assignment-rules', authenticate, authorizePolicy('tapeChart', 'staffAccess'), tapeChartController.getAssignmentRules);
router.put('/assignment-rules/:id', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), tapeChartController.updateAssignmentRule);
router.delete('/assignment-rules/:id', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), tapeChartController.deleteAssignmentRule);

// Waitlist Management Routes
router.post('/reservations/:reservationId/waitlist', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.addToWaitlist);
router.post('/waitlist/process', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.processWaitlist);
router.get('/waitlist', authenticate, authorizePolicy('tapeChart', 'staffAccess'), tapeChartController.getWaitlist);

// Analytics and Reporting Routes
router.get('/reports/occupancy', authenticate, authorizePolicy('tapeChart', 'staffAccess'), tapeChartController.getOccupancyReport);
router.get('/reports/room-utilization', authenticate, authorizePolicy('tapeChart', 'adminAccess'), tapeChartController.getRoomUtilizationStats);
router.get('/reports/revenue-by-room-type', authenticate, authorizePolicy('tapeChart', 'adminAccess'), tapeChartController.getRevenueByRoomType);

// Dashboard Routes
router.get('/dashboard', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getTapeChartDashboard);

// Real-time Updates Routes
router.get('/room-status-updates', authenticate, authorizePolicy('tapeChart', 'staffFrontdeskAccess'), tapeChartController.getRoomStatusUpdates);

// Bulk Operations Routes
router.post('/bulk/room-status', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.bulkUpdateRoomStatus);
router.post('/bulk/room-assignment', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), tapeChartController.bulkRoomAssignment);

// Room Lock Management Routes
router.post('/rooms/:roomId/lock', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), roomLockController.lockRoom);
router.delete('/rooms/:roomId/unlock', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), roomLockController.unlockRoom);
router.get('/rooms/:roomId/lock-status', authenticate, authorizePolicy('tapeChart', 'staffAccess'), roomLockController.getRoomLockStatus);
router.put('/rooms/:roomId/lock/extend', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), roomLockController.extendLock);
router.get('/rooms/locks', authenticate, authorizePolicy('tapeChart', 'staffAccess'), roomLockController.getActiveLocks);
router.delete('/rooms/locks/cleanup', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), roomLockController.cleanupExpiredLocks);
router.post('/rooms/locks/bulk-unlock', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), roomLockController.bulkUnlockRooms);

// Advanced Search and Filtering Routes
router.post('/search', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), searchController.advancedSearch);
router.post('/filter', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), searchController.advancedFilter);
router.get('/search/suggestions', authenticate, authorizePolicy('tapeChart', 'staffAccess'), searchController.getSearchSuggestions);
router.get('/search/filters', authenticate, authorizePolicy('tapeChart', 'staffAccess'), searchController.getFilterOptions);

// Bulk Operations Routes
router.post('/bulk/room-status', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), bulkOperationsController.bulkUpdateRoomStatus);
router.post('/bulk/room-assignment', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), bulkOperationsController.bulkRoomAssignment);
router.post('/bulk/room-block', authenticate, authorizePolicy('tapeChart', 'adminAccess'), validate(mutationBaselineSchema), bulkOperationsController.bulkRoomBlock);
router.post('/bulk/room-release', authenticate, authorizePolicy('tapeChart', 'staffAccess'), validate(mutationBaselineSchema), bulkOperationsController.bulkRoomRelease);
router.get('/bulk/progress/:batchId', authenticate, authorizePolicy('tapeChart', 'staffAccess'), bulkOperationsController.getBulkOperationProgress);
router.get('/bulk/active', authenticate, authorizePolicy('tapeChart', 'staffAccess'), bulkOperationsController.getActiveBulkOperations);

export default router;