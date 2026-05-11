import { ensureTenantContext } from '../middleware/tenantIsolation.js';
import Content from '../models/Content.js';
import Translation from '../models/Translation.js';
import translationService from '../services/translationService.js';
import localizationUtils from '../utils/localizationUtils.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Content Management Controller
 * 
 * Handles multilingual content creation, management, and localization
 */
class ContentController {
  /**
   * Get content with optional language filtering
   */
  getContent = catchAsync(async (req, res, next) => {
    const {
      namespace,
      category,
      language,
      search,
      tags,
      status = 'published',
      page = 1,
      limit = 50,
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    const options = {
      namespace,
      category,
      tags: tags ? tags.split(',') : undefined,
      includeDrafts: status === 'all',
      sortBy: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      skip: (page - 1) * limit,
      limit: parseInt(limit)
    };

    let content;
    if (search) {
      content = await Content.searchContent(search, options);
    } else if (namespace) {
      content = await Content.getByNamespace(namespace, category, options);
    } else {
      // Get all content with filters
      const query = {
        isActive: true,
        status: options.includeDrafts ? { $in: ['draft', 'published'] } : 'published'
      };
      
      if (category) query.category = category;
      if (options.tags && options.tags.length > 0) query.tags = { $in: options.tags };

      content = await Content.find(query)
        .sort(options.sortBy)
        .skip(options.skip)
        .limit(options.limit)
        .populate('createdBy updatedBy', 'name email').lean();
    }

    // If language is specified and different from base language, get translations
    if (language && content.length > 0) {
      for (const item of content) {
        if (language.toUpperCase() !== item.baseLanguage) {
          const translation = await Translation.getFieldTranslation(
            'content',
            item._id,
            'defaultContent',
            language
          );
          
          if (translation) {
            item.localizedContent = translation.translatedText;
            item.translationStatus = translation.quality.reviewStatus;
          }
        }
      }
    }

    res.status(200).json({
      status: 'success',
      results: content.length,
      currentPage: parseInt(page),
      data: {
        content,
        language: language || null
      }
    });
  });

  /**
   * Get content by key
   */
  getContentByKey = catchAsync(async (req, res, next) => {
    const { key } = req.params;
    const { language, variation, variables } = req.query;

    // Parse variables if provided
    let templateVars = {};
    if (variables) {
      try {
        templateVars = JSON.parse(variables);
      } catch (error) {
        templateVars = {};
      }
    }

    if (language) {
      // Get localized content
      const localizedContent = await localizationUtils.getLocalizedContent(
        key,
        language,
        templateVars,
        { variation, skipUsageTracking: false }
      );

      res.status(200).json({
        status: 'success',
        data: {
          key,
          language,
          content: localizedContent,
          variation: variation || null,
          variables: templateVars
        }
      });
    } else {
      // Get base content
      const content = await Content.getByKey(key, null, { includeDrafts: false });
      if (!content) {
        return next(new ApplicationError('Content not found', 404));
      }

      const renderedContent = content.render(templateVars, variation);

      res.status(200).json({
        status: 'success',
        data: {
          key,
          content: renderedContent,
          baseLanguage: content.baseLanguage,
          variation: variation || null,
          variables: templateVars,
          metadata: {
            title: content.title,
            description: content.description,
            contentType: content.contentType,
            lastUpdated: content.updatedAt
          }
        }
      });
    }
  });

  /**
   * Create new content
   */
  createContent = catchAsync(async (req, res, next) => {
    const {
      key,
      namespace,
      category,
      subcategory,
      title,
      description,
      contentType = 'text',
      defaultContent,
      baseLanguage = 'EN',
      translationConfig = {},
      variations = [],
      variables = [],
      tags = [],
      permissions = {}
    } = req.body;

    // Validate required fields
    if (!key || !namespace || !category || !title || !defaultContent) {
      return next(new ApplicationError('Key, namespace, category, title, and defaultContent are required', 400));
    }

    // Check if content key already exists
    const existingContent = await Content.findOne({ key: key.toLowerCase() }).lean();
    if (existingContent) {
      return next(new ApplicationError('Content key already exists', 409));
    }

    const content = await Content.create({
      key: key.toLowerCase(),
      namespace,
      category,
      subcategory,
      title,
      description,
      contentType,
      defaultContent,
      baseLanguage: baseLanguage.toUpperCase(),
      translationConfig: {
        isTranslatable: true,
        autoTranslate: false,
        priority: 'medium',
        qualityThreshold: 0.8,
        requireReview: true,
        ...translationConfig
      },
      variations,
      variables,
      tags: tags.map(tag => tag.toLowerCase()),
      permissions: {
        view: ['admin', 'content_manager', 'staff'],
        edit: ['admin', 'content_manager'],
        translate: ['admin', 'content_manager', 'translator'],
        approve: ['admin', 'content_manager', 'reviewer'],
        ...permissions
      },
      status: 'draft',
      createdBy: req.user._id
    });

    logger.info('Content created', {
      contentKey: content.key,
      namespace: content.namespace,
      category: content.category,
      userId: req.user._id
    });

    res.status(201).json({
      status: 'success',
      data: {
        content
      }
    });
  });

  /**
   * Update content
   */
  updateContent = catchAsync(async (req, res, next) => {
    const { key } = req.params;
    const updates = { ...req.body };
    const { createVersion = false, versionNotes } = req.query;

    // Remove immutable fields
    delete updates.key;
    delete updates.createdBy;

    if (createVersion === 'true') {
      // Need to load document for versioning before the atomic update
      const existing = await Content.findOne({
        key: key.toLowerCase(),
        isActive: true
      }).lean();

      if (!existing) {
        return next(new ApplicationError('Content not found', 404));
      }

      await existing.createVersion(versionNotes || 'Content updated', req.user._id);
    }

    // Atomic update using findOneAndUpdate
    const content = await Content.findOneAndUpdate(
      { key: key.toLowerCase(), isActive: true },
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );

    if (!content) {
      return next(new ApplicationError('Content not found', 404));
    }

    logger.info('Content updated', {
      contentKey: content.key,
      version: content.publishing?.version,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        content
      }
    });
  });

