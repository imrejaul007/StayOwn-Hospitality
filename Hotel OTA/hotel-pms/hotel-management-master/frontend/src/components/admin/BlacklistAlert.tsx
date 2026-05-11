import React, { useState, useEffect } from 'react';
import { XMarkIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface BlacklistAlertProps {
  onClose: () => void;
}

interface BlacklistEntry {
  _id: string;
  guestId: {
    _id: string;
    name: string;
    email: string;
  };
  reason: string;
  type: string;
  category: string;
  incidentDate: string;
  expiryDate?: string;
}

const BlacklistAlert: React.FC<BlacklistAlertProps> = ({ onClose }) => {
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);

  useEffect(() => {
    fetchBlacklistEntries();
  }, []);

  const fetchBlacklistEntries = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/blacklist', { params: { isActive: true, limit: 50 } });
      setBlacklistEntries(data.data.blacklistEntries);
    } catch (error) {
      toast.error('Failed to fetch blacklist entries');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectedEntries.length === blacklistEntries.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(blacklistEntries.map(entry => entry._id));
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate') => {
    if (selectedEntries.length === 0) {
      toast.error('Please select entries to perform action');
      return;
    }

    try {
      await api.patch('/blacklist/bulk-update', {
        blacklistIds: selectedEntries,
        updateData: { isActive: action === 'activate' }
      });

      toast.success(`Successfully ${action}d ${selectedEntries.length} entries`);
      setSelectedEntries([]);
      fetchBlacklistEntries();
    } catch (error) {
      toast.error('Failed to perform bulk action');
    }
  };

  const getTypeColor = (type: string) => {
    const colors = {
      temporary: 'bg-yellow-100 text-yellow-800',
      permanent: 'bg-red-100 text-red-800',
      conditional: 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      non_payment: 'bg-red-100 text-red-800',
      damage: 'bg-orange-100 text-orange-800',
      misconduct: 'bg-purple-100 text-purple-800',
      security: 'bg-red-100 text-red-800',
      policy_violation: 'bg-blue-100 text-blue-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Blacklist Alert Center</h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Alert Summary */}
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Active Blacklist Entries</h4>
              <p className="text-sm text-red-700">
                {blacklistEntries.length} guests are currently blacklisted. 
                These guests will be prevented from making new bookings.
              </p>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedEntries.length > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {selectedEntries.length} entry(s) selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleBulkAction('deactivate')}
                  className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
                >
                  Deactivate Selected
                </button>
                <button
                  onClick={() => setSelectedEntries([])}
                  className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blacklist Entries */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading blacklist entries...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedEntries.length === blacklistEntries.length && blacklistEntries.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Guest
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Incident Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blacklistEntries.map((entry) => (
                    <tr key={entry._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedEntries.includes(entry._id)}
                          onChange={() => handleSelectEntry(entry._id)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {entry.guestId.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {entry.guestId.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {entry.reason}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTypeColor(entry.type)}`}>
                          {entry.type}
                        </span>
                        {entry.type === 'temporary' && entry.expiryDate && (
                          <div className="text-xs text-gray-500 mt-1">
                            {isExpired(entry.expiryDate) ? 'Expired' : `Expires: ${new Date(entry.expiryDate).toLocaleDateString()}`}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(entry.category)}`}>
                          {entry.category.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(entry.incidentDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <ExclamationTriangleIcon className="w-4 h-4 text-red-600 mr-1" />
                          <span className="text-sm text-red-600 font-medium">Active</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && blacklistEntries.length === 0 && (
            <div className="p-8 text-center">
              <CheckCircleIcon className="w-12 h-12 text-green-600 mx-auto mb-4" />
              <p className="text-gray-500">No active blacklist entries</p>
              <p className="text-sm text-gray-400 mt-1">All guests are currently allowed to make bookings</p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlacklistAlert;
