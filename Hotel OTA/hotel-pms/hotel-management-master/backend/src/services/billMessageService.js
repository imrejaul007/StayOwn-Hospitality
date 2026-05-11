import BillMessage from '../models/BillMessage.js';
import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class BillMessageService {
  
  /**
   * Process a message template with provided variables
   */
  async processMessage(messageId, variables = {}, options = {}) {
    try {
      const {
        languageCode = 'en',
        guestId = null,
        bookingId = null,
        roomId = null
      } = options;

      const message = await BillMessage.findById(messageId)
        .populate('hotelInfo', 'name address')
        .lean();

      if (!message) {
        throw new Error('Message template not found');
      }

      if (!message.isActive) {
        throw new Error('Message template is not active');
      }

      // Get the appropriate template (translated or original)
      let template = message.messageTemplate;
      let headerText = message.formatting?.headerText || '';
      let footerText = message.formatting?.footerText || '';

      if (languageCode !== message.language) {
        const translation = message.translations?.find(t => t.language === languageCode);
        if (translation) {
          template = translation.messageTemplate;
          headerText = translation.headerText || headerText;
          footerText = translation.footerText || footerText;
        }
      }

      // Process template variables
      const processedTemplate = this._processTemplateVariables(
        template, 
        message.templateVariables, 
        variables
      );

      const processedHeader = this._processTemplateVariables(
        headerText,
        message.templateVariables,
        variables
      );

      const processedFooter = this._processTemplateVariables(
        footerText,
        message.templateVariables,
        variables
      );

      // Build the complete message
      const processedMessage = {
        id: message._id,
        messageName: message.messageName,
        messageCode: message.messageCode,
        messageType: message.messageType,
        category: message.category,
        content: {
          header: processedHeader,
          body: processedTemplate,
          footer: processedFooter
        },
        formatting: message.formatting,
        language: languageCode,
        metadata: {
          processedAt: new Date(),
          guestId,
          bookingId,
          roomId,
          hotelId: message.hotelId,
          variables: variables
        }
      };

      return processedMessage;

    } catch (error) {
      logger.error('Error processing message:', error);
      throw new Error(`Failed to process message: ${error.message}`);
    }
  }

  /**
   * Find applicable messages for a specific trigger event
   */
  async findApplicableMessages(hotelId, triggerData) {
    try {
      const {
        event,
        roomTypeId,
        channel,
        guestType,
        amount,
        date = new Date()
      } = triggerData;

      // Build query for potentially applicable messages
      const query = {
        hotelId: mongoose.Types.ObjectId(hotelId),
        isActive: true,
        $or: [
          { 'triggerConditions.triggerEvents': event },
          { 'triggerConditions.automaticTrigger': false }
        ]
      };

      const messages = await BillMessage.find(query)
        .sort({ priority: -1, messageName: 1 })
        .lean().limit(1000);

      // Filter messages based on applicability rules
      const applicableMessages = messages.filter(message => {
        return this._isMessageApplicable(message, triggerData);
      });

      return applicableMessages;

    } catch (error) {
      logger.error('Error finding applicable messages:', error);
      throw new Error(`Failed to find applicable messages: ${error.message}`);
    }
  }

  /**
   * Auto-generate messages for a trigger event
   */
  async autoGenerateMessages(hotelId, triggerData) {
    try {
      const applicableMessages = await this.findApplicableMessages(hotelId, triggerData);
      
      const autoMessages = applicableMessages.filter(message => 
        message.triggerConditions.automaticTrigger
      );

      const generatedMessages = [];
      const successIds = [];
      const failureIds = [];

      for (const message of autoMessages) {
        try {
          // Check if message needs approval
          if (message.triggerConditions.conditions.requiresApproval) {
            const amount = triggerData.amount || 0;
            const threshold = message.triggerConditions.conditions.approvalThreshold || 0;

            if (amount >= threshold) {
              await this._queueForApproval(message, triggerData);
              continue;
            }
          }

          // Apply trigger delay if specified
          const delay = message.triggerConditions.triggerDelay;
          if (delay.amount > 0) {
            await this._scheduleDelayedMessage(message, triggerData, delay);
            continue;
          }

          // Generate message immediately
          const processedMessage = await this.processMessage(
            message._id,
            triggerData.variables || {},
            {
              languageCode: triggerData.languageCode || 'en',
              guestId: triggerData.guestId,
              bookingId: triggerData.bookingId,
              roomId: triggerData.roomId
            }
          );

          generatedMessages.push(processedMessage);
          successIds.push(message._id);

        } catch (messageError) {
          logger.error(`Error processing message ${message._id}:`, messageError);
          failureIds.push(message._id);
        }
      }

      // Batch: update usage statistics with bulkWrite instead of individual updates
      const statsBulkOps = [];
      if (successIds.length > 0) {
        statsBulkOps.push({
          updateMany: {
            filter: { _id: { $in: successIds } },
            update: {
              $inc: { 'usageStats.timesUsed': 1, 'usageStats.successfulDeliveries': 1 },
              $set: { 'usageStats.lastUsed': new Date() }
            }
          }
        });
      }
      if (failureIds.length > 0) {
        statsBulkOps.push({
          updateMany: {
            filter: { _id: { $in: failureIds } },
            update: { $inc: { 'usageStats.timesUsed': 1, 'usageStats.failedDeliveries': 1 } }
          }
        });
      }
      if (statsBulkOps.length > 0) {
        await BillMessage.bulkWrite(statsBulkOps);
      }

      return {
        totalApplicable: applicableMessages.length,
        autoGenerated: generatedMessages.length,
        messages: generatedMessages
      };

    } catch (error) {
      logger.error('Error auto-generating messages:', error);
      throw new Error(`Failed to auto-generate messages: ${error.message}`);
    }
  }

  /**
   * Generate message preview with sample data
   */
  async generatePreview(messageId, sampleVariables = {}) {
    try {
      const message = await BillMessage.findById(messageId).lean();
      
      if (!message) {
        throw new Error('Message template not found');
      }

      // Generate sample data for missing variables
      const previewVariables = { ...sampleVariables };
      
      message.templateVariables.forEach(variable => {
        if (previewVariables[variable.name] === undefined) {
          previewVariables[variable.name] = this._generateSampleValue(variable);
        }
      });

      // Process the message with sample data
      const processedMessage = await this.processMessage(
        messageId,
        previewVariables,
        { languageCode: message.language }
      );

      return {
        ...processedMessage,
        sampleVariables: previewVariables,
        isPreview: true
      };

    } catch (error) {
      logger.error('Error generating preview:', error);
      throw new Error(`Failed to generate preview: ${error.message}`);
    }
  }

  /**
   * Validate message template syntax
   */
  validateTemplate(template, variables = []) {
    const errors = [];
    const warnings = [];

    try {
      // Find all placeholders in the template
      const placeholderRegex = /\{\{([^}]+)\}\}/g;
      const foundPlaceholders = [];
      let match;

      while ((match = placeholderRegex.exec(template)) !== null) {
        foundPlaceholders.push(match[1].trim());
      }

      // Check for undefined variables
      const definedVariables = variables.map(v => v.name);
      foundPlaceholders.forEach(placeholder => {
        if (!definedVariables.includes(placeholder)) {
          errors.push(`Undefined variable: ${placeholder}`);
        }
      });

      // Check for unused variables
      definedVariables.forEach(variable => {
        if (!foundPlaceholders.includes(variable)) {
          warnings.push(`Unused variable: ${variable}`);
        }
      });

      // Check for malformed placeholders
      const malformedRegex = /\{[^{]|\}[^}]|\{[^}]*$|^[^{]*\}/g;
      if (malformedRegex.test(template)) {
        errors.push('Malformed placeholder syntax detected');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        placeholders: foundPlaceholders,
        unusedVariables: definedVariables.filter(v => !foundPlaceholders.includes(v))
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Template validation error: ${error.message}`],
        warnings,
        placeholders: [],
        unusedVariables: []
      };
    }
  }

  /**
   * Export messages to various formats
   */
  async exportMessages(hotelId, format = 'json', filters = {}) {
    try {
      const query = { hotelId, ...filters };
      const messages = await BillMessage.find(query)
        .populate('hotelInfo', 'name')
        .sort({ messageType: 1, messageName: 1 })
        .lean().limit(1000);

      switch (format.toLowerCase()) {
        case 'csv':
          return this._exportToCSV(messages);
        case 'json':
          return this._exportToJSON(messages);
        case 'xml':
          return this._exportToXML(messages);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

    } catch (error) {
      logger.error('Error exporting messages:', error);
      throw new Error(`Failed to export messages: ${error.message}`);
    }
  }

  /**
   * Import messages from file
   */
  async importMessages(hotelId, messagesData, options = {}) {
    try {
      const {
        skipDuplicates = true,
        updateExisting = false,
        createdBy
      } = options;

      const results = {
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: []
      };

      // Batch: check which messages already exist in a single query
      const messageCodes = messagesData.map(m => m.messageCode);
      const existingMessages = await BillMessage.find({
        hotelId,
        messageCode: { $in: messageCodes }
      }).limit(1000).lean();
      const existingByCode = new Map(existingMessages.map(m => [m.messageCode, m]));

      const newMessages = [];
      const updateOps = [];

      for (const messageData of messagesData) {
        try {
          const existing = existingByCode.get(messageData.messageCode);

          if (existing) {
            if (updateExisting) {
              updateOps.push({
                updateOne: {
                  filter: { _id: existing._id },
                  update: {
                    $set: {
                      ...messageData,
                      hotelId,
                      'auditInfo.updatedBy': createdBy,
                      'auditInfo.lastModified': new Date()
                    }
                  }
                }
              });
              results.updated++;
            } else if (skipDuplicates) {
              results.skipped++;
            } else {
              throw new Error(`Message code ${messageData.messageCode} already exists`);
            }
          } else {
            newMessages.push({
              ...messageData,
              hotelId,
              auditInfo: {
                createdBy,
                version: 1
              }
            });
            results.imported++;
          }

        } catch (messageError) {
          results.errors.push({
            messageCode: messageData.messageCode,
            error: messageError.message
          });
        }
      }

      // Batch: insert new messages and update existing ones
      if (newMessages.length > 0) {
        await BillMessage.insertMany(newMessages);
      }
      if (updateOps.length > 0) {
        await BillMessage.bulkWrite(updateOps);
      }

      return results;

    } catch (error) {
      logger.error('Error importing messages:', error);
      throw new Error(`Failed to import messages: ${error.message}`);
    }
  }

  /**
   * Generate usage analytics report
   */
  async generateAnalytics(hotelId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      
      // Get usage statistics
      const usageStats = await BillMessage.getUsageReport(hotelId, { startDate, endDate });

      // Get message distribution by type and category
      const distribution = await BillMessage.aggregate([
        { $match: { hotelId: mongoose.Types.ObjectId(hotelId) } },
        {
          $group: {
            _id: {
              type: '$messageType',
              category: '$category'
            },
            count: { $sum: 1 },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            totalUsages: { $sum: '$usageStats.timesUsed' }
          }
        }
      ]);

      // Get top performing messages
      const topMessages = await BillMessage.find({
        hotelId,
        'usageStats.timesUsed': { $gt: 0 }
      })
      .sort({ 'usageStats.timesUsed': -1 })
      .limit(10)
      .select('messageName messageType usageStats')
      .lean();

      // Get messages needing attention
      const needsAttention = await BillMessage.find({
        hotelId,
        $or: [
          { 'usageStats.failedDeliveries': { $gt: 0 } },
          { isActive: true, 'usageStats.timesUsed': 0, createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
        ]
      })
      .select('messageName messageType usageStats isActive')
      .lean().limit(1000);

      return {
        summary: {
          totalMessages: await BillMessage.countDocuments({ hotelId }),
          activeMessages: await BillMessage.countDocuments({ hotelId, isActive: true }),
          totalUsages: usageStats.reduce((sum, stat) => sum + stat.totalUsages, 0),
          totalSuccessful: usageStats.reduce((sum, stat) => sum + stat.totalSuccessful, 0),
          totalFailed: usageStats.reduce((sum, stat) => sum + stat.totalFailed, 0)
        },
        usageByType: usageStats,
        distribution,
        topMessages,
        needsAttention,
        generatedAt: new Date()
      };

    } catch (error) {
      logger.error('Error generating analytics:', error);
      throw new Error(`Failed to generate analytics: ${error.message}`);
    }
  }

  // Private helper methods
  _processTemplateVariables(template, templateVariables, providedVariables) {
    let processedTemplate = template;

    templateVariables.forEach(variable => {
      const value = providedVariables[variable.name] !== undefined 
        ? providedVariables[variable.name] 
        : variable.defaultValue;

      if (value !== undefined) {
        const placeholder = `{{${variable.name}}}`;
        let formattedValue = value;

        // Apply formatting based on data type
        switch (variable.dataType) {
          case 'currency':
            if (typeof value === 'number') {
              formattedValue = new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(value);
            }
            break;
          case 'date':
            if (value instanceof Date) {
              formattedValue = variable.format 
                ? this._formatDate(value, variable.format)
                : value.toLocaleDateString();
            }
            break;
          case 'number':
            if (typeof value === 'number') {
              formattedValue = value.toLocaleString();
            }
            break;
          case 'boolean':
            formattedValue = value ? 'Yes' : 'No';
            break;
          case 'array':
            if (Array.isArray(value)) {
              formattedValue = value.join(', ');
            }
            break;
          default:
            formattedValue = value.toString();
        }

        processedTemplate = processedTemplate.replace(
          new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          formattedValue.toString()
        );
      }
    });

    return processedTemplate;
  }

  _isMessageApplicable(message, criteria) {
    const {
      roomTypeId,
      channel,
      guestType,
      amount,
      date = new Date(),
      event
    } = criteria;

    // Check room type applicability
    if (message.applicableRoomTypes.length > 0 && roomTypeId) {
      if (!message.applicableRoomTypes.some(rt => rt.toString() === roomTypeId.toString())) {
        return false;
      }
    }

    // Check channel applicability
    if (message.applicableChannels.length > 0 && channel) {
      if (!message.applicableChannels.includes(channel) && 
          !message.applicableChannels.includes('all')) {
        return false;
      }
    }

    // Check guest type applicability
    if (message.applicableGuestTypes.length > 0 && guestType) {
      if (!message.applicableGuestTypes.includes(guestType) && 
          !message.applicableGuestTypes.includes('all')) {
        return false;
      }
    }

    // Check amount conditions
    if (amount !== undefined && message.triggerConditions.conditions) {
      const conditions = message.triggerConditions.conditions;
      if (conditions.minAmount && amount < conditions.minAmount) {
        return false;
      }
      if (conditions.maxAmount && amount > conditions.maxAmount) {
        return false;
      }
    }

    // Check date conditions
    if (date && message.triggerConditions.conditions) {
      const dayOfWeek = date.getDay();
      const conditions = message.triggerConditions.conditions;
      
      if (conditions.weekdayOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
        return false;
      }
      if (conditions.weekendOnly && (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        return false;
      }
      
      // Check excluded dates
      if (conditions.excludeDates && conditions.excludeDates.some(excludeDate => 
        new Date(excludeDate).toDateString() === date.toDateString())) {
        return false;
      }
      
      // Check specific dates
      if (conditions.specificDates && conditions.specificDates.length > 0) {
        if (!conditions.specificDates.some(specificDate => 
          new Date(specificDate).toDateString() === date.toDateString())) {
          return false;
        }
      }
    }

    return true;
  }

  _generateSampleValue(variable) {
    switch (variable.dataType) {
      case 'string':
        return variable.defaultValue || `Sample ${variable.displayName}`;
      case 'number':
        return variable.defaultValue || 123.45;
      case 'currency':
        return variable.defaultValue || 99.99;
      case 'date':
        return variable.defaultValue || new Date();
      case 'boolean':
        return variable.defaultValue !== undefined ? variable.defaultValue : true;
      case 'array':
        return variable.defaultValue || ['Item 1', 'Item 2'];
      default:
        return variable.defaultValue || `[${variable.name}]`;
    }
  }

  _formatDate(date, format) {
    // Simple date formatting - in production, use a proper date library
    const options = {};
    
    switch (format) {
      case 'short':
        options.dateStyle = 'short';
        break;
      case 'long':
        options.dateStyle = 'long';
        break;
      case 'full':
        options.dateStyle = 'full';
        break;
      default:
        options.dateStyle = 'medium';
    }
    
    return date.toLocaleDateString('en-US', options);
  }

  async _queueForApproval(message, triggerData) {
    try {
      // In a real implementation, this would queue the message for approval
      logger.debug(`Message ${message.messageCode} queued for approval`);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  async _scheduleDelayedMessage(message, triggerData, delay) {
    try {
      // In a real implementation, this would schedule the message using a job queue
      logger.debug(`Message ${message.messageCode} scheduled with ${delay.amount} ${delay.unit} delay`);
    } catch (error) {
      throw new Error(`${error.message}`);
    }
  }

  _exportToCSV(messages) {
    const csvRows = [];
    
    // CSV Header
    csvRows.push([
      'Message Name',
      'Message Code',
      'Type',
      'Category',
      'Active',
      'Times Used',
      'Success Rate',
      'Last Used',
      'Created At'
    ].join(','));

    // Process each message
    messages.forEach(message => {
      const successRate = message.usageStats.successfulDeliveries + message.usageStats.failedDeliveries > 0
        ? (message.usageStats.successfulDeliveries / (message.usageStats.successfulDeliveries + message.usageStats.failedDeliveries) * 100).toFixed(2)
        : '0';

      const row = [
        `"${message.messageName}"`,
        message.messageCode,
        message.messageType,
        message.category,
        message.isActive ? 'Yes' : 'No',
        message.usageStats.timesUsed,
        `${successRate}%`,
        message.usageStats.lastUsed ? new Date(message.usageStats.lastUsed).toLocaleDateString() : 'Never',
        new Date(message.createdAt).toLocaleDateString()
      ];
      
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  _exportToJSON(messages) {
    return JSON.stringify(messages, null, 2);
  }

  _exportToXML(messages) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<messages>\n';
    
    messages.forEach(message => {
      xml += '  <message>\n';
      xml += `    <name><![CDATA[${message.messageName}]]></name>\n`;
      xml += `    <code>${message.messageCode}</code>\n`;
      xml += `    <type>${message.messageType}</type>\n`;
      xml += `    <category>${message.category}</category>\n`;
      xml += `    <active>${message.isActive}</active>\n`;
      xml += `    <template><![CDATA[${message.messageTemplate}]]></template>\n`;
      xml += '  </message>\n';
    });
    
    xml += '</messages>';
    return xml;
  }
}

export default new BillMessageService();