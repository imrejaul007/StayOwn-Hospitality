/**
 * Format paise to INR string: 350000 -> "₹3,500"
 */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return '₹' + rupees.toLocaleString('en-IN');
}

/**
 * Format date: "2026-04-01" -> "01 Apr 2026"
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
