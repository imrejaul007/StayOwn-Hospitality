/**
 * Google Hotel Ads Integration
 *
 * Features:
 * - Product feed generation (hotels.xml)
 * - Click tracking webhook
 * - Conversion tracking
 * - Bid management (placeholder for future)
 */

import { DEMO_PROPERTIES } from '../config/demo-data';

interface HotelProduct {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  image: string;
  price: number;
  currency: string;
  rating: number;
  amenities: string[];
  reviewCount: number;
}

interface ClickData {
  source: string;
  hotelId: string;
  gclid: string;
  userId?: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
  timestamp: Date;
}

class GoogleHotelAdsService {
  private merchantId: string;
  private developerId: string;

  constructor() {
    this.merchantId = process.env.GOOGLE_MERCHANT_ID || '';
    this.developerId = process.env.GOOGLE_DEVELOPER_ID || '';
  }

  /**
   * Generate Google Hotels Product Feed (XML format)
   * This is served at /feeds/hotels.xml for Google to crawl
   */
  async generateProductFeed(): Promise<string> {
    const hotels = await this.getActiveHotels();

    const xmlItems = hotels.map(hotel => `
    <Item id="${hotel.id}">
      <name>${this.escapeXml(hotel.name)}</name>
      <description>${this.escapeXml(hotel.description)}</description>
      <address>
        <component name="street_address">${this.escapeXml(hotel.address)}</component>
        <component name="city">${this.escapeXml(hotel.city)}</component>
        <component name="country">${hotel.country}</component>
      </address>
      <image>${hotel.image}</image>
      <price currency="${hotel.currency}">${hotel.price}</price>
      <rating>${hotel.rating}</rating>
      <amenity>${hotel.amenities.join('</amenity><amenity>')}</amenity>
    </Item>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<MerchantCenter>
  <Item>${xmlItems}
  </Item>
</MerchantCenter>`;
  }

  /**
   * Generate inline data for Google Hotel Ads
   * Used for dynamic hotel listings
   */
  async generateInlineData(): Promise<object> {
    const hotels = await this.getActiveHotels();

    return {
      '@context': 'https://schema.org',
      '@type': 'Hotel',
      '@id': 'https://rez.money',
      name: 'REZ Hotels',
      description: 'Book hotels with REZ - Best prices guaranteed',
      url: 'https://rez.money/hotels',
      hotel: hotels.map(h => ({
        '@type': 'Hotel',
        '@id': `https://rez.money/hotel/${h.id}`,
        name: h.name,
        address: {
          '@type': 'PostalAddress',
          streetAddress: h.address,
          addressLocality: h.city,
          addressCountry: h.country
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: h.rating,
          reviewCount: h.reviewCount
        },
        image: h.image,
        priceRange: `₹${h.price}`
      }))
    };
  }

  /**
   * Handle click tracking from Google
   * POST /webhooks/google-hotel-ads/click
   */
  async trackClick(data: {
    hotel_id: string;
    gclid: string;
    user_id?: string;
    check_in?: string;
    check_out?: string;
    guests: number;
  }): Promise<void> {
    // Store click data for analytics
    // Update hotel's Google Ads metrics
    console.log('[GoogleHotelAds] Click tracked:', data);

    // Store in analytics
    await this.storeClickData({
      source: 'google_hotel_ads',
      hotelId: data.hotel_id,
      gclid: data.gclid,
      userId: data.user_id,
      checkIn: data.check_in,
      checkOut: data.check_out,
      guests: data.guests,
      timestamp: new Date()
    });
  }

  /**
   * Handle booking confirmation from Google
   * POST /webhooks/google-hotel-ads/conversion
   */
  async trackConversion(data: {
    hotel_id: string;
    gclid: string;
    booking_id: string;
    value: number;
    currency: string;
  }): Promise<void> {
    console.log('[GoogleHotelAds] Conversion tracked:', data);

    // Send to Google Ads conversion tracking
    // For now, just log it
    // In production, send to Google Ads API
  }

  private async getActiveHotels(): Promise<HotelProduct[]> {
    // Return DEMO_PROPERTIES formatted for Google
    return DEMO_PROPERTIES.map(p => ({
      id: p.propertyId,
      name: p.name,
      description: p.description,
      address: p.address.line1,
      city: p.address.city,
      country: p.address.country,
      image: p.images?.[0] || 'https://rez.money/default-hotel.jpg',
      price: Math.min(...p.roomTypes.map(r => r.corporateRate)),
      currency: 'INR',
      rating: p.userRating,
      amenities: p.amenities,
      reviewCount: p.reviewCount
    }));
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private async storeClickData(data: ClickData): Promise<void> {
    // Store in analytics collection
    // In production, use proper MongoDB
    console.log('[GoogleHotelAds] Storing click:', JSON.stringify(data));
  }
}

export const googleHotelAdsService = new GoogleHotelAdsService();
