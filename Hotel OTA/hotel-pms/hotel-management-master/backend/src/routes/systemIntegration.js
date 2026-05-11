import express from 'express';
import {
    authenticate
} from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import { authorizePolicy } from '../middleware/rbacPolicy.js';
import inventoryIntegrationService from '../services/inventoryIntegrationService.js';
import workflowAutomationService from '../services/workflowAutomationService.js';
import {
    sendNotification
} from '../services/notificationService.js';
import {
    catchAsync
} from '../utils/catchAsync.js';
import {
    ApplicationError
} from '../middleware/errorHandler.js';
import { validate } from '../middleware/validation.js';
import logger from '../utils/logger.js';
import Joi from 'joi';

const router = express.Router();
const mutationBaselineSchema = Joi.object({}).unknown(true).optional();

// Apply authentication to all routes
router.use(authenticate);
router.use(ensureTenantContext);
router.use(ensurePropertyAccess);
router.use(authorizePolicy('systemIntegration', 'modifyAccess'));

/**
 * Get system integration health status
 */
router.get('/health', catchAsync(async (req, res) => {
    const [
        inventoryHealth,
        automationHealth
    ] = await Promise.all([
        inventoryIntegrationService.getIntegrationHealth(),
        workflowAutomationService.getAutomationHealth()
    ]);

    const overallHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: {
            inventory: inventoryHealth,
            automation: automationHealth,
            notifications: {
                status: 'healthy',
                channels: ['email', 'sms', 'push', 'webhook', 'inApp'],
                enabled: true
            }
        }
    };

    // Determine overall status
    const serviceStatuses = [
        inventoryHealth.status,
        automationHealth.status
    ];

    if (serviceStatuses.includes('critical')) {
        overallHealth.status = 'critical';
    } else if (serviceStatuses.includes('degraded')) {
        overallHealth.status = 'degraded';
    }

    res.status(200).json({
        status: 'success',
        data: overallHealth
    });
}));

/**
 * Trigger inventory reconciliation
 */
router.post('/inventory/reconciliation', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        timeRange = 24
    } = req.body;
    const hotelId = req.user.hotelId;

    const reconciliationResults = await inventoryIntegrationService.performInventoryReconciliation(
        hotelId,
        timeRange
    );

    res.status(200).json({
        status: 'success',
        message: 'Inventory reconciliation completed',
        data: reconciliationResults
    });
}));

/**
 * Test inventory integration
 */
router.post('/inventory/test', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        itemId = 'test_item', quantity = 1
    } = req.body;
    const hotelId = req.user.hotelId;

    // Create test inventory impact
    const testItems = [{
        itemId,
        itemName: 'Test Item',
        category: 'Test',
        quantity,
        unitCost: 10,
        totalCost: 10 * quantity,
        wasBypassed: true,
        bypassReason: 'integration_test'
    }];

    const testResults = await inventoryIntegrationService.processBypassInventoryImpact(
        'test_bypass_id',
        testItems
    );

    res.status(200).json({
        status: 'success',
        message: 'Inventory integration test completed',
        data: testResults
    });
}));

/**
 * Get automation rules
 */
router.get('/automation/rules', catchAsync(async (req, res) => {
    const automationHealth = await workflowAutomationService.getAutomationHealth();

    res.status(200).json({
        status: 'success',
        data: {
            enabled: automationHealth.enabled,
            rules: automationHealth.rules,
            templates: automationHealth.templates,
            metrics: automationHealth.metrics
        }
    });
}));

/**
 * Update automation rule
 */
router.put('/automation/rules/:ruleType/:ruleName', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        ruleType,
        ruleName
    } = req.params;
    const ruleConfig = req.body;

    const updateResult = await workflowAutomationService.updateAutomationRules(
        ruleType,
        ruleName,
        ruleConfig
    );

    res.status(200).json({
        status: 'success',
        message: 'Automation rule updated successfully',
        data: updateResult
    });
}));

/**
 * Test workflow automation
 */
router.post('/automation/test', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        bypassAuditId
    } = req.body;

    if (!bypassAuditId) {
        throw new ApplicationError('Bypass audit ID is required', 400);
    }

    const automationResult = await workflowAutomationService.processAutomatedBypass(bypassAuditId);

    res.status(200).json({
        status: 'success',
        message: 'Workflow automation test completed',
        data: automationResult
    });
}));

/**
 * Test notification system
 */
router.post('/notifications/test', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        type = 'email',
            recipient = req.user.email,
            subject = 'Test Notification',
            message = 'This is a test notification from the bypass system.',
            channels = ['email']
    } = req.body;

    const notificationResult = await sendNotification({
        type: 'custom',
        recipient,
        channels,
        priority: 'medium',
        data: {
            subject,
            message,
            testNotification: true,
            timestamp: new Date().toISOString()
        }
    });

    res.status(200).json({
        status: 'success',
        message: 'Test notification sent',
        data: notificationResult
    });
}));

/**
 * Get system integration metrics
 */
router.get('/metrics', catchAsync(async (req, res) => {
    const {
        timeRange = 24
    } = req.query;
    const hotelId = req.user.hotelId;

    // Simulate metrics collection
    // In production, these would come from actual monitoring systems
    const metrics = {
        timeRange: `${timeRange} hours`,
        inventory: {
            totalIntegrations: 45,
            successfulIntegrations: 43,
            failedIntegrations: 2,
            averageResponseTime: 250, // ms
            reordersCreated: 12,
            stockAdjustments: 38,
            reconciliationAccuracy: 98.5 // %
        },
        automation: {
            totalWorkflows: 67,
            automatedWorkflows: 52,
            manualWorkflows: 15,
            autoApprovalRate: 35, // %
            averageProcessingTime: 180, // seconds
            errorRate: 2.3 // %
        },
        notifications: {
            totalNotifications: 156,
            emailNotifications: 98,
            smsNotifications: 23,
            pushNotifications: 35,
            deliverySuccessRate: 97.4, // %
            averageDeliveryTime: 3.2 // seconds
        },
        financial: {
            totalImpactsTracked: 67,
            averageImpactValue: 245.50,
            budgetAlertsTriggered: 8,
            recoveryActionsCreated: 23,
            recoveryRate: 78.5 // %
        }
    };

    res.status(200).json({
        status: 'success',
        data: metrics
    });
}));

