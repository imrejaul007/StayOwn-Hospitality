'use client';

import { useEffect, useState } from 'react';
import { inventoryApi } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/format';
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

export default function InventoryPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editRate, setEditRate] = useState('');
  const [editRooms, setEditRooms] = useState('');

  const from = dayjs().format('YYYY-MM-DD');
  const to = dayjs().add(14, 'day').format('YYYY-MM-DD');

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    setLoading(true);
    try {
      const data = await inventoryApi.get(from, to);
      setSlots(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(roomTypeId: string, date: string) {
    try {
      await inventoryApi.update(roomTypeId, date, {
        rate_paise: parseInt(editRate) * 100,
        available_rooms: parseInt(editRooms),
      });
      setEditingSlot(null);
      loadInventory();
    } catch (err) {
      console.error(err);
    }
  }

  async function toggleBlock(slot: Slot) {
    try {
      await inventoryApi.update(slot.room_type_id, slot.date.split('T')[0], {
        is_blocked: !slot.is_blocked,
      });
      loadInventory();
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) return <div className="text-gray-500">Loading inventory...</div>;

  // Group by room type
  const grouped = slots.reduce((acc, slot) => {
    if (!acc[slot.room_type_name]) acc[slot.room_type_name] = [];
    acc[slot.room_type_name].push(slot);
    return acc;
  }, {} as Record<string, Slot[]>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
        <p className="text-sm text-gray-500">{formatDate(from)} — {formatDate(to)}</p>
      </div>

      {Object.entries(grouped).map(([roomTypeName, roomSlots]) => (
        <div key={roomTypeName} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">{roomTypeName}</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Available</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Rate</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roomSlots.map((slot) => {
                  const slotKey = `${slot.room_type_id}-${slot.date}`;
                  const isEditing = editingSlot === slotKey;
                  const dateStr = slot.date.split('T')[0];

                  return (
                    <tr key={slot.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(dateStr)}</td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editRooms}
                            onChange={(e) => setEditRooms(e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        ) : (
                          <span className={slot.available_rooms === 0 ? 'text-red-600 font-semibold' : ''}>
                            {slot.available_rooms} / {slot.total_rooms}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editRate}
                            onChange={(e) => setEditRate(e.target.value)}
                            className="w-24 px-2 py-1 border rounded text-center"
                            placeholder="Rupees"
                          />
                        ) : (
                          formatINR(slot.rate_paise)
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {slot.is_blocked ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Blocked</span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Open</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(slot.room_type_id, dateStr)}
                              className="text-green-600 hover:underline text-xs font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSlot(null)}
                              className="text-gray-500 hover:underline text-xs"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingSlot(slotKey);
                                setEditRate((slot.rate_paise / 100).toString());
                                setEditRooms(slot.available_rooms.toString());
                              }}
                              className="text-blue-600 hover:underline text-xs font-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleBlock(slot)}
                              className={`text-xs font-medium hover:underline ${
                                slot.is_blocked ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {slot.is_blocked ? 'Unblock' : 'Block'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
