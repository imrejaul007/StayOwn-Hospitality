import mongoose from 'mongoose';
import logger from '../utils/logger.js';

// RABTUL Search Service URL
const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || 'https://rez-search-service.onrender.com';

class SearchService {
  /**
   * Send search request to RABTUL Search Service
   */
  async sendToRABTUL(query, options = {}) {
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

    const response = await fetch(`${SEARCH_SERVICE_URL}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': internalToken,
      },
      body: JSON.stringify({ query, filters: options }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RABTUL Search Service error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async globalSearch(query, options = {}) {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const hotelId = options.hotelId;
      const startTime = Date.now();

      if (!query || query.trim().length < 2) {
        return {
          query,
          total: 0,
          results: [],
          pagination: { limit, offset, hasNext: false, hasPrev: false },
          facets: { entities: {}, dateRanges: {}, statuses: {} },
          searchTime: Date.now() - startTime,
          suggestions: []
        };
      }

      // Send to RABTUL Search Service
      const rabtulResponse = await this.sendToRABTUL(query, {
        ...options,
        hotelId: hotelId ? hotelId.toString() : undefined,
      });

      // Transform RABTUL response to expected format
      const results = (rabtulResponse.results || []).map(result => ({
        type: result.type || 'unknown',
        id: result.id,
        title: result.title,
        subtitle: result.subtitle,
        content: result.content,
        metadata: result.metadata || {},
        relevanceScore: result.relevanceScore || 0,
        entity: result.entity,
      }));

      return {
        query,
        total: rabtulResponse.total || results.length,
        results,
        pagination: {
          limit,
          offset,
          hasNext: rabtulResponse.pagination?.hasNext || results.length >= limit,
          hasPrev: offset > 0
        },
        facets: rabtulResponse.facets || { entities: {}, dateRanges: {}, statuses: {} },
        searchTime: Date.now() - startTime,
        suggestions: rabtulResponse.suggestions || []
      };

    } catch (error) {
      logger.error('Search service error:', error);
      throw error;
    }
  }

  async getSearchSuggestions(query, limit = 10) {
    try {
      if (!query || query.trim().length < 2) {
        return [];
      }

      const internalToken = process.env.INTERNAL_SERVICE_TOKEN || '';

      const response = await fetch(`${SEARCH_SERVICE_URL}/api/search/suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Token': internalToken,
        },
        body: JSON.stringify({ query, limit }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Search suggestions error:', errorText);
        return [];
      }

      const result = await response.json();
      return result.suggestions || [];

    } catch (error) {
      logger.error('Search suggestions error:', error);
      return [];
    }
  }

  async saveSearchHistory(userId, query, resultCount) {
    try {
      // Log the search - RABTUL handles persistence
      logger.info(`Search by user ${userId}: "${query}" returned ${resultCount} results`);

    } catch (error) {
      logger.error('Save search history error:', error);
    }
  }

  // Helper method to calculate relevance score
  calculateRelevance(query, entity) {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Exact matches get highest score
    Object.values(entity).forEach(value => {
      if (typeof value === 'string' && value.toLowerCase() === queryLower) {
        score += 100;
      } else if (typeof value === 'string' && value.toLowerCase().includes(queryLower)) {
        score += 50;
      }
    });

    // Check nested objects for matches
    if (entity.guestDetails) {
      const fullName = `${entity.guestDetails.firstName || ''} ${entity.guestDetails.lastName || ''}`.toLowerCase();
      if (fullName.includes(queryLower)) {
        score += 75;
      }
    }

    if (entity.profile) {
      const fullName = `${entity.profile.firstName || ''} ${entity.profile.lastName || ''}`.toLowerCase();
      if (fullName.includes(queryLower)) {
        score += 75;
      }
    }

    return score;
  }

  // Helper method to calculate facets for search results
  calculateFacets(results) {
    const facets = {
      entities: {},
      dateRanges: {},
      statuses: {}
    };

    results.forEach(result => {
      // Entity type facets
      facets.entities[result.type] = (facets.entities[result.type] || 0) + 1;

      // Status facets
      if (result.metadata?.status) {
        facets.statuses[result.metadata.status] = (facets.statuses[result.metadata.status] || 0) + 1;
      }

      // Date range facets (for bookings)
      if (result.metadata?.checkIn) {
        const month = new Date(result.metadata.checkIn).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        facets.dateRanges[month] = (facets.dateRanges[month] || 0) + 1;
      }
    });

    return facets;
  }
}

export default SearchService;
