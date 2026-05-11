'use client';

import { useEffect, useState } from 'react';
import { inventoryApi } from '@/lib/api';
import { formatINR } from '@/lib/format';
import dayjs from 'dayjs';

interface Slot {
  id: string;
  room_type_id: string;
  room_type_name: string;
  date: string;
  total_rooms: number;
  available_rooms: number;
  rate_paise: number;
  is_blocked: boolean;
}

export default function CalendarPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [editSlot, setEditSlot] = useState<Slot | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editRooms, setEditRooms] = useState('');
  const [editBlocked, setEditBlocked] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkFrom, setBulkFrom] = useState('');
  const [bulkTo, setBulkTo] = useState('');
  const [bulkRate, setBulkRate] = useState('');
  const [bulkRooms, setBulkRooms] = useState('');

  const from = dayjs().format('YYYY-MM-DD');
  const to = dayjs().add(30, 'day').format('YYYY-MM-DD');

  useEffect(() => { loadInventory(); }, []);

  async function loadInventory() {
    setLoading(true);
    try { setSlots(await inventoryApi.get(from, to)); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!editSlot) return;
    const dateStr = editSlot.date.split('T')[0];
    await inventoryApi.update(editSlot.room_type_id, dateStr, {
      rate_paise: parseInt(editRate) * 100,
      available_rooms: parseInt(editRooms),
      is_blocked: editBlocked,
    });
    setEditSlot(null);
    loadInventory();
  }

  async function handleBulkApply() {
    if (!bulkFrom || !bulkTo) return;
    const roomTypes = selectedRoomType === 'all'
      ? [...new Set(slots.map((s) => s.room_type_id))]
      : [selectedRoomType];

    for (const rtId of roomTypes) {
      let d = dayjs(bulkFrom);
      const end = dayjs(bulkTo);
      while (d.isBefore(end) || d.isSame(end)) {
        const updates: any = {};
        if (bulkRate) updates.rate_paise = parseInt(bulkRate) * 100;
        if (bulkRooms) updates.available_rooms = parseInt(bulkRooms);
        if (Object.keys(updates).length > 0) {
          await inventoryApi.update(rtId, d.format('YYYY-MM-DD'), updates).catch(() => {});
        }
        d = d.add(1, 'day');
      }
    }
    setBulkMode(false);
    loadInventory();
  }

  function openEdit(slot: Slot) {
    setEditSlot(slot);
    setEditRate((slot.rate_paise / 100).toString());
    setEditRooms(slot.available_rooms.toString());
    setEditBlocked(slot.is_blocked);
  }

  function getAvailabilityColor(slot: Slot): string {
    if (slot.is_blocked) return 'bg-gray-100 text-gray-400';
    const pct = slot.total_rooms > 0 ? slot.available_rooms / slot.total_rooms : 0;
    if (pct > 0.5) return 'bg-green-50 hover:bg-green-100';
    if (pct > 0.2) return 'bg-yellow-50 hover:bg-yellow-100';
    return 'bg-red-50 hover:bg-red-100';
  }

  // Room type tabs
  const roomTypes = [...new Map(slots.map((s) => [s.room_type_id, s.room_type_name])).entries()];

  const filtered = selectedRoomType === 'all' ? slots : slots.filter((s) => s.room_type_id === selectedRoomType);

  // Group by room type
  const grouped = filtered.reduce((acc, slot) => {
    if (!acc[slot.room_type_name]) acc[slot.room_type_name] = [];
    acc[slot.room_type_name].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading calendar...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Calendar</h1>
        <button onClick={() => setBulkMode(!bulkMode)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          {bulkMode ? 'Cancel Bulk Edit' : 'Bulk Edit'}
        </button>
      </div>

      {/* Room Type Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <button onClick={() => setSelectedRoomType('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
            selectedRoomType === 'all' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}>All Rooms</button>
        {roomTypes.map(([id, name]) => (
          <button key={id} onClick={() => setSelectedRoomType(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              selectedRoomType === id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{name}</button>
        ))}
      </div>

      {/* Bulk Edit Panel */}
      {bulkMode && (
        <div className="bg-blue-50 rounded-xl p-5 mb-5 border border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-3">Bulk Edit</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-medium text-blue-700 block mb-1">From Date</label>
              <input type="date" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-blue-700 block mb-1">To Date</label>
              <input type="date" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-blue-700 block mb-1">Rate (₹)</label>
              <input type="number" value={bulkRate} onChange={(e) => setBulkRate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div>
              <label className="text-xs font-medium text-blue-700 block mb-1">Rooms</label>
              <input type="number" value={bulkRooms} onChange={(e) => setBulkRooms(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Optional" />
            </div>
            <div className="flex items-end">
              <button onClick={handleBulkApply}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      {Object.entries(grouped).map(([roomTypeName, roomSlots]) => (
        <div key={roomTypeName} className="mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-2">{roomTypeName}</h2>
          <div className="grid grid-cols-7 md:grid-cols-10 lg:grid-cols-15 gap-1.5">
            {roomSlots.map((slot) => {
              const dateStr = slot.date.split('T')[0];
              const day = dayjs(dateStr);
              return (
                <button key={slot.id} onClick={() => openEdit(slot)}
                  className={`rounded-lg p-2 text-left transition border border-transparent hover:border-blue-300 ${getAvailabilityColor(slot)}`}>
                  <p className="text-[10px] text-gray-500 font-medium">{day.format('DD MMM')}</p>
                  <p className="text-xs font-bold text-gray-800">{slot.is_blocked ? 'Blocked' : `${slot.available_rooms}/${slot.total_rooms}`}</p>
                  <p className="text-[10px] text-gray-500">{formatINR(slot.rate_paise)}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Edit Modal */}
      {editSlot && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditSlot(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-1">Edit Inventory</h3>
            <p className="text-sm text-gray-400 mb-4">{editSlot.room_type_name} · {dayjs(editSlot.date).format('DD MMM YYYY')}</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Available Rooms</label>
                <input type="number" value={editRooms} onChange={(e) => setEditRooms(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Rate (₹)</label>
                <input type="number" value={editRate} onChange={(e) => setEditRate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editBlocked} onChange={(e) => setEditBlocked(e.target.checked)}
                  className="rounded" id="blocked" />
                <label htmlFor="blocked" className="text-sm text-gray-700">Block this date</label>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditSlot(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
