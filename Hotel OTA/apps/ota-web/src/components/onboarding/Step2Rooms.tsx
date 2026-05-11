'use client';

import { useState, useEffect } from 'react';
import { OnboardingSession, RoomConfig } from '@/lib/onboarding/api';

interface Step2RoomsProps {
  initialData: Partial<OnboardingSession>;
  onComplete: (data: Partial<OnboardingSession>) => void;
  onBack: () => void;
  loading: boolean;
}

const ROOM_TYPES = [
  { value: 'standard', label: 'Standard Room', price: '₹2,000', amenities: 'AC, WiFi, TV' },
  { value: 'deluxe', label: 'Deluxe Room', price: '₹3,500', amenities: 'AC, WiFi, TV, Minibar' },
  { value: 'suite', label: 'Suite', price: '₹6,000', amenities: 'AC, WiFi, TV, Minibar, Living Area' },
  { value: 'presidential', label: 'Presidential Suite', price: '₹15,000', amenities: 'Full luxury amenities' },
];

export function Step2Rooms({ initialData, onComplete, onBack, loading }: Step2RoomsProps) {
  const [roomCount, setRoomCount] = useState(initialData.rooms?.length || 10);
  const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>(
    initialData.rooms?.length
      ? initialData.rooms
      : Array.from({ length: 10 }, (_, i) => ({
          roomId: `room-${i + 1}`,
          roomNumber: `${101 + i}`,
          floor: Math.ceil((i + 1) / 10).toString(),
          roomType: 'standard',
          price: 200000, // in paise
        }))
  );
  const [autoMode, setAutoMode] = useState(true);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate rooms when count changes in auto mode
  useEffect(() => {
    if (autoMode) {
      generateRooms(roomCount);
    }
  }, [roomCount, autoMode]);

  const generateRooms = (count: number) => {
    const newRooms: RoomConfig[] = Array.from({ length: count }, (_, i) => ({
      roomId: initialData.rooms?.[i]?.roomId || `room-${Date.now()}-${i + 1}`,
      roomNumber: initialData.rooms?.[i]?.roomNumber || `${101 + i}`,
      floor: initialData.rooms?.[i]?.floor || Math.ceil((i + 1) / 10).toString(),
      roomType: initialData.rooms?.[i]?.roomType || 'standard',
      price: initialData.rooms?.[i]?.price || 200000,
    }));
    setRoomConfigs(newRooms);
  };

  const updateRoom = (index: number, field: keyof RoomConfig, value: string | number) => {
    const updated = [...roomConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setRoomConfigs(updated);
  };

  const handleGenerateQRCodes = async () => {
    setIsGeneratingQR(true);
    try {
      // Simulate QR code generation - in production this calls the API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const roomsWithQR = roomConfigs.map((room) => ({
        ...room,
        qrCode: `data:image/svg+xml;base64,${btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <rect fill="white" width="200" height="200"/>
            <rect fill="black" x="20" y="20" width="40" height="40"/>
            <rect fill="white" x="30" y="30" width="20" height="20"/>
            <rect fill="black" x="35" y="35" width="10" height="10"/>
            <rect fill="black" x="80" y="20" width="100" height="40"/>
            <rect fill="black" x="20" y="80" width="40" height="100"/>
            <rect fill="black" x="80" y="80" width="30" height="30"/>
            <rect fill="white" x="90" y="90" width="10" height="10"/>
            <rect fill="black" x="130" y="80" width="50" height="50"/>
            <rect fill="black" x="20" y="140" width="100" height="40"/>
            <rect fill="white" x="30" y="150" width="20" height="20"/>
            <rect fill="black" x="140" y="140" width="40" height="40"/>
            <text x="100" y="190" text-anchor="middle" font-size="14" fill="black">${room.roomNumber}</text>
          </svg>
        `)}`,
        printUrl: `/print/qr/${room.roomId}`,
      }));

      setRoomConfigs(roomsWithQR);
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (roomConfigs.length === 0) {
      newErrors.rooms = 'At least one room is required';
    }

    const hasInvalidRooms = roomConfigs.some(
      (r) => !r.roomNumber.trim() || !r.roomType
    );
    if (hasInvalidRooms) {
      newErrors.rooms = 'All rooms must have a room number and type';
    }

    const duplicateRooms = roomConfigs.filter(
      (r, i) => roomConfigs.findIndex((r2) => r2.roomNumber === r.roomNumber) !== i
    );
    if (duplicateRooms.length > 0) {
      newErrors.rooms = 'Duplicate room numbers found';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onComplete({ rooms: roomConfigs });
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🚪</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your rooms</h1>
        <p className="text-gray-600">
          Configure your rooms and we'll automatically generate QR codes for each one
        </p>
      </div>

      {/* Room Count Selector */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Total Rooms</h3>
            <p className="text-sm text-gray-500">How many rooms does your property have?</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRoomCount(Math.max(1, roomCount - 1))}
              className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 w-12 text-center">{roomCount}</span>
            <button
              type="button"
              onClick={() => setRoomCount(roomCount + 1)}
              className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min="1"
            max="500"
            value={roomCount}
            onChange={(e) => setRoomCount(parseInt(e.target.value))}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-500 w-16 text-right">{roomCount} rooms</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoMode}
              onChange={(e) => setAutoMode(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto-generate room numbers</span>
          </label>
        </div>
      </div>

      {/* Room List */}
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Room Configuration</h3>
            <span className="text-sm text-gray-500">{roomConfigs.length} rooms configured</span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 p-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0">
              <div className="col-span-2">Room No.</div>
              <div className="col-span-2">Floor</div>
              <div className="col-span-4">Type</div>
              <div className="col-span-3">Price (₹)</div>
              <div className="col-span-1"></div>
            </div>

            {/* Room Rows */}
            {roomConfigs.slice(0, 50).map((room, index) => (
              <div
                key={room.roomId}
                className="grid grid-cols-12 gap-2 p-3 border-b border-gray-50 hover:bg-gray-50/50 transition items-center"
              >
                <div className="col-span-2">
                  <input
                    type="text"
                    value={room.roomNumber}
                    onChange={(e) => updateRoom(index, 'roomNumber', e.target.value)}
                    placeholder="101"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    value={room.floor}
                    onChange={(e) => updateRoom(index, 'floor', e.target.value)}
                    placeholder="1"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="col-span-4">
                  <select
                    value={room.roomType}
                    onChange={(e) => updateRoom(index, 'roomType', e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ROOM_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    value={room.price / 100}
                    onChange={(e) => updateRoom(index, 'price', parseInt(e.target.value) * 100)}
                    placeholder="2000"
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="col-span-1 text-center">
                  {room.qrCode && (
                    <span className="text-green-500" title="QR Generated">
                      ✓
                    </span>
                  )}
                </div>
              </div>
            ))}

            {roomConfigs.length > 50 && (
              <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                Showing first 50 rooms. {roomConfigs.length - 50} more rooms configured.
              </div>
            )}
          </div>

          {errors.rooms && (
            <div className="p-3 bg-red-50 text-red-600 text-sm">
              {errors.rooms}
            </div>
          )}
        </div>

        {/* QR Code Generation */}
        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <span>QR Codes</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  Auto-generated
                </span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Each room gets a unique QR code that guests can scan for room service
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateQRCodes}
              disabled={isGeneratingQR}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition flex items-center gap-2"
            >
              {isGeneratingQR ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Generate QR Codes
                </>
              )}
            </button>
          </div>

          {/* QR Preview */}
          {roomConfigs.some((r) => r.qrCode) && (
            <div className="mt-4 pt-4 border-t border-indigo-100">
              <p className="text-sm text-gray-600 mb-3">Preview (first 3 rooms):</p>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {roomConfigs
                  .filter((r) => r.qrCode)
                  .slice(0, 3)
                  .map((room) => (
                    <div
                      key={room.roomId}
                      className="flex-shrink-0 bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center"
                    >
                      <div
                        className="w-28 h-28 mx-auto bg-gray-100 rounded-lg flex items-center justify-center"
                        dangerouslySetInnerHTML={{
                          __html: atob(room.qrCode!.replace('data:image/svg+xml;base64,', '')),
                        }}
                      />
                      <p className="text-sm font-semibold text-gray-900 mt-2">Room {room.roomNumber}</p>
                      <p className="text-xs text-gray-500">{ROOM_TYPES.find((t) => t.value === room.roomType)?.label}</p>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-4">
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
                Continue to Services
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