  /**
   * Delete content
   */
  deleteContent = catchAsync(async (req, res, next) => {
    const { key } = req.params;
    const { permanent = false } = req.query;

    const content = await Content.findOne({ 
      key: key.toLowerCase(), 
      isActive: true 
    }).lean();

    if (!content) {
      return next(new ApplicationError('Content not found', 404));
    }

    if (content.isSystem && permanent === 'true') {
      return next(new ApplicationError('Cannot permanently delete system content', 400));
    }

    if (permanent === 'true') {
      // Permanent deletion - also delete all translations
      const hotelId = req.user?.hotelId || req.user?.hotel || req.tenantId;
      await Translation.deleteMany({
        resourceType: 'content',
        resourceId: content._id,
        ...(hotelId && { hotelId })
      });
      
      await content.deleteOne();
      
      logger.info('Content permanently deleted', {
        contentKey: content.key,
        userId: req.user._id
      });
    } else {
      // Soft delete - validate status transition
      const allowedContentTransitions = {
        draft: ['published', 'archived'],
        published: ['draft', 'archived'],
        archived: []
      };
      const allowedTargets = allowedContentTransitions[content.status] || ['archived'];
      if (!allowedTargets.includes('archived')) {
        return next(new ApplicationError(
          `Cannot archive content: invalid transition from '${content.status}' to 'archived'`,
          400
        ));
      }

      content.isActive = false;
      content.status = 'archived';
      content.updatedBy = req.user._id;
      await content.save();

      logger.info('Content archived', {
        contentKey: content.key,
        userId: req.user._id
      });
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  });

  /**
   * Publish content
   */
  publishContent = catchAsync(async (req, res, next) => {
    const { key } = req.params;

    const content = await Content.findOne({ 
      key: key.toLowerCase(), 
      isActive: true 
    }).lean();

    if (!content) {
      return next(new ApplicationError('Content not found', 404));
    }

    await content.publish(req.user._id);

    res.status(200).json({
      status: 'success',
      data: {
        content
      }
    });
  });

  /**
   * Translate content
   */
  translateContent = catchAsync(async (req, res, next) => {
    const { key } = req.params;
    const { 
      targetLanguages,
      provider,
      autoApprove = false,
      forceRetranslate = false
    } = req.body;

    if (!targetLanguages || !Array.isArray(targetLanguages)) {
      return next(new ApplicationError('targetLanguages array is required', 400));
    }

    const content = await Content.findOne({ 
      key: key.toLowerCase(), 
      isActive: true 
    }).lean();

    if (!content) {
      return next(new ApplicationError('Content not found', 404));
    }

    if (!content.translationConfig.isTranslatable) {
      return next(new ApplicationError('Content is not translatable', 400));
    }

    // Get the content text to translate
    let textToTranslate;
    if (typeof content.defaultContent === 'string') {
      textToTranslate = content.defaultContent;
    } else {
      // For complex content types, stringify for translation
      textToTranslate = JSON.stringify(content.defaultContent);
    }

    const options = {
      provider,
      autoApprove,
      forceRetranslate,
      userId: req.user._id,
      context: {
        contentType: content.contentType,
        namespace: content.namespace,
        category: content.category
      }
    };

    const results = await localizationUtils.translateAndStore(
      'content',
      content._id,
      'defaultContent',
      textToTranslate,
      content.baseLanguage,
      targetLanguages,
      options
    );

    // Update language status in content
    for (const result of results) {
      if (result.status === 'translated') {
        await content.updateLanguageStatus(
          result.language,
          autoApprove ? 'published' : 'pending'
        );
      }
    }

    logger.info('Content translation requested', {
      contentKey: content.key,
      targetLanguages: targetLanguages.length,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        results
      }
    });
  });