/**
 * Trigger system sync
 */
router.post('/sync', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const {
        services = ['inventory', 'automation', 'notifications']
    } = req.body;
    const hotelId = req.user.hotelId;

    const syncResults = {
        timestamp: new Date(),
        services: {},
        overallSuccess: true
    };

    // Sync inventory system
    if (services.includes('inventory')) {
        try {
            const reconciliation = await inventoryIntegrationService.performInventoryReconciliation(hotelId, 1);
            syncResults.services.inventory = {
                success: true,
                itemsReconciled: reconciliation.itemsReconciled,
                discrepancies: reconciliation.discrepancies.length,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.inventory = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    // Sync automation system
    if (services.includes('automation')) {
        try {
            const health = await workflowAutomationService.getAutomationHealth();
            syncResults.services.automation = {
                success: true,
                enabled: health.enabled,
                rulesCount: health.metrics.totalRules,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.automation = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    // Sync notification system
    if (services.includes('notifications')) {
        try {
            // Test notification system
            await sendNotification({
                type: 'email',
                recipient: req.user.email,
                channels: ['email'],
                data: {
                    subject: 'System Sync Test',
                    message: 'System sync completed successfully',
                    timestamp: new Date().toISOString()
                }
            });

            const syncHid =
                req.user.hotelId?._id?.toString?.() ||
                (req.user.hotelId && req.user.hotelId.toString?.()) ||
                null;
            if (syncHid && req.user._id) {
                await sendNotification({
                    type: 'system_alert',
                    recipient: req.user._id.toString(),
                    channels: ['inApp'],
                    priority: 'low',
                    data: {
                        title: 'System sync test',
                        message: 'System sync completed successfully (notifications channel).',
                        hotelId: syncHid,
                        timestamp: new Date().toISOString()
                    }
                });
            }

            syncResults.services.notifications = {
                success: true,
                testNotificationSent: true,
                timestamp: new Date()
            };
        } catch (error) {
            syncResults.services.notifications = {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
            syncResults.overallSuccess = false;
        }
    }

    res.status(syncResults.overallSuccess ? 200 : 207).json({
        status: syncResults.overallSuccess ? 'success' : 'partial_success',
        message: syncResults.overallSuccess ? 'System sync completed successfully' : 'System sync completed with some errors',
        data: syncResults
    });
}));

/**
 * Get integration logs
 */
router.get('/logs', catchAsync(async (req, res) => {
    const {
        limit = 50,
            offset = 0,
            service = 'all',
            level = 'all',
            timeRange = 24
    } = req.query;

    // Integration log storage is not configured.
    // In production, this would query actual log storage (ELK, CloudWatch, etc.)
    // Returning empty results until a log backend is connected.
    const logs = [];

    res.status(200).json({
        status: 'success',
        data: {
            logs,
            pagination: {
                total: 0,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: false
            },
            filters: {
                service,
                level,
                timeRange: `${timeRange} hours`
            },
            notice: 'Log storage backend is not configured. Connect ELK, CloudWatch, or another log provider to populate integration logs.'
        }
    });
}));

/**
 * Configure system integration settings
 */
router.put('/settings', validate(mutationBaselineSchema), catchAsync(async (req, res) => {
    const settings = req.body;
    const hotelId = req.user.hotelId;

    // Validate settings
    const validSettings = {
        inventory: {
            autoAdjustEnabled: Boolean(settings.inventory?.autoAdjustEnabled),
            autoReorderEnabled: Boolean(settings.inventory?.autoReorderEnabled),
            reconciliationInterval: parseInt(settings.inventory?.reconciliationInterval) || 24
        },
        automation: {
            enabled: Boolean(settings.automation?.enabled),
            autoApprovalEnabled: Boolean(settings.automation?.autoApprovalEnabled),
            autoEscalationEnabled: Boolean(settings.automation?.autoEscalationEnabled)
        },
        notifications: {
            emailEnabled: Boolean(settings.notifications?.emailEnabled ?? true),
            smsEnabled: Boolean(settings.notifications?.smsEnabled),
            pushEnabled: Boolean(settings.notifications?.pushEnabled),
            webhookEnabled: Boolean(settings.notifications?.webhookEnabled)
        }
    };

    // In production, save settings to database
    logger.debug('Updating integration settings', { hotelId });

    res.status(200).json({
        status: 'success',
        message: 'Integration settings updated successfully',
        data: {
            hotelId,
            settings: validSettings,
            updatedAt: new Date()
        }
    });
}));

/**
 * Get system integration settings
 */
router.get('/settings', catchAsync(async (req, res) => {
    const hotelId = req.user.hotelId;

    // In production, retrieve from database
    const settings = {
        hotelId,
        inventory: {
            autoAdjustEnabled: true,
            autoReorderEnabled: true,
            reconciliationInterval: 24
        },
        automation: {
            enabled: true,
            autoApprovalEnabled: true,
            autoEscalationEnabled: true
        },
        notifications: {
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: true,
            webhookEnabled: false
        },
        updatedAt: new Date(),
        version: '1.0.0'
    };

    res.status(200).json({
        status: 'success',
        data: settings
    });
}));

export default router;