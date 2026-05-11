import { api } from './api';

export interface CheckedInBooking {
  _id: string;
  bookingNumber: string;
  guest: {
    name: string;
    email: string;
    phone: string;
  };
  room: {
    number: string;
    type: string;
  };
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  checkoutInventory: {
    status: string;
    paymentStatus: string;
  } | null;
  canBypassCheckout: boolean;
}

export interface AdminBypassRequest {
  bookingId: string;
  notes: string;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer';
}

export interface AdminBypassResponse {
  booking: {
    id: string;
    bookingNumber: string;
    guest: string;
    room: string;
    status: string;
    checkedOut: string;
  };
  checkoutInventory: {
    id: string;
    totalAmount: number;
    paymentMethod: string;
    notes: string;
    isAdminBypass: boolean;
  };
}

class AdminBypassService {
  async getCheckedInBookings() {
    try {
      const response = await api.get('/admin-dashboard/checked-in-bookings');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bypassCheckout(data: AdminBypassRequest) {
    try {
      const response = await api.post('/admin-dashboard/bypass-checkout', data);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const adminBypassService = new AdminBypassService();