import Notification from '../models/Notification.js';

/**
 * Ensures persisted notification.type is valid for the Notification schema (fallback: system_alert).
 */
export function coerceDbNotificationType(type) {
  const allowed = Notification.schema.path('type')?.enumValues || [];
  return type && allowed.includes(type) ? type : 'system_alert';
}
