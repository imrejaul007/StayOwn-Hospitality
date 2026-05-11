'use client';

import { useState } from 'react';
import { OnboardingSession } from '@/lib/onboarding/api';

interface Step3ServicesProps {
  initialData: Partial<OnboardingSession>;
  onComplete: (data: Partial<OnboardingSession>) => void;
  onBack: () => void;
  loading: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  priceRange?: string;
}

const AVAILABLE_SERVICES: Service[] = [
  {
    id: 'room_service',
    name: 'Room Service (Food)',
    description: 'Allow guests to order food and beverages directly to their room',
    icon: '🍽️',
    defaultEnabled: true,
    priceRange: '₹150 - ₹800 per order',
  },
  {
    id: 'housekeeping',
    name: 'Housekeeping',
    description: 'Enable housekeeping requests and room cleaning scheduling',
    icon: '🧹',
    defaultEnabled: true,
    priceRange: 'Free service',
  },
  {
    id: 'minibar',
    name: 'Minibar',
    description: 'Track and charge minibar consumption automatically',
    icon: '🍾',
    defaultEnabled: false,
    priceRange: '₹50 - ₹500 per item',
  },
  {
    id: 'laundry',
    name: 'Laundry & Dry Cleaning',
    description: 'Allow guests to request laundry and dry cleaning services',
    icon: '👕',
    defaultEnabled: false,
    priceRange: '₹50 - ₹300 per item',
  },
  {
    id: 'spa',
    name: 'Spa & Wellness',
    description: 'Book spa treatments, massages, and wellness sessions',
    icon: '💆',
    defaultEnabled: false,
    priceRange: '₹1,000 - ₹8,000 per session',
  },
  {
    id: 'transport',
    name: 'Transport & Transfers',
    description: 'Offer airport transfers, city tours, and local transport',
    icon: '🚗',
    defaultEnabled: false,
    priceRange: '₹500 - ₹2,000 per trip',
  },
  {
    id: 'concierge',
    name: 'Concierge',
    description: 'Personal concierge for reservations, recommendations, and special requests',
    icon: '🎩',
    defaultEnabled: false,
    priceRange: 'Complimentary',
  },
  {
    id: 'business',
    name: 'Business Center',
    description: 'Printing, scanning, and meeting room facilities',
    icon: '💼',
    defaultEnabled: false,
    priceRange: '₹200 - ₹2,000 per hour',
  },
];

export function Step3Services({ initialData, onComplete, onBack, loading }: Step3ServicesProps) {
  const [selectedServices, setSelectedServices] = useState<Record<string, boolean>>(() => {
    // Initialize from saved data or defaults
    const saved = initialData.services || {};
    return AVAILABLE_SERVICES.reduce((acc, service) => {
      acc[service.id] = saved[service.id] ?? service.defaultEnabled;
      return acc;
    }, {} as Record<string, boolean>);
  });

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId],
    }));
  };

  const selectAll = () => {
    const all: Record<string, boolean> = {};
    AVAILABLE_SERVICES.forEach((s) => (all[s.id] = true));
    setSelectedServices(all);
  };

  const selectDefaults = () => {
    const defaults: Record<string, boolean> = {};
    AVAILABLE_SERVICES.forEach((s) => (defaults[s.id] = s.defaultEnabled));
    setSelectedServices(defaults);
  };

  const enabledCount = Object.values(selectedServices).filter(Boolean).length;
  const totalCount = AVAILABLE_SERVICES.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Convert to the format expected by the API
    const services: Record<string, boolean> = {};
    Object.entries(selectedServices).forEach(([key, value]) => {
      services[key] = value;
    });
    onComplete({ services });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✨</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Configure your services</h1>
        <p className="text-gray-600">
          Choose which services your hotel offers. You can change these later.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{enabledCount}</span> of {totalCount} services selected
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectDefaults}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={selectAll}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            Select All
          </button>
        </div>
      </div>

      {/* Services Grid */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_SERVICES.map((service) => {
            const isEnabled = selectedServices[service.id];

            return (
              <div
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isEnabled
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                {/* Checkbox indicator */}
                <div
                  className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition ${
                    isEnabled ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isEnabled ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                      isEnabled ? 'bg-white shadow-sm' : 'bg-gray-100'
                    }`}
                  >
                    {service.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold ${isEnabled ? 'text-gray-900' : 'text-gray-700'}`}>
                      {service.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                    {service.priceRange && (
                      <p className="text-xs text-gray-400 mt-2">{service.priceRange}</p>
                    )}
                  </div>
                </div>

                {/* Hidden checkbox for accessibility */}
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleService(service.id)}
                  className="sr-only"
                />
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="font-semibold text-amber-800">Tip</p>
              <p className="text-sm text-amber-700">
                Room Service and Housekeeping are enabled by default as they have the highest guest engagement.
                You can customize pricing and availability for each service after setup.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4">
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-4 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Saving...
              </>
            ) : (
              <>
                Continue to Team
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
