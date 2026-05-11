import axios from 'axios';

const SUPPORT_COPILOT_URL = 'https://REZ-support-copilot.onrender.com';

export interface HotelChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'agent';
  timestamp: Date;
}

export class HotelChatService {
  async sendMessage(
    hotelId: string,
    userId: string,
    message: string,
    type: 'room_service' | 'concierge' | 'general' = 'general'
  ): Promise<HotelChatMessage> {
    const response = await axios.post(`${SUPPORT_COPILOT_URL}/api/chat`, {
      merchantId: hotelId,
      userId,
      message,
      type,
      context: { hotelService: type }
    });
    return response.data;
  }

  async getHotelInfo(hotelId: string): Promise<any> {
    const response = await axios.get(`${SUPPORT_COPILOT_URL}/api/merchant/${hotelId}`);
    return response.data;
  }
}

export const hotelChatService = new HotelChatService();
