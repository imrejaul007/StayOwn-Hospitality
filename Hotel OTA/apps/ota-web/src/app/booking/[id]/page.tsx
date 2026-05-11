'use client';

import { useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';

/**
 * Legacy booking confirmation page — redirects to checkout flow.
 */
function BookingRedirectContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const holdId = params.id as string;
    const ref = searchParams.get('ref') || '';
    const total = searchParams.get('total') || '0';
    const pg = searchParams.get('pg') || total;
    const hotel = searchParams.get('hotel') || '';
    const checkin = searchParams.get('checkin') || '';
    const checkout = searchParams.get('checkout') || '';

    const urlParams = new URLSearchParams({
      holdId,
      bookingRef: ref,
      bookingValue: total,
      pg,
      hotel,
      checkin,
      checkout,
    });
    router.replace(`/checkout/coins?${urlParams.toString()}`);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
      Redirecting to checkout...
    </div>
  );
}

export default function BookingRedirectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">Loading...</div>}>
      <BookingRedirectContent />
    </Suspense>
  );
}
