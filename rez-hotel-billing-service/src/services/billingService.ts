/**
 * Billing Service
 */

import { randomUUID } from 'crypto';
import { Folio, IFolio } from '../models/folio';
import { Invoice, IInvoice } from '../models/invoice';

const TAX_RATE = 0.18; // 18% GST

function generateFolioNumber(): string {
  // SECURITY: Use crypto.randomUUID() instead of Math.random() for cryptographically secure IDs
  return `FOL-${Date.now().toString(36).toUpperCase()}-${randomUUID().substring(0, 3).toUpperCase()}`;
}

function generateInvoiceNumber(): string {
  return `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now().toString(36).toUpperCase()}`;
}

function calculateTotals(folio: IFolio): { subtotal: number; taxes: number; total: number; balanceDue: number } {
  const subtotal = folio.items.reduce((sum, item) => sum + (item.amount * item.quantity), 0);
  const taxes = subtotal * TAX_RATE;
  const total = subtotal + taxes - (folio.discounts || 0);
  const paymentsTotal = folio.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = total - paymentsTotal;
  return { subtotal, taxes, total, balanceDue };
}

// Folio operations
export async function createFolio(params: {
  hotelId: string;
  guestId: string;
  bookingId: string;
}): Promise<IFolio> {
  const folio = new Folio({
    ...params,
    folioNumber: generateFolioNumber(),
    items: [],
    subtotal: 0,
    taxes: 0,
    total: 0,
    balanceDue: 0,
  });
  await folio.save();
  return folio;
}

export async function addFolioItem(params: {
  folioId: string;
  type: IFolio['items'][0]['type'];
  description: string;
  amount: number;
  quantity?: number;
  postedBy?: string;
}): Promise<IFolio | null> {
  const folio = await Folio.findById(params.folioId);
  if (!folio) return null;

  folio.items.push({
    type: params.type,
    description: params.description,
    amount: params.amount,
    quantity: params.quantity || 1,
    date: new Date(),
    postedBy: params.postedBy,
  });

  const { subtotal, taxes, total, balanceDue } = calculateTotals(folio);
  folio.subtotal = subtotal;
  folio.taxes = taxes;
  folio.total = total;
  folio.balanceDue = balanceDue;

  await folio.save();
  return folio;
}

export async function addPayment(params: {
  folioId: string;
  method: 'cash' | 'card' | 'upi' | 'bank_transfer';
  amount: number;
  reference?: string;
  processedBy?: string;
}): Promise<IFolio | null> {
  const folio = await Folio.findById(params.folioId);
  if (!folio) return null;

  folio.payments.push({
    method: params.method,
    amount: params.amount,
    reference: params.reference,
    date: new Date(),
    processedBy: params.processedBy,
  });

  const { subtotal, taxes, total, balanceDue } = calculateTotals(folio);
  folio.subtotal = subtotal;
  folio.taxes = taxes;
  folio.total = total;
  folio.balanceDue = balanceDue;

  await folio.save();
  return folio;
}

export async function closeFolio(folioId: string): Promise<IFolio | null> {
  return Folio.findByIdAndUpdate(
    folioId,
    { status: 'closed', closedAt: new Date() },
    { new: true }
  );
}

export async function getFolio(folioId: string): Promise<IFolio | null> {
  return Folio.findById(folioId);
}

export async function getGuestFolios(guestId: string): Promise<IFolio[]> {
  return Folio.find({ guestId }).sort({ createdAt: -1 });
}

// Invoice operations
export async function createInvoice(params: {
  hotelId: string;
  guestId: string;
  folioId: string;
  guestName: string;
  guestEmail?: string;
  guestAddress?: string;
}): Promise<IInvoice> {
  const folio = await Folio.findById(params.folioId);
  if (!folio) throw new Error('Folio not found');

  const invoice = new Invoice({
    ...params,
    invoiceNumber: generateInvoiceNumber(),
    items: folio.items.map(item => ({
      description: item.description,
      amount: item.amount * item.quantity,
    })),
    subtotal: folio.subtotal,
    taxTotal: folio.taxes,
    discountTotal: folio.discounts || 0,
    total: folio.total,
    amountPaid: folio.total - folio.balanceDue,
    balanceDue: folio.balanceDue,
    status: 'draft',
    issuedAt: new Date(),
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  await invoice.save();
  return invoice;
}

export async function markInvoicePaid(params: {
  invoiceId: string;
  paymentMethod: string;
  paymentReference?: string;
}): Promise<IInvoice | null> {
  return Invoice.findByIdAndUpdate(
    params.invoiceId,
    {
      status: 'paid',
      paidAt: new Date(),
      paymentMethod: params.paymentMethod,
      paymentReference: params.paymentReference,
      amountPaid: (await Invoice.findById(params.invoiceId))?.total || 0,
      balanceDue: 0,
    },
    { new: true }
  );
}

export async function issueInvoice(invoiceId: string): Promise<IInvoice | null> {
  return Invoice.findByIdAndUpdate(invoiceId, { status: 'issued' }, { new: true });
}

export async function getInvoice(invoiceId: string): Promise<IInvoice | null> {
  return Invoice.findById(invoiceId);
}

export async function getGuestInvoices(guestId: string): Promise<IInvoice[]> {
  return Invoice.find({ guestId }).sort({ createdAt: -1 });
}
