import mongoose from 'mongoose';

/**
 * Query Optimizer
 *
 * Provides utilities for optimizing MongoDB queries to avoid N+1 queries
 * and improve overall database performance.
 */
class QueryOptimizer {
  /**
   * Optimize populate operations to avoid N+1 queries
   * Uses lean() for better performance with read-only queries
   *
   * @param {Object} query - Mongoose query object
   * @param {Array|String} populateFields - Fields to populate
   * @returns {Object} Optimized query
   */
  static optimizedPopulate(query, populateFields) {
    if (!populateFields) return query;

    const fields = Array.isArray(populateFields) ? populateFields : [populateFields];

    // Batch populate operations with lean option
    const populateOptions = fields.map(field => {
      if (typeof field === 'string') {
        return { path: field, options: { lean: true } };
      }
      // If field is already an object, ensure lean is enabled
      return {
        ...field,
        options: { ...(field.options || {}), lean: true }
      };
    });

    return query.populate(populateOptions);
  }

  /**
   * Add lean() to read-only queries for faster performance
   * Converts Mongoose documents to plain JavaScript objects
   *
   * @param {Object} query - Mongoose query object
   * @returns {Object} Query with lean enabled
   */
  static lean(query) {
    return query.lean();
  }

  /**
   * Optimize aggregation pipelines
   * Adds $match early and limits fields with $project
   *
   * @param {Array} pipeline - Aggregation pipeline
   * @param {Object} matchStage - Match conditions to add early
   * @param {Object} projectFields - Fields to project
   * @returns {Array} Optimized pipeline
   */
  static optimizeAggregation(pipeline, matchStage = null, projectFields = null) {
    const optimized = [...pipeline];

    // Add $match as early as possible to reduce documents in pipeline
    if (matchStage) {
      optimized.unshift({ $match: matchStage });
    }

    // Add $project to limit fields if specified
    if (projectFields) {
      const projectIndex = optimized.findIndex(stage => stage.$project);
      if (projectIndex === -1) {
        // Add project stage before sort/limit if they exist
        const sortIndex = optimized.findIndex(stage => stage.$sort);
        const limitIndex = optimized.findIndex(stage => stage.$limit);
        const insertIndex = Math.min(
          sortIndex === -1 ? Infinity : sortIndex,
          limitIndex === -1 ? Infinity : limitIndex,
          optimized.length
        );
        optimized.splice(insertIndex, 0, { $project: projectFields });
      }
    }

    return optimized;
  }

  /**
   * Batch load related documents
   * Loads multiple documents by IDs and returns a Map for O(1) lookup
   *
   * @param {Object} model - Mongoose model
   * @param {Array} ids - Array of document IDs
   * @param {String|Object} fields - Fields to select (optional)
   * @returns {Promise<Map>} Map of document ID to document
   */
  static async batchLoad(model, ids, fields = null) {
    if (!ids || ids.length === 0) {
      return new Map();
    }

    // Remove duplicates
    const uniqueIds = [...new Set(ids.map(id => id.toString()))];

    const query = model.find({ _id: { $in: uniqueIds } });

    if (fields) {
      query.select(fields);
    }

    const docs = await query.lean().exec();

    // Create map for O(1) lookup
    const docMap = new Map();
    docs.forEach(doc => {
      docMap.set(doc._id.toString(), doc);
    });

    return docMap;
  }

  /**
   * Batch load with custom query condition
   * Similar to batchLoad but allows custom query conditions
   *
   * @param {Object} model - Mongoose model
   * @param {Object} query - Query conditions
   * @param {String} keyField - Field to use as map key (default: '_id')
   * @param {String|Object} fields - Fields to select (optional)
   * @returns {Promise<Map>} Map of key to document
   */
  static async batchLoadBy(model, query, keyField = '_id', fields = null) {
    const queryBuilder = model.find(query);

    if (fields) {
      queryBuilder.select(fields);
    }

    const docs = await queryBuilder.lean().exec();

    // Create map using specified key field
    const docMap = new Map();
    docs.forEach(doc => {
      const key = doc[keyField]?.toString() || doc[keyField];
      docMap.set(key, doc);
    });

    return docMap;
  }

  /**
   * Create optimized query with common patterns
   * Combines multiple optimization techniques
   *
   * @param {Object} model - Mongoose model
   * @param {Object} filter - Query filter
   * @param {Object} options - Query options
   * @returns {Object} Optimized query
   */
  static createOptimizedQuery(model, filter, options = {}) {
    const {
      select = null,
      populate = null,
      sort = null,
      limit = null,
      skip = null,
      lean = true
    } = options;

    let query = model.find(filter);

    // Add select to limit fields
    if (select) {
      query = query.select(select);
    }

    // Add optimized populate
    if (populate) {
      query = this.optimizedPopulate(query, populate);
    }

    // Add sort
    if (sort) {
      query = query.sort(sort);
    }

    // Add pagination
    if (skip) {
      query = query.skip(skip);
    }
    if (limit) {
      query = query.limit(limit);
    }

    // Add lean for better performance
    if (lean) {
      query = query.lean();
    }

    return query;
  }

  /**
   * Execute query with performance timing
   * Logs query execution time for monitoring
   *
   * @param {Object} query - Mongoose query
   * @param {String} queryName - Name for logging
   * @returns {Promise<any>} Query result
   */
  static async executeWithTiming(query, queryName = 'Query') {
    const startTime = Date.now();

    try {
      const result = await query.exec();
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        console.warn(`[Performance Warning] ${queryName} took ${duration}ms`);
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[Query Performance] ${queryName}: ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[Query Error] ${queryName} failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Create indexes for optimal query performance
   * Helper to define recommended indexes
   *
   * @param {Object} model - Mongoose model
   * @param {Array} indexes - Array of index definitions
   * @returns {Promise<void>}
   */
  static async ensureIndexes(model, indexes) {
    for (const index of indexes) {
      try {
        await model.collection.createIndex(index.fields, {
          ...index.options,
          background: true
        });
        console.log(`✅ Index created on ${model.modelName}:`, index.fields);
      } catch (error) {
        console.error(`❌ Failed to create index on ${model.modelName}:`, error);
      }
    }
  }
}

export default QueryOptimizer;
