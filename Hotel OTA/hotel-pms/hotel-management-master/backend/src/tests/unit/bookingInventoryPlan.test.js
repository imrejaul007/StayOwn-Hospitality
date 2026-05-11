import mongoose from 'mongoose';
import {
  expandPlan,
  inventoryPlansEqual,
  patchTouchesInventory
} from '../../services/bookingInventoryPlan.js';

describe('bookingInventoryPlan', () => {
  it('expandPlan builds one entry per room type', () => {
    const hid = new mongoose.Types.ObjectId();
    const m = new Map([['507f1f77bcf86cd799439011', 2]]);
    const p = expandPlan(hid, new Date('2025-06-01'), new Date('2025-06-04'), m);
    expect(p).toHaveLength(1);
    expect(p[0].roomsCount).toBe(2);
    expect(String(p[0].roomTypeId)).toBe('507f1f77bcf86cd799439011');
  });

  it('inventoryPlansEqual matches equivalent plans', () => {
    const hid = new mongoose.Types.ObjectId();
    const m = new Map([['507f1f77bcf86cd799439011', 1]]);
    const a = expandPlan(hid, new Date('2025-06-01'), new Date('2025-06-03'), m);
    const b = expandPlan(hid, new Date('2025-06-01'), new Date('2025-06-03'), m);
    expect(inventoryPlansEqual(a, b)).toBe(true);
  });

  it('patchTouchesInventory detects inventory fields', () => {
    expect(patchTouchesInventory({ checkIn: '2025-01-01' })).toBe(true);
    expect(patchTouchesInventory({ rooms: [] })).toBe(true);
    expect(patchTouchesInventory({ primaryRoomTypeId: '507f1f77bcf86cd799439011' })).toBe(true);
    expect(patchTouchesInventory({ guestDetails: {} })).toBe(false);
  });
});
