import { CircuitBreaker } from '../../utils/circuitBreaker.js';

describe('CircuitBreaker', () => {
  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({ name: 'test', failureThreshold: 3, resetTimeout: 100, timeout: 500 });
  });

  test('starts in CLOSED state', () => {
    expect(breaker.getState().state).toBe('CLOSED');
  });

  test('executes function successfully in CLOSED state', async () => {
    const result = await breaker.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.getState().state).toBe('CLOSED');
  });

  test('opens after failure threshold', async () => {
    const fail = () => Promise.reject(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await breaker.execute(fail).catch(() => {});
    }
    expect(breaker.getState().state).toBe('OPEN');
  });

  test('fast-fails in OPEN state', async () => {
    // Force open
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }
    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toThrow('OPEN');
  });

  test('uses fallback in OPEN state', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }
    const result = await breaker.execute(() => Promise.resolve('ok'), () => 'fallback');
    expect(result).toBe('fallback');
  });

  test('transitions to HALF_OPEN after reset timeout', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }
    expect(breaker.getState().state).toBe('OPEN');

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150));

    const result = await breaker.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.getState().state).toBe('CLOSED');
  });

  test('reset() returns to CLOSED state', () => {
    breaker.state = 'OPEN';
    breaker.failureCount = 5;
    breaker.reset();
    expect(breaker.getState().state).toBe('CLOSED');
    expect(breaker.getState().failureCount).toBe(0);
  });

  test('times out slow operations', async () => {
    const slow = () => new Promise(r => setTimeout(() => r('slow'), 1000));
    await expect(breaker.execute(slow)).rejects.toThrow('timeout');
  });
});
