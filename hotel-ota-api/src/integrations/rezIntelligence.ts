/**
 * REZ Intelligence Integration for Hotel OTA
 * Hospitality expert, personalization
 */
const INTELLIGENCE_URL = process.env.REZ_INTELLIGENCE_URL || 'http://localhost:4018';

export const hotelIntelligence = {
  async getPersonalization(guestId: string) {
    const res = await fetch(`${INTELLIGENCE_URL}/api/recommend/hospitality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '' },
      body: JSON.stringify({ guestId }),
    });
    return res.json();
  },
  async predictChurn(guestId: string) {
    const res = await fetch(`${INTELLIGENCE_URL}/api/predict/churn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '' },
      body: JSON.stringify({ userId: guestId }),
    });
    return res.json();
  },
  async getAmenityRecommendations(guestId: string) {
    const res = await fetch(`${INTELLIGENCE_URL}/api/recommend/amenities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.REZ_INTELLIGENCE_API_KEY || '' },
      body: JSON.stringify({ guestId }),
    });
    return res.json();
  },
};
export default hotelIntelligence;
