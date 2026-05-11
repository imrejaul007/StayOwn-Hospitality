import Invoice from '../../models/Invoice.js';
import invoiceLifecycleSyncService from '../../services/invoiceLifecycleSyncService.js';

describe('invoice lifecycle sync service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('syncs booking payment status to fully paid invoice', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const invoice = {
      status: 'issued',
      totalAmount: 1000,
      payments: [],
      internalNotes: '',
      save
    };

    jest.spyOn(Invoice, 'findOne').mockResolvedValue(invoice);

    await invoiceLifecycleSyncService.syncBookingPaymentStatus({
      bookingId: 'booking-1',
      paymentStatus: 'paid',
      actorUserId: 'user-1'
    });

    expect(invoice.status).toBe('paid');
    expect(invoice.payments).toHaveLength(1);
    expect(save).toHaveBeenCalled();
  });

  it('marks invoices cancelled when booking cancellation has no paid balance', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const invoice = {
      status: 'issued',
      payments: [],
      internalNotes: '',
      save
    };

    jest.spyOn(Invoice, 'find').mockResolvedValue([invoice]);

    const count = await invoiceLifecycleSyncService.syncBookingCancellationInvoices({
      bookingId: 'booking-2',
      refundAmount: 0,
      reason: 'Guest requested cancellation'
    });

    expect(count).toBe(1);
    expect(invoice.status).toBe('cancelled');
    expect(save).toHaveBeenCalled();
  });

  it('creates a valid checkout invoice when none exists', async () => {
    jest.spyOn(Invoice, 'findOne').mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    const createdInvoice = { _id: 'inv-1' };
    const createSpy = jest.spyOn(Invoice, 'create').mockResolvedValue(createdInvoice);

    const result = await invoiceLifecycleSyncService.ensureCheckoutInvoice({
      booking: {
        _id: 'booking-3',
        hotelId: 'hotel-1',
        userId: 'guest-1',
        paymentStatus: 'pending',
        nights: 2,
        totalAmount: 2000,
        currency: 'INR',
        bookingNumber: 'BKG-100'
      }
    });

    expect(result.created).toBe(true);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'booking-3',
      type: 'accommodation',
      items: [
        expect.objectContaining({
          category: 'accommodation',
          quantity: 2,
          totalPrice: 2000,
          taxRate: 0
        })
      ]
    }));
  });
});
