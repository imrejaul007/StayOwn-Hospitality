/**
 * Email Templates for Hotel Bookings
 * Marketing and transactional email templates for StayOwn
 */
export interface BookingConfirmationData {
    guestName: string;
    hotelName: string;
    roomType: string;
    checkIn: string;
    checkOut: string;
    confirmationNumber: string;
    amount: string;
    guestEmail: string;
}
export interface CheckinReminderData {
    guestName: string;
    hotelName: string;
    roomNumber: string;
    checkInTime: string;
    qrUrl: string;
    guestEmail: string;
}
export interface ReviewRequestData {
    guestName: string;
    hotelName: string;
    bookingId: string;
    reviewUrl: string;
    guestEmail: string;
}
/**
 * Booking confirmation email template
 */
export declare function generateBookingConfirmationEmail(data: BookingConfirmationData): {
    to: string;
    subject: string;
    html: string;
};
/**
 * Check-in reminder email (24h before)
 */
export declare function generateCheckinReminderEmail(data: CheckinReminderData): {
    to: string;
    subject: string;
    html: string;
};
/**
 * Review request email after checkout
 */
export declare function generateReviewRequestEmail(data: ReviewRequestData): {
    to: string;
    subject: string;
    html: string;
};
/**
 * Special offer / promotional email template
 */
export interface SpecialOfferData {
    guestName: string;
    guestEmail: string;
    hotelName: string;
    offerTitle: string;
    offerDescription: string;
    discountPercent: number;
    validUntil: string;
    bookingUrl: string;
}
export declare function generateSpecialOfferEmail(data: SpecialOfferData): {
    to: string;
    subject: string;
    html: string;
};
//# sourceMappingURL=email-templates.d.ts.map