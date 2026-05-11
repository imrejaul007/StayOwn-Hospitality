/**
 * Default hotel for **public** marketing pages (home reviews strip, etc.).
 * Set `VITE_PUBLIC_DEFAULT_HOTEL_ID` per deployment so the correct tenant’s reviews load.
 */
export const DEFAULT_PUBLIC_HOTEL_ID =
  (import.meta.env.VITE_PUBLIC_DEFAULT_HOTEL_ID as string | undefined)?.trim() ||
  '68cd01414419c17b5f6b4c12';