  /**
   * Get content translations
   */
  getContentTranslations = catchAsync(async (req, res, next) => {
    const { key } = req.params;
    const { language, includeHistory = false } = req.query;

    const content = await Content.findOne({ 
      key: key.toLowerCase(), 
      isActive: true 
    }).lean();

    if (!content) {
      return next(new ApplicationError('Content not found', 404));
    }

    const options = {
      targetLanguage: language,
      includeHistory: includeHistory === 'true'
    };

    const translations = await Translation.getResourceTranslations(
      'content',
      content._id,
      options
    );

    res.status(200).json({
      status: 'success',
      results: translations.length,
      data: {
        contentKey: key,
        baseLanguage: content.baseLanguage,
        translations
      }
    });
  });

  /**
   * Get translatable content
   */
  getTranslatableContent = catchAsync(async (req, res, next) => {
    const {
      priority,
      autoTranslate,
      namespace,
      category,
      limit = 50
    } = req.query;

    const options = {
      priority,
      autoTranslate: autoTranslate !== undefined ? autoTranslate === 'true' : undefined,
      limit: parseInt(limit)
    };

    let content = await Content.getTranslatableContent(options);

    // Apply additional filters
    if (namespace || category) {
      content = content.filter(item => {
        if (namespace && item.namespace !== namespace) return false;
        if (category && item.category !== category) return false;
        return true;
      });
    }

    res.status(200).json({
      status: 'success',
      results: content.length,
      data: {
        content
      }
    });
  });

  /**
   * Batch translate content
   */
  batchTranslateContent = catchAsync(async (req, res, next) => {
    const { 
      contentKeys,
      targetLanguages,
      provider,
      autoApprove = false
    } = req.body;

    if (!contentKeys || !Array.isArray(contentKeys) || !targetLanguages || !Array.isArray(targetLanguages)) {
      return next(new ApplicationError('contentKeys and targetLanguages arrays are required', 400));
    }

    const results = [];

    // Batch-fetch all content items upfront to avoid N+1 queries
    const lowerKeys = contentKeys.map(k => k.toLowerCase());
    const allContent = await Content.find({
      key: { $in: lowerKeys },
      isActive: true
    }).lean().limit(1000);
    const contentByKey = new Map(allContent.map(c => [c.key, c]));

    for (const key of contentKeys) {
      try {
        const content = contentByKey.get(key.toLowerCase());

        if (!content || !content.translationConfig.isTranslatable) {
          results.push({
            contentKey: key,
            status: 'skipped',
            reason: content ? 'not translatable' : 'not found'
          });
          continue;
        }

        let textToTranslate;
        if (typeof content.defaultContent === 'string') {
          textToTranslate = content.defaultContent;
        } else {
          textToTranslate = JSON.stringify(content.defaultContent);
        }

        const translationResults = await localizationUtils.translateAndStore(
          'content',
          content._id,
          'defaultContent',
          textToTranslate,
          content.baseLanguage,
          targetLanguages,
          {
            provider,
            autoApprove,
            userId: req.user._id,
            context: {
              contentType: content.contentType,
              namespace: content.namespace,
              category: content.category
            }
          }
        );

        results.push({
          contentKey: key,
          status: 'processed',
          translations: translationResults
        });

      } catch (error) {
        results.push({
          contentKey: key,
          status: 'error',
          error: error.message
        });
      }
    }

    logger.info('Batch content translation completed', {
      contentCount: contentKeys.length,
      languageCount: targetLanguages.length,
      userId: req.user._id
    });

    res.status(200).json({
      status: 'success',
      data: {
        results
      }
    });
  });

  /**
   * Get content statistics
   */
  getContentStats = catchAsync(async (req, res, next) => {
    const {
      namespace,
      category,
      language
    } = req.query;

    // Base content statistics
    const contentStats = await Content.aggregate([
      {
        $match: {
          isActive: true,
          ...(namespace && { namespace }),
          ...(category && { category })
        }
      },
      {
        $group: {
          _id: {
            namespace: '$namespace',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.namespace',
          total: { $sum: '$count' },
          draft: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'draft'] }, '$count', 0]
            }
          },
          published: {
            $sum: {
              $cond: [{ $eq: ['$_id.status', 'published'] }, '$count', 0]
            }
          }
        }
      }
    ]);

    // Translation statistics if language specified
    let translationStats = null;
    if (language) {
      translationStats = await Translation.getTranslationStats({
        resourceType: 'content',
        targetLanguage: language.toUpperCase()
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        contentStats,
        translationStats
      }
    });
  });
}

export default new ContentController();
