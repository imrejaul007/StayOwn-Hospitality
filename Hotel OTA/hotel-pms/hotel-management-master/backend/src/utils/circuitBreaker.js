/**
 * CircuitBreaker - Prevents cascading failures when external services are down.
 *
 * States:
 *   CLOSED  → Normal operation, requests pass through
 *   OPEN    → Service is down, requests fail immediately (fast-fail)
 *   HALF_OPEN → Testing if service recovered, allow one request through
 *
 * Usage:
 *   const stripeBreaker = new CircuitBreaker({ name: 'stripe', failureThreshold: 5, resetTimeout: 30000 });
 *   const result = await stripeBreaker.execute(() => stripe.paymentIntents.create(data));
 */
class CircuitBreaker {
  constructor({ name, failureThreshold = 5, resetTimeout = 30000, timeout = 30000 }) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.timeout = timeout;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(fn, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN`);
      } else {
        console.warn(`[CircuitBreaker:${this.name}] OPEN — fast-failing request`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker ${this.name} is OPEN. Service unavailable.`);
      }
    }

    let timeoutId = null;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`${this.name} timeout after ${this.timeout}ms`)),
          this.timeout
        );
      });
      const result = await Promise.race([fn(), timeoutPromise]);

      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure();
      if (fallback) return fallback();
      throw error;
    } finally {
      // Promise.race does not cancel the losing branch; always clear timeout handle.
      if (typeof timeoutId !== 'undefined' && timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`[CircuitBreaker:${this.name}] Recovered → CLOSED`);
    }
  }

  _onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`[CircuitBreaker:${this.name}] OPENED after ${this.failureCount} failures`);
    }
  }

  getState() {
    return { name: this.name, state: this.state, failureCount: this.failureCount, successCount: this.successCount };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

export { CircuitBreaker };
