import { apiVersioning } from '../../middleware/apiVersioning.js';

const createRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
  setHeader(name, value) {
    this.headers[name] = value;
  }
});

describe('apiVersioning middleware', () => {
  it('routes non-versioned api path to v1', () => {
    const req = { url: '/bookings' };
    const res = createRes();
    const next = jest.fn();

    apiVersioning(req, res, next);

    expect(req.url).toBe('/v1/bookings');
    expect(req.apiVersion).toBe('v1');
    expect(next).toHaveBeenCalledWith();
  });

  it('maps v2 requests to v1 in compatibility mode', () => {
    const req = { url: '/v2/bookings' };
    const res = createRes();
    const next = jest.fn();

    apiVersioning(req, res, next);

    expect(req.url).toBe('/v1/bookings');
    expect(req.apiVersion).toBe('v1');
    expect(res.headers['x-api-version-status']).toBe('compatibility-mode');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unsupported versions', () => {
    const req = { url: '/v9/bookings' };
    const res = createRes();
    const next = jest.fn();

    apiVersioning(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body?.status).toBe('error');
    expect(next).not.toHaveBeenCalled();
  });
});
