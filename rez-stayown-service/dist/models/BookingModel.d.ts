/**
 * Booking Model for StayOwn Service
 *
 * Stores hotel booking records with MongoDB persistence.
 * Replaces in-memory bookingsStore Map.
 */
import mongoose, { Document } from 'mongoose';
export interface IBooking extends Document {
    bookingId: string;
    confirmationNumber: string;
    pmsBookingId?: string;
    userId: string;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    property: {
        propertyId: string;
        name: string;
        address: string;
    };
    room: {
        roomTypeId: string;
        name: string;
        bedType: string;
    };
    guest: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
    };
    dates: {
        checkIn: string;
        checkOut: string;
        nights: number;
    };
    pricing: {
        baseRate: number;
        nights: number;
        subtotal: number;
        taxableAmount: number;
        cgstRate: number;
        cgstAmount: number;
        sgstRate: number;
        sgstAmount: number;
        totalTax: number;
        totalAmount: number;
        itcEligible: boolean;
    };
    paymentOption?: 'prepay' | 'pay_at_hotel' | 'partial';
    totalAmountPaise: number;
    upfrontAmountPaise?: number;
    payAtHotelAmountPaise?: number;
    paymentOptionDetails?: {
        description: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const Booking: mongoose.Model<IBooking, {}, {}, {}, mongoose.Document<unknown, {}, IBooking, {}, mongoose.DefaultSchemaOptions> & IBooking & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IBooking>;
//# sourceMappingURL=BookingModel.d.ts.map