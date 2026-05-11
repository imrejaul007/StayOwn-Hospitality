/**
 * Guest Feedback Service
 *
 * Handles post-stay survey collection, service ratings, and text comments
 * for the StayOwn hotel booking platform.
 */
import mongoose from 'mongoose';
export interface ServiceRating {
    category: 'cleanliness' | 'staff' | 'amenities' | 'food' | 'location' | 'value' | 'checkin' | 'checkout';
    rating: number;
}
export interface FeedbackInput {
    bookingId: string;
    hotelId: string;
    guestId: string;
    guestName?: string;
    guestEmail?: string;
    overallRating: number;
    serviceRatings: ServiceRating[];
    textComment?: string;
    textLanguage?: 'en' | 'hi' | 'other';
    recommendLikelihood: number;
    stayType: 'business' | 'leisure' | 'family' | 'couple' | 'solo';
    roomType?: string;
    source: 'post_stay_email' | 'checkout_screen' | 'in_stay' | 'app_survey';
    deviceType?: 'ios' | 'android' | 'web';
    isAnonymous?: boolean;
}
export interface FeedbackResponse {
    success: boolean;
    feedbackId?: string;
    thankYouMessage?: string;
    error?: string;
}
export interface FeedbackDocument extends mongoose.Document {
    bookingId: string;
    hotelId: string;
    guestId: string;
    guestName?: string;
    guestEmail?: string;
    overallRating: number;
    serviceRatings: Array<{
        category: string;
        rating: number;
    }>;
    textComment?: string;
    textLanguage?: string;
    recommendLikelihood: number;
    stayType: string;
    roomType?: string;
    source: string;
    deviceType?: string;
    isAnonymous: boolean;
    submittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface AggregatedRatings {
    hotelId: string;
    period: 'all_time' | '30_days' | '7_days';
    totalReviews: number;
    averageRating: number;
    ratingDistribution: {
        1: number;
        2: number;
        3: number;
        4: number;
        5: number;
    };
    averageServiceRatings: Record<string, number>;
    npsScore: number;
    recentTrend: 'improving' | 'stable' | 'declining';
    lastUpdated: Date;
}
export interface FeedbackListItem {
    id: string;
    bookingId: string;
    guestName: string;
    overallRating: number;
    textComment?: string;
    recommendLikelihood: number;
    stayType: string;
    serviceRatings: Array<{
        category: string;
        rating: number;
    }>;
    submittedAt: Date;
    isAnonymous: boolean;
}
export declare const Feedback: mongoose.Model<any, {}, {}, {}, any, any, any>;
/**
 * Submit guest feedback
 */
export declare function submitFeedback(input: FeedbackInput): Promise<FeedbackResponse>;
/**
 * Get feedback for a specific booking
 */
export declare function getFeedbackByBookingId(bookingId: string): Promise<FeedbackDocument | null>;
/**
 * Get aggregated ratings for a hotel
 */
export declare function getHotelRatings(hotelId: string, period?: 'all_time' | '30_days' | '7_days'): Promise<AggregatedRatings>;
/**
 * Get paginated feedback list for a hotel
 */
export declare function getHotelFeedbackList(hotelId: string, options?: {
    page?: number;
    limit?: number;
    minRating?: number;
    sortBy?: 'recent' | 'rating_high' | 'rating_low';
}): Promise<{
    feedback: FeedbackListItem[];
    total: number;
    page: number;
    totalPages: number;
}>;
/**
 * Get feedback response rate for a hotel
 */
export declare function getFeedbackResponseRate(hotelId: string, totalBookings30Days: number): Promise<{
    totalBookings: number;
    totalFeedback: number;
    responseRate: number;
}>;
/**
 * Delete feedback (admin function)
 */
export declare function deleteFeedback(feedbackId: string): Promise<boolean>;
export declare const feedbackService: {
    submitFeedback: typeof submitFeedback;
    getFeedbackByBookingId: typeof getFeedbackByBookingId;
    getHotelRatings: typeof getHotelRatings;
    getHotelFeedbackList: typeof getHotelFeedbackList;
    getFeedbackResponseRate: typeof getFeedbackResponseRate;
    deleteFeedback: typeof deleteFeedback;
};
export default feedbackService;
//# sourceMappingURL=feedback-service.d.ts.map