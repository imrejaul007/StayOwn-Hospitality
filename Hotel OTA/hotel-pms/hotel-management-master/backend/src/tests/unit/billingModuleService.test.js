import billingService from '../../modules/billing/service.js';
import billingRepository from '../../modules/billing/repository.js';

describe('billing module service', () => {
  const originalReconcileEnv = process.env.BILLING_RECONCILIATION_ENFORCE;

  afterEach(() => {
    process.env.BILLING_RECONCILIATION_ENFORCE = originalReconcileEnv;
    jest.restoreAllMocks();
  });

  it('rejects invalid invoice status transition', async () => {
    jest.spyOn(billingRepository, 'findInvoiceByIdLean').mockResolvedValue({
      _id: 'inv-1',
      hotelId: 'hotel-1',
      status: 'draft'
    });

    await expect(
      billingService.updateInvoice({
        invoiceId: 'inv-1',
        body: { status: 'paid' },
        user: { role: 'admin', _id: 'u1' }
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows valid invoice status transition', async () => {
    jest.spyOn(billingRepository, 'findInvoiceByIdLean').mockResolvedValue({
      _id: 'inv-2',
      hotelId: 'hotel-1',
      status: 'draft'
    });
    jest.spyOn(billingRepository, 'findOneAndUpdateInvoice').mockResolvedValue({
      _id: 'inv-2',
      hotelId: 'hotel-1',
      bookingId: 'b1',
      currency: 'INR',
      totalAmount: 1000,
      status: 'issued'
    });

    const invoice = await billingService.updateInvoice({
      invoiceId: 'inv-2',
      body: { status: 'issued' },
      user: { role: 'admin', _id: 'u1' }
    });

    expect(invoice.status).toBe('issued');
  });

  it('adds reconciliation metadata when invoice payment is recorded', async () => {
    const appendBillingEventSpy = jest
      .spyOn(billingRepository, 'appendBillingEvent')
      .mockResolvedValue({});
    jest.spyOn(billingRepository, 'sumInvoiceEventAmounts').mockResolvedValue(250);

    const invoice = {
      _id: 'inv-3',
      hotelId: 'hotel-1',
      bookingId: 'booking-1',
      amountRemaining: 500,
      amountPaid: 300,
      currency: 'INR',
      addPayment: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined)
    };
    jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue(invoice);

    await billingService.addInvoicePayment({
      invoiceId: 'inv-3',
      amount: 50,
      method: 'cash',
      transactionId: 'tx-1',
      notes: 'frontdesk payment',
      user: { _id: 'u1', role: 'admin' }
    });

    expect(appendBillingEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'INVOICE_PAYMENT_ADDED',
        metadata: expect.objectContaining({
          reconciliation: expect.objectContaining({
            expectedAmountPaid: 300,
            actualAmountPaid: 300,
            isAligned: true,
            policyMode: 'observe'
          })
        })
      })
    );
  });

  it('blocks mismatched reconciliation when strict mode is enabled', async () => {
    process.env.BILLING_RECONCILIATION_ENFORCE = 'true';

    jest.spyOn(billingRepository, 'sumInvoiceEventAmounts').mockResolvedValue(500);
    jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue({
      _id: 'inv-4',
      hotelId: 'hotel-1',
      bookingId: 'booking-1',
      amountRemaining: 1000,
      amountPaid: 300,
      currency: 'INR',
      addPayment: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined)
    });

    await expect(
      billingService.addInvoicePayment({
        invoiceId: 'inv-4',
        amount: 50,
        method: 'cash',
        transactionId: 'tx-2',
        notes: 'strict mode mismatch test',
        user: { _id: 'u1', role: 'admin' }
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('records reconciliation mismatch event in observe mode', async () => {
    const appendBillingEventSpy = jest
      .spyOn(billingRepository, 'appendBillingEvent')
      .mockResolvedValue({});

    jest.spyOn(billingRepository, 'sumInvoiceEventAmounts').mockResolvedValue(500);
    jest.spyOn(billingRepository, 'findInvoiceById').mockResolvedValue({
      _id: 'inv-5',
      hotelId: 'hotel-1',
      bookingId: 'booking-1',
      amountRemaining: 1000,
      amountPaid: 300,
      currency: 'INR',
      addPayment: jest.fn().mockResolvedValue(undefined),
      populate: jest.fn().mockResolvedValue(undefined)
    });

    await billingService.addInvoicePayment({
      invoiceId: 'inv-5',
      amount: 50,
      method: 'cash',
      transactionId: 'tx-3',
      notes: 'observe mode mismatch test',
      user: { _id: 'u1', role: 'admin' }
    });

    expect(appendBillingEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'BILLING_RECONCILIATION_MISMATCH'
      })
    );
  });
});
