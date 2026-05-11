import { api } from '../services/api';

interface BatchRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

class APIBatcher {
  private queue: BatchRequest[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 50; // milliseconds

  /**
   * Add a request to the batch queue
   */
  addRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: unknown
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: `${Date.now()}-${Math.random()}`,
        endpoint,
        method,
        data,
        resolve,
        reject
      };

      this.queue.push(request);

      // Schedule batch processing
      this.scheduleBatch();
    });
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Process immediately if batch is full, otherwise wait for delay
    if (this.queue.length >= this.BATCH_SIZE) {
      this.processBatch();
    } else {
      this.batchTimeout = setTimeout(() => {
        this.processBatch();
      }, this.BATCH_DELAY);
    }
  }

  /**
   * Process the current batch of requests
   */
  private async processBatch() {
    if (this.queue.length === 0) return;

    const currentBatch = this.queue.splice(0, this.BATCH_SIZE);
    this.batchTimeout = null;

    // Group requests by method and endpoint for optimization
    const groupedRequests = this.groupRequests(currentBatch);

    try {
      await Promise.all(
        Object.entries(groupedRequests).map(([key, requests]) =>
          this.processBatchGroup(key, requests)
        )
      );
    } catch {
      // Error handled silently
    }
  }

  /**
   * Group requests by method and base endpoint
   */
  private groupRequests(requests: BatchRequest[]): Record<string, BatchRequest[]> {
    return requests.reduce((groups, request) => {
      const key = `${request.method}:${request.endpoint.split('?')[0]}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(request);
      return groups;
    }, {} as Record<string, BatchRequest[]>);
  }

  /**
   * Process a group of similar requests
   */
  private async processBatchGroup(groupKey: string, requests: BatchRequest[]) {
    const [method, baseEndpoint] = groupKey.split(':');

    if (method === 'GET' && requests.length > 1) {
      // For GET requests, try to batch them into a single request if possible
      await this.processBatchedGETRequests(baseEndpoint, requests);
    } else {
      // Process other requests individually
      await Promise.all(
        requests.map(request => this.processIndividualRequest(request))
      );
    }
  }

  /**
   * Process batched GET requests
   */
  private async processBatchedGETRequests(baseEndpoint: string, requests: BatchRequest[]) {
    // Extract unique query parameters
    const queryParams = new Set<string>();
    const requestMap = new Map<string, BatchRequest>();

    requests.forEach(request => {
      const url = new URL(request.endpoint, window.location.origin);
      const queryString = url.search;
      queryParams.add(queryString);
      requestMap.set(queryString, request);
    });

    // If all requests have the same query params, batch them
    if (queryParams.size === 1) {
      try {
        const { data } = await api.get(baseEndpoint + Array.from(queryParams)[0]);

        requests.forEach(request => {
          request.resolve(data);
        });
      } catch (error) {
        requests.forEach(request => {
          request.reject(error);
        });
      }
    } else {
      // Process individually if queries are different
      await Promise.all(
        requests.map(request => this.processIndividualRequest(request))
      );
    }
  }

  /**
   * Process an individual request
   */
  private async processIndividualRequest(request: BatchRequest) {
    try {
      let response;

      switch (request.method) {
        case 'POST':
          response = await api.post(request.endpoint, request.data);
          break;
        case 'PUT':
          response = await api.put(request.endpoint, request.data);
          break;
        case 'DELETE':
          response = await api.delete(request.endpoint);
          break;
        default:
          response = await api.get(request.endpoint);
          break;
      }

      request.resolve(response.data);
    } catch (error: unknown) {
      request.reject(error);
    }
  }

  /**
   * Clear the current queue (useful for cleanup)
   */
  clearQueue() {
    this.queue.forEach(request => {
      request.reject(new Error('Request cancelled'));
    });
    this.queue = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }
}

// Create a singleton instance
export const apiBatcher = new APIBatcher();

/**
 * Utility function to add a request to the batch queue
 */
export function batchedApiCall(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: unknown
): Promise<unknown> {
  return apiBatcher.addRequest(endpoint, method, data);
}

/**
 * Clear all pending batched requests
 */
export function clearBatchQueue() {
  apiBatcher.clearQueue();
}