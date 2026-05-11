const INTENT_CAPTURE_URL = process.env.INTENT_CAPTURE_URL || 'https://rez-intent-graph.onrender.com';
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const EVENT_TO_INTENT_MAP: Record<string, { eventType: string; category: string; confidence: number }> = {
  room_qr_scan: { eventType: 'view', category: 'HOTEL_SERVICE', confidence: 0.25 },
  room_service_interest: { eventType: 'search', category: 'HOTEL_SERVICE', confidence: 0.15 },
  service_request_created: { eventType: 'search', category: 'HOTEL_SERVICE', confidence: 0.15 },
  staff_assigned: { eventType: 'view', category: 'HOTEL_SERVICE', confidence: 0.25 },
  request_completed: { eventType: 'fulfilled', category: 'HOTEL_SERVICE', confidence: 1.0 },
};

export async function captureIntent(params: {
  userId: string;
  eventType: string;
  category: string;
  intentKey: string;
  metadata?: Record<string, unknown>;
  appType: string;
}): Promise<void> {
  if (!INTENT_CAPTURE_URL) return;
  try {
    await fetch(`${INTENT_CAPTURE_URL}/api/intent/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': INTERNAL_SERVICE_TOKEN,
      },
      body: JSON.stringify({
        userId: params.userId,
        appType: params.appType,
        eventType: params.eventType,
        category: params.category,
        intentKey: params.intentKey,
        metadata: params.metadata,
      }),
    });
  } catch {
    // Never throw
  }
}

export function track(params: {
  userId: string;
  event: string;
  appType: string;
  intentKey: string;
  properties?: Record<string, unknown>;
}): void {
  const config = EVENT_TO_INTENT_MAP[params.event];
  if (!config || !params.userId) return;
  captureIntent({
    userId: params.userId,
    appType: params.appType,
    eventType: config.eventType,
    category: config.category,
    intentKey: params.intentKey,
    metadata: params.properties,
  }).catch(() => {});
}
