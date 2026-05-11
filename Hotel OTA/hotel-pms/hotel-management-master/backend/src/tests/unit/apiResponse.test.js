const { sendSuccess, sendPaginated, sendError, ApiResponse } = (() => {
  const mod = require('../../utils/apiResponse.js');
  return {
    sendSuccess: mod.sendSuccess,
    sendPaginated: mod.sendPaginated,
    sendError: mod.sendError,
    ApiResponse: mod.ApiResponse || mod.default,
  };
})();

describe('ApiResponse class', () => {
  test('sets success true for 2xx status', () => {
    const r = new ApiResponse(200, { id: 1 }, 'OK');
    expect(r.success).toBe(true);
    expect(r.statusCode).toBe(200);
    expect(r.data).toEqual({ id: 1 });
  });

  test('sets success false for 4xx status', () => {
    const r = new ApiResponse(404, null, 'Not found');
    expect(r.success).toBe(false);
  });
});

describe('sendSuccess', () => {
  let res;
  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  test('returns 200 with data envelope', () => {
    sendSuccess(res, { id: 1 });
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('success');
    expect(body.data).toEqual({ id: 1 });
  });

  test('accepts custom status code and message', () => {
    sendSuccess(res, { id: 1 }, 201, 'Created');
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Created');
  });
});

describe('sendPaginated', () => {
  let res;
  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  test('includes pagination metadata', () => {
    const pagination = { currentPage: 1, totalPages: 3, totalCount: 25, limit: 10, hasNextPage: true, hasPrevPage: false };
    sendPaginated(res, [1, 2, 3], pagination);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('success');
    expect(body.results).toBe(3);
    expect(body.pagination.totalPages).toBe(3);
    expect(body.pagination.hasNextPage).toBe(true);
  });
});

describe('sendError', () => {
  let res;
  beforeEach(() => {
    res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  });

  test('returns structured error', () => {
    sendError(res, 500, 'INTERNAL_ERROR', 'Something failed');
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('error');
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('Something failed');
  });

  test('400 bad request', () => {
    sendError(res, 400, 'VALIDATION_ERROR', 'Invalid input');
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('includes details when provided', () => {
    sendError(res, 422, 'VALIDATION_ERROR', 'Bad fields', { fields: ['email'] });
    const body = res.json.mock.calls[0][0];
    expect(body.error.details).toEqual({ fields: ['email'] });
  });
});
