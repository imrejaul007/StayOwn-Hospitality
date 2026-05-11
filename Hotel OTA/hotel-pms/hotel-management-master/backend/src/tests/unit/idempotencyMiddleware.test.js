jest.mock('../../config/redis.js', () => ({
  getRedisClient: jest.fn(() => null),
  isRedisConnected: jest.fn(() => false)
}));

import { enforceIdempotency } from '../../middleware/idempotency.js';

const createReq = (idempotencyKey) => ({
  method: 'POST',
  baseUrl: '/api/v1/payments',
  path: '/confirm',
  headers: {
    'idempotency-key': idempotencyKey
  },
  user: {
    _id: 'user-1'
  }
});

const createRes = () => {
  const handlers = {};
  const res = {
    statusCode: 200,
    setHeader: jest.fn(),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    on: jest.fn((event, cb) => {
      handlers[event] = cb;
      return res;
    }),
    _emit: (event) => {
      if (handlers[event]) handlers[event]();
    },
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    })
  };
  return res;
};

describe('enforceIdempotency middleware', () => {
  it('returns 400 when idempotency key is missing', async () => {
    const middleware = enforceIdempotency({ namespace: 'test-missing-key' });
    const req = createReq('');
    req.headers = {};
    const res = createRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.statusCode).toBe(400);
  });

  it('replays completed response for duplicate key', async () => {
    const middleware = enforceIdempotency({ namespace: 'test-replay' });
    const key = `key-${Date.now()}`;

    const req1 = createReq(key);
    const res1 = createRes();
    const next1 = jest.fn();
    await middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledWith();

    res1.statusCode = 201;
    res1.json({ success: true, paymentIntentId: 'pi_123' });

    const req2 = createReq(key);
    const res2 = createRes();
    const next2 = jest.fn();
    await middleware(req2, res2, next2);

    expect(res2.setHeader).toHaveBeenCalledWith('X-Idempotency-Replayed', 'true');
    expect(res2.status).toHaveBeenCalledWith(201);
    expect(res2.json).toHaveBeenCalledWith({ success: true, paymentIntentId: 'pi_123' });
    expect(next2).not.toHaveBeenCalled();
  });

  it('returns 409 while original request is still processing', async () => {
    const middleware = enforceIdempotency({ namespace: 'test-processing' });
    const key = `processing-${Date.now()}`;

    const req1 = createReq(key);
    const res1 = createRes();
    const next1 = jest.fn();
    await middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledWith();

    const req2 = createReq(key);
    const res2 = createRes();
    const next2 = jest.fn();
    await middleware(req2, res2, next2);

    expect(next2).toHaveBeenCalledTimes(1);
    const error = next2.mock.calls[0][0];
    expect(error.statusCode).toBe(409);
  });

  it('clears processing lock on finish without json body', async () => {
    const middleware = enforceIdempotency({ namespace: 'test-finish-clear' });
    const key = `finish-${Date.now()}`;

    const req1 = createReq(key);
    const res1 = createRes();
    const next1 = jest.fn();
    await middleware(req1, res1, next1);
    expect(next1).toHaveBeenCalledWith();

    // Simulate handler throwing and framework finishing response.
    res1._emit('finish');

    const req2 = createReq(key);
    const res2 = createRes();
    const next2 = jest.fn();
    await middleware(req2, res2, next2);

    // If lock is cleared on finish, second request can proceed.
    expect(next2).toHaveBeenCalledWith();
  });
});
