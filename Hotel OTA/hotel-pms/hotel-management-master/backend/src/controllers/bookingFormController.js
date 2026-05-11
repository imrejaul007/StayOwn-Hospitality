import BookingFormTemplate from '../models/BookingFormTemplate.js';
import bookingFormService from '../services/bookingFormService.js';
import { validationResult } from 'express-validator';
import logger from '../utils/logger.js';

// Escape special regex characters to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const bookingFormController = {
  async createTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      if (!req.user || !req.user.hotelId) {
        return res.status(401).json({
          success: false,
          error: 'User authentication failed - missing hotel ID'
        });
      }

      const templateData = {
        ...req.body,
        hotelId: req.user.hotelId,
        createdBy: req.user.id,
        updatedBy: req.user.id
      };

      const template = await bookingFormService.createTemplate(templateData, req.user.id);

      res.status(201).json({
        success: true,
        data: template,
        message: 'Form template created successfully'
      });
    } catch (error) {
      logger.error('Error creating form template:', error.message);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.message
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create form template',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getTemplates(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const {
        page = '1',
        limit = '10',
        status,
        category,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

      const filter = { hotelId: req.user.hotelId };

      if (status && status !== 'all') {
        filter.status = status;
      }

      if (category && category !== 'all') {
        filter.category = category;
      }

      if (search && typeof search === 'string') {
        const safeSearch = escapeRegex(search.trim());
        if (safeSearch) {
          filter.$or = [
            { name: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } }
          ];
        }
      }

      const skip = (pageNum - 1) * limitNum;
      const sort = {};
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [templates, total] = await Promise.all([
        BookingFormTemplate.find(filter)
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email')
          .sort(sort)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        BookingFormTemplate.countDocuments(filter)
      ]);

      // Add virtual fields that .lean() strips
      const enrichedTemplates = templates.map(t => ({
        ...t,
        fieldCount: t.fields ? t.fields.length : 0,
        requiredFieldCount: t.fields ? t.fields.filter(f => f.required).length : 0
      }));

      res.json({
        success: true,
        data: {
          templates: enrichedTemplates,
          pagination: {
            current: pageNum,
            pages: Math.ceil(total / limitNum) || 1,
            total,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching form templates:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form templates'
      });
    }
  },

  async getTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email').lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        data: {
          ...template,
          fieldCount: template.fields ? template.fields.length : 0,
          requiredFieldCount: template.fields ? template.fields.filter(f => f.required).length : 0
        }
      });
    } catch (error) {
      logger.error('Error fetching form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form template'
      });
    }
  },

  async updateTemplate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = {
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date()
      };

      const template = await BookingFormTemplate.findOneAndUpdate(
        { _id: id, hotelId: req.user.hotelId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        data: template,
        message: 'Form template updated successfully'
      });
    } catch (error) {
      logger.error('Error updating form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to update form template'
      });
    }
  },

  async deleteTemplate(req, res) {
    try {
      const { id } = req.params;
      const template = await BookingFormTemplate.findOneAndDelete({
        _id: id,
        hotelId: req.user.hotelId
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      res.json({
        success: true,
        message: 'Form template deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to delete form template'
      });
    }
  },

  async duplicateTemplate(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;

      const originalTemplate = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      }).lean();

      if (!originalTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      // .lean() already returns a plain object, no need for .toObject()
      const duplicateData = { ...originalTemplate };
      delete duplicateData._id;
      delete duplicateData.__v;
      
      duplicateData.name = name || `${originalTemplate.name} (Copy)`;
      duplicateData.status = 'draft';
      duplicateData.isPublished = false;
      duplicateData.publishedAt = null;
      duplicateData.createdBy = req.user.id;
      duplicateData.updatedBy = req.user.id;
      duplicateData.createdAt = new Date();
      duplicateData.updatedAt = new Date();
      // Reset usage stats for the duplicate
      duplicateData.usage = { views: 0, submissions: 0, conversionRate: 0 };

      const duplicateTemplate = new BookingFormTemplate(duplicateData);
      await duplicateTemplate.save();

      res.status(201).json({
        success: true,
        data: duplicateTemplate,
        message: 'Form template duplicated successfully'
      });
    } catch (error) {
      logger.error('Error duplicating form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to duplicate form template'
      });
    }
  },

  // Public endpoints — no req.user available
  async renderForm(req, res) {
    try {
      const { id } = req.params;
      const { preview = false } = req.query;

      // Public route: look up by _id only (no hotelId filter)
      const template = await BookingFormTemplate.findById(id).lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const isPreview = preview === 'true' || preview === true;
      if (!isPreview && template.status !== 'published' && template.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Form template is not published'
        });
      }

      // Increment views atomically
      await BookingFormTemplate.updateOne(
        { _id: id },
        { $inc: { 'usage.views': 1 }, $set: { 'usage.lastUsed': new Date() } }
      );

      res.json({
        success: true,
        data: {
          id: template._id,
          name: template.name,
          description: template.description,
          fields: template.fields,
          styling: template.styling,
          settings: {
            successMessage: template.settings?.successMessage,
            errorMessage: template.settings?.errorMessage,
            enableProgressBar: template.settings?.enableProgressBar,
            enableCaptcha: template.settings?.enableCaptcha,
            submitButtonText: template.settings?.submitButtonText
          }
        }
      });
    } catch (error) {
      logger.error('Error rendering form:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to render form'
      });
    }
  },

  async submitForm(req, res) {
    try {
      const { id } = req.params;
      const submissionData = req.body;

      // Public route: look up by _id, check status
      const template = await BookingFormTemplate.findOne({
        _id: id,
        $or: [{ status: 'published' }, { status: 'active' }]
      });

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found or inactive'
        });
      }

      // Validate submission using the model instance method
      const validationErrors = template.validateForm(submissionData);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: validationErrors
        });
      }

      // Increment submissions atomically
      await BookingFormTemplate.updateOne(
        { _id: id },
        {
          $inc: { 'usage.submissions': 1 },
          $set: { 'usage.lastUsed': new Date() }
        }
      );

      res.json({
        success: true,
        message: template.settings?.successMessage || 'Form submitted successfully'
      });
    } catch (error) {
      logger.error('Error submitting form:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to submit form'
      });
    }
  },

  async validateForm(req, res) {
    try {
      const { id } = req.params;
      const formData = req.body;

      // Public route: look up by _id only
      const template = await BookingFormTemplate.findById(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const formValidationErrors = template.validateForm(formData);

      res.json({
        success: true,
        data: {
          valid: formValidationErrors.length === 0,
          errors: formValidationErrors
        }
      });
    } catch (error) {
      logger.error('Error validating form:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to validate form'
      });
    }
  },

  async getAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { 
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate = new Date(),
        groupBy = 'day'
      } = req.query;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      }).lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const analytics = await bookingFormService.getFormAnalytics(
        template._id,
        {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          groupBy
        }
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error fetching form analytics:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch form analytics'
      });
    }
  },

  async exportTemplate(req, res) {
    try {
      const { id } = req.params;
      const { format = 'json' } = req.query;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      }).lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const exportData = await bookingFormService.exportTemplate(template, format);

      // Sanitize filename to prevent header injection
      const safeName = template.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').slice(0, 100);
      res.setHeader('Content-Type',
        format === 'json' ? 'application/json' : 'text/plain'
      );
      res.setHeader('Content-Disposition',
        `attachment; filename="${safeName}.${format}"`
      );

      res.send(exportData);
    } catch (error) {
      logger.error('Error exporting form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to export form template'
      });
    }
  },

  async importTemplate(req, res) {
    try {
      const { data, overwrite = false } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Template data is required'
        });
      }

      const importedTemplate = await bookingFormService.importTemplate(
        data,
        {
          hotelId: req.user.hotelId,
          createdBy: req.user.id,
          updatedBy: req.user.id,
          overwrite
        }
      );

      res.status(201).json({
        success: true,
        data: importedTemplate,
        message: 'Form template imported successfully'
      });
    } catch (error) {
      logger.error('Error importing form template:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to import form template'
      });
    }
  },

  async testABVariant(req, res) {
    try {
      const { id } = req.params;
      const { variantId, action = 'view' } = req.body;

      const template = await BookingFormTemplate.findOne({
        _id: id,
        hotelId: req.user.hotelId
      }).lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Form template not found'
        });
      }

      const result = await bookingFormService.recordABTestEvent(
        template._id,
        variantId,
        action,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip
        }
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error recording A/B test event:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to record A/B test event'
      });
    }
  }
};

export default bookingFormController;
