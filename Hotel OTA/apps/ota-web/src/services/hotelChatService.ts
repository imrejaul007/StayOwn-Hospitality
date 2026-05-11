const SUPPORT_COPILOT_URL = process.env.NEXT_PUBLIC_SUPPORT_COPILOT_URL || 'https://REZ-support-copilot.onrender.com';

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai' | 'agent';
  timestamp: Date;
}

export async function sendHotelChat(
  hotelId: string,
  userId: string,
  message: string,
  type: 'room_service' | 'concierge' | 'general' = 'general'
): Promise<ChatMessage> {
  const response = await fetch(`${SUPPORT_COPILOT_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchantId: hotelId,
      userId,
      message,
      type,
      context: { hotelService: type }
    })
  });
  return response.json();
}

export async function getHotelKnowledge(hotelId: string) {
  const response = await fetch(`${SUPPORT_COPILOT_URL}/api/merchant/${hotelId}`);
  return response.json();
}
