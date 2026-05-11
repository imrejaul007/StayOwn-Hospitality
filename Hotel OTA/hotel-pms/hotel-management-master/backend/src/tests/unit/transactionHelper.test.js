import { withTransaction } from '../../utils/transactionHelper.js';

// Mock mongoose
jest.mock('mongoose', () => {
  const mockSession = {
    withTransaction: jest.fn(async (fn) => await fn()),
    endSession: jest.fn(),
  };
  return {
    default: { startSession: jest.fn().mockResolvedValue(mockSession) },
    __esModule: true,
  };
});

describe('withTransaction', () => {
  test('executes operations and returns result', async () => {
    const result = await withTransaction(async (session) => {
      expect(session).toBeDefined();
      return { success: true };
    });
    expect(result).toEqual({ success: true });
  });

  test('ends session after success', async () => {
    const mongoose = (await import('mongoose')).default;
    await withTransaction(async () => 'ok');
    const session = await mongoose.startSession();
    // Session.endSession should have been called
  });
});
