// ✅ Currency formatter (₹ Indian Rupee, Indian number system)
export function formatCurrency(amount: number, currency = 'INR'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(safeAmount);
}

/**
 * Coerce API values (ISO strings, Date, Mongo extended JSON `{ $date }`, timestamps) to a valid Date or null.
 */
function toDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.$date === 'string' || typeof o.$date === 'number') {
      const d = new Date(o.$date);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof o.$date === 'object' && o.$date !== null) {
      const inner = o.$date as Record<string, unknown>;
      if (typeof inner.$numberLong === 'string' || typeof inner.$numberLong === 'number') {
        const d = new Date(Number(inner.$numberLong));
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }
  return null;
}

// ✅ Date formatter (short, long, time) in Indian style
export function formatDate(date: string | Date | undefined | null, format: 'short' | 'long' | 'time' = 'short'): string {
  const dateObj = toDate(date);
  if (!dateObj) return '—';

  if (format === 'time') {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: format,
  }).format(dateObj);
}

// ✅ Date range formatter (e.g. "24 Aug - 28 Aug")
export function formatDateRange(checkIn: string, checkOut: string): string {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const formatter = new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(checkInDate)} - ${formatter.format(checkOutDate)}`;
}

// ✅ Nights calculator
export function calculateNights(checkIn: string, checkOut: string): number {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const timeDiff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

// ✅ Capitalize first letter
export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ✅ Status to color mapping (can be mapped to Material UI/Tailwind colors)
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    pending: 'orange',
    confirmed: 'blue',
    checked_in: 'green',
    checked_out: 'gray',
    cancelled: 'red',
    paid: 'green',
    failed: 'red',
    refunded: 'orange',
  };

  return statusColors[status] || 'gray';
}

// ✅ Percentage formatter
export function formatPercent(value: number, minimumFractionDigits = 1): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

// ✅ Time formatter (for timestamps)
export function formatTime(date: string | Date | undefined | null): string {
  const dateObj = toDate(date);
  if (!dateObj) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

// ✅ DateTime formatter (full date and time)
export function formatDateTime(date: string | Date | undefined | null): string {
  const dateObj = toDate(date);
  if (!dateObj) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(dateObj);
}

// ✅ Relative time formatter (e.g., "2 hours ago", "in 3 days")
export function formatRelativeTime(date: string | Date | undefined | null): string {
  const dateObj = toDate(date);
  if (!dateObj) return '—';
  const now = new Date();
  const diffInMs = dateObj.getTime() - now.getTime();
  const diffInSec = Math.floor(diffInMs / 1000);
  const diffInMin = Math.floor(diffInSec / 60);
  const diffInHour = Math.floor(diffInMin / 60);
  const diffInDay = Math.floor(diffInHour / 24);

  if (Math.abs(diffInMin) < 1) {
    return 'just now';
  } else if (Math.abs(diffInMin) < 60) {
    const minutes = Math.abs(diffInMin);
    return diffInMin < 0
      ? `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      : `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else if (Math.abs(diffInHour) < 24) {
    const hours = Math.abs(diffInHour);
    return diffInHour < 0
      ? `${hours} hour${hours !== 1 ? 's' : ''} ago`
      : `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  } else if (Math.abs(diffInDay) < 30) {
    const days = Math.abs(diffInDay);
    return diffInDay < 0
      ? `${days} day${days !== 1 ? 's' : ''} ago`
      : `in ${days} day${days !== 1 ? 's' : ''}`;
  } else {
    return formatDate(dateObj, 'short');
  }
}
