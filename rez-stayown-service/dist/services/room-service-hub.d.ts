/**
 * Room Service Hub Backend
 *
 * API for the Room Service Hub mobile app:
 * - Get hotel and room info
 * - Order room service
 * - Request housekeeping
 * - Concierge requests
 * - Checkout
 */
export interface RoomServiceInfo {
    hotelId: string;
    hotelName: string;
    roomId: string;
    roomNumber: string;
    services: Service[];
    amenities: string[];
    checkIn: string;
    checkOut: string;
    guestName: string;
    bookingId: string;
}
export interface Service {
    id: string;
    name: string;
    icon: string;
    description: string;
    actionType: 'food' | 'housekeeping' | 'laundry' | 'concierge' | 'checkout' | 'minibar' | 'spa' | 'transport';
    actionData?: Record<string, string>;
    estimatedTime?: string;
    priceRange?: string;
}
export interface ServiceOrderRequest {
    bookingId: string;
    hotelId: string;
    roomId: string;
    serviceType: 'food' | 'housekeeping' | 'laundry' | 'concierge' | 'minibar' | 'spa' | 'transport';
    items: ServiceItem[];
    specialInstructions?: string;
}
export interface ServiceItem {
    id: string;
    name: string;
    quantity: number;
    pricePaise: number;
}
export interface ServiceOrderResponse {
    success: boolean;
    orderId?: string;
    estimatedTime?: string;
    totalPaise?: number;
    error?: string;
}
export interface SLATrackingInfo {
    requestId: string;
    createdAt: Date;
    assignedAt?: Date;
    completedAt?: Date;
    responseTimeSeconds?: number;
    completionTimeSeconds?: number;
    slaMet?: boolean;
}
export interface ServiceRequestWithSLA {
    requestId: string;
    bookingId: string;
    hotelId: string;
    roomId: string;
    roomNumber: string;
    guestName: string;
    serviceType: string;
    status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    createdAt: Date;
    sla?: SLATrackingInfo;
}
export interface CheckoutRequest {
    bookingId: string;
    hotelId: string;
    roomId: string;
    paymentMethod?: 'upi' | 'card' | 'cash' | 'wallet';
    paymentData?: {
        upiId?: string;
        cardLast4?: string;
    };
}
export interface CheckoutResponse {
    success: boolean;
    checkoutId?: string;
    totalAmountPaise: number;
    serviceChargesPaise: number;
    roomChargesPaise: number;
    taxesPaise: number;
    balanceDuePaise: number;
    paymentLink?: string;
    error?: string;
}
export declare const roomServiceHub: {
    /**
     * Get room service info for QR scan
     */
    getRoomServiceInfo(params: {
        hotelId: string;
        roomId: string;
        token?: string;
        bookingId?: string;
    }): Promise<RoomServiceInfo | null>;
    /**
     * Order room service
     */
    orderService(request: ServiceOrderRequest): Promise<ServiceOrderResponse>;
    /**
     * Record staff assignment to a service request (for SLA tracking)
     */
    assignStaffToRequest(params: {
        requestId: string;
        staffId: string;
        staffName: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Record service completion (for SLA tracking)
     */
    completeServiceRequest(params: {
        requestId: string;
        notes?: string;
    }): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Get services menu
     */
    getServicesMenu(hotelId: string): Promise<Record<string, Service[]>>;
    /**
     * Get current charges/bill
     */
    getCurrentBill(bookingId: string): Promise<{
        charges: Array<{
            id: string;
            description: string;
            amountPaise: number;
            category: string;
            date: string;
        }>;
        subtotalPaise: number;
        taxesPaise: number;
        totalPaise: number;
    } | null>;
    /**
     * Process checkout
     */
    processCheckout(request: CheckoutRequest): Promise<CheckoutResponse>;
};
export default roomServiceHub;
//# sourceMappingURL=room-service-hub.d.ts.map