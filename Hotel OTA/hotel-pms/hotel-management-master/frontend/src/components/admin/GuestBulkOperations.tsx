import React, { useState } from 'react';
import { XMarkIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';

interface GuestBulkOperationsProps {
  selectedGuests: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const GuestBulkOperations: React.FC<GuestBulkOperationsProps> = ({
  selectedGuests,
  onClose,
  onSuccess
}) => {
  const [operation, setOperation] = useState('');
  const [operationData, setOperationData] = useState({
    loyaltyTier: '',
    guestType: '',
    message: '',
    emailSubject: '',
    emailContent: ''
  });
  const [loading, setLoading] = useState(false);

  const operations = [
    { value: '', label: 'Select Operation' },
    { value: 'updateLoyalty', label: 'Update Loyalty Tier' },
    { value: 'updateGuestType', label: 'Update Guest Type' },
    { value: 'sendEmail', label: 'Send Email' },
    { value: 'export', label: 'Export Selected' },
    { value: 'delete', label: 'Delete Selected' }
  ];

  const loyaltyTiers = [
    { value: 'bronze', label: 'Bronze' },
    { value: 'silver', label: 'Silver' },
    { value: 'gold', label: 'Gold' },
    { value: 'platinum', label: 'Platinum' }
  ];

  const guestTypes = [
    { value: 'normal', label: 'Normal' },
    { value: 'corporate', label: 'Corporate' }
  ];

  const handleOperationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setOperation(e.target.value);
    setOperationData({
      loyaltyTier: '',
      guestType: '',
      message: '',
      emailSubject: '',
      emailContent: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setOperationData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!operation) {
      toast.error('Please select an operation');
      return;
    }

    if (operation === 'delete') {
      if (!window.confirm(`Are you sure you want to delete ${selectedGuests.length} guest(s)? This action cannot be undone.`)) {
        return;
      }
    }

    setLoading(true);

    try {
      let updateData = {};
      
      switch (operation) {
        case 'updateLoyalty':
          if (!operationData.loyaltyTier) {
            throw new Error('Please select a loyalty tier');
          }
          updateData = { 'loyalty.tier': operationData.loyaltyTier };
          break;
        case 'updateGuestType':
          if (!operationData.guestType) {
            throw new Error('Please select a guest type');
          }
          updateData = { guestType: operationData.guestType };
          break;
        case 'sendEmail':
          if (!operationData.emailSubject || !operationData.emailContent) {
            throw new Error('Please provide email subject and content');
          }
          updateData = {
            emailSubject: operationData.emailSubject,
            emailContent: operationData.emailContent
          };
          break;
        case 'export':
          // Handle export separately
          await handleExport();
          setLoading(false);
          return;
        case 'delete':
          // Handle delete separately
          await handleDelete();
          setLoading(false);
          return;
        default:
          throw new Error('Invalid operation');
      }

      if (operation !== 'export' && operation !== 'delete') {
        const { data } = await api.patch('/guests/bulk-update', {
            guestIds: selectedGuests,
            updateData
          });
        toast.success(`Successfully updated ${data.data.modifiedCount} guest(s)`);
      }

      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to perform bulk operation');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      // Get guest details for export
      const { data } = await api.get('/guests');
      const selectedGuestData = data.data.guests.filter((guest: Record<string, unknown>) => 
        selectedGuests.includes(guest._id)
      );

      // Create CSV
      const csvHeader = 'Name,Email,Phone,Salutation,Loyalty Tier,Guest Type,Total Bookings,Total Spent,Created At\n';
      const csvData = selectedGuestData.map((guest: Record<string, unknown>) => {
        const salutation = guest.salutationId ? guest.salutationId.title : '';
        return [
          guest.name,
          guest.email,
          guest.phone || '',
          salutation,
          guest.loyalty.tier,
          guest.guestType,
          guest.stats?.bookings?.totalBookings || 0,
          guest.stats?.bookings?.totalSpent || 0,
          guest.createdAt
        ].join(',');
      }).join('\n');

      // Download CSV
      const blob = new Blob([csvHeader + csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `selected-guests-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Exported ${selectedGuestData.length} guest(s) successfully`);
    } catch (error) {
      toast.error('Failed to export guests');
    }
  };

  const handleDelete = async () => {
    try {
      // Delete guests one by one (in case some have dependencies)
      let successCount = 0;
      let errorCount = 0;

      for (const guestId of selectedGuests) {
        try {
          const response = await api.delete(`/guests/${guestId}`);
          if (response.data) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} guest(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} guest(s) (may have existing bookings)`);
      }

      onSuccess();
    } catch (error) {
      toast.error('Failed to delete guests');
    }
  };

  const renderOperationForm = () => {
    switch (operation) {
      case 'updateLoyalty':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Loyalty Tier *
            </label>
            <select
              name="loyaltyTier"
              value={operationData.loyaltyTier}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select loyalty tier</option>
              {loyaltyTiers.map(tier => (
                <option key={tier.value} value={tier.value}>{tier.label}</option>
              ))}
            </select>
          </div>
        );

      case 'updateGuestType':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Guest Type *
            </label>
            <select
              name="guestType"
              value={operationData.guestType}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select guest type</option>
              {guestTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
        );

      case 'sendEmail':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Subject *
              </label>
              <input
                type="text"
                name="emailSubject"
                value={operationData.emailSubject}
                onChange={handleInputChange}
                placeholder="Enter email subject"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Content *
              </label>
              <textarea
                name="emailContent"
                value={operationData.emailContent}
                onChange={handleInputChange}
                rows={6}
                placeholder="Enter email content"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="text-sm text-gray-600">
            <p>This will export the selected guests to a CSV file with the following information:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Name, Email, Phone</li>
              <li>Salutation, Loyalty Tier, Guest Type</li>
              <li>Total Bookings, Total Spent</li>
              <li>Registration Date</li>
            </ul>
          </div>
        );

      case 'delete':
        return (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md">
            <p className="font-medium">Warning: This action cannot be undone!</p>
            <p className="mt-1">
              This will permanently delete {selectedGuests.length} guest(s) from the system.
              Guests with existing bookings cannot be deleted.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <UserGroupIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              Bulk Operations ({selectedGuests.length} guests)
            </h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Operation *
            </label>
            <select
              value={operation}
              onChange={handleOperationChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {operations.map(op => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
          </div>

          {operation && (
            <div className="border-t border-gray-200 pt-4">
              {renderOperationForm()}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button aria-label="Close"
              type="submit"
              disabled={loading || !operation}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Execute Operation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GuestBulkOperations;
