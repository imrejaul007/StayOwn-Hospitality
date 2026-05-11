/**
 * Normalize Mongo/API id values (string, number, { _id }, { $oid }) for URLs and path params.
 * Returns undefined for empty input or plain objects that stringify to "[object Object]".
 */
export function toEntityIdString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '' || t === '[object Object]') return undefined;
    return t;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.$oid === 'string') return o.$oid;
    if (o._id != null) return toEntityIdString(o._id);
  }
  return undefined;
}
