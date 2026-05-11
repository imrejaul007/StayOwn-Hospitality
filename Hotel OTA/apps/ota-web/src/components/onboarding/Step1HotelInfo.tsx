'use client';

import { useState, useEffect } from 'react';
import { OnboardingSession } from '@/lib/onboarding/api';

interface Step1HotelInfoProps {
  initialData: Partial<OnboardingSession>;
  onComplete: (data: Partial<OnboardingSession>) => void;
  loading: boolean;
}

const HOTEL_TYPES = [
  { value: 'boutique', label: 'Boutique Hotel', icon: '🏠' },
  { value: 'business', label: 'Business Hotel', icon: '💼' },
  { value: 'resort', label: 'Resort', icon: '🏖️' },
  { value: 'budget', label: 'Budget / Capsule', icon: '🎒' },
  { value: 'heritage', label: 'Heritage / Palace', icon: '🏛️' },
  { value: 'homestay', label: 'Homestay / Villa', icon: '🌴' },
];

const STAR_RATINGS = [
  { value: 1, label: '1 Star' },
  { value: 2, label: '2 Stars' },
  { value: 3, label: '3 Stars' },
  { value: 4, label: '4 Stars' },
  { value: 5, label: '5 Stars' },
];

export function Step1HotelInfo({ initialData, onComplete, loading }: Step1HotelInfoProps) {
  const [hotelName, setHotelName] = useState(initialData.hotelName || '');
  const [location, setLocation] = useState(initialData.location || '');
  const [contactEmail, setContactEmail] = useState(initialData.constactEmail || '');
  const [hotelType, setHotelType] = useState(initialData.hotelType || '');
  const [starRating, setStarRating] = useState(initialData.starRating || 3);
  const [phone, setPhone] = useState(initialData.phone || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-detect location
  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // In production, use a reverse geocoding API
            // For now, use coordinates as placeholder
            setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
          } catch {
            setErrors((prev) => ({ ...prev, location: 'Could not detect location. Please enter manually.' }));
          }
        },
        () => {
          setErrors((prev) => ({ ...prev, location: 'Location access denied. Please enter manually.' }));
        }
      );
    } else {
      setErrors((prev) => ({ ...prev, location: 'Geolocation not supported. Please enter manually.' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!hotelName.trim()) {
      newErrors.hotelName = 'Hotel name is required';
    } else if (hotelName.length < 3) {
      newErrors.hotelName = 'Hotel name must be at least 3 characters';
    }

    if (!location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!hotelType) {
      newErrors.hotelType = 'Please select a hotel type';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Contact phone is required';
    } else if (!/^\+?[\d\s-]{10,}$/.test(phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete({
        hotelName: hotelName.trim(),
        location: location.trim(),
        constactEmail: contactEmail.trim() || undefined,
        hotelType,
        starRating,
        phone: phone.trim(),
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏨</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your property</h1>
        <p className="text-gray-600">Start by entering your hotel details</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
        {/* Hotel Name */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Hotel Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={hotelName}
            onChange={(e) => setHotelName(e.target.value)}
            placeholder="e.g., The Grand Palace Hotel"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
              errors.hotelName ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.hotelName && (
            <p className="text-red-500 text-sm mt-1">{errors.hotelName}</p>
          )}
        </div>

        {/* Location */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Location <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">📍</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State or Address"
                className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
                  errors.location ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              />
            </div>
            <button
              type="button"
              onClick={detectLocation}
              className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition"
              title="Detect my location"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          {errors.location && (
            <p className="text-red-500 text-sm mt-1">{errors.location}</p>
          )}
        </div>

        {/* Hotel Type */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Hotel Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {HOTEL_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => setHotelType(type.value)}
                className={`p-4 rounded-xl border-2 transition text-left ${
                  hotelType === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl mb-1 block">{type.icon}</span>
                <span className="text-sm font-medium text-gray-900">{type.label}</span>
              </button>
            ))}
          </div>
          {errors.hotelType && (
            <p className="text-red-500 text-sm mt-1">{errors.hotelType}</p>
          )}
        </div>

        {/* Star Rating */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Star Rating
          </label>
          <div className="flex gap-2">
            {STAR_RATINGS.map((star) => (
              <button
                key={star.value}
                type="button"
                onClick={() => setStarRating(star.value)}
                className={`px-4 py-2 rounded-xl border-2 transition ${
                  starRating === star.value
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                {'★'.repeat(star.value)}
              </button>
            ))}
          </div>
        </div>

        {/* Contact Phone */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Contact Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
              errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Contact Email (Optional, auto-filled) */}
        <div className="mb-8">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Contact Email <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="manager@hotel.com"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <p className="text-gray-400 text-xs mt-1">Auto-filled from your invitation</p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              Saving...
            </>
          ) : (
            <>
              Continue to Rooms
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
