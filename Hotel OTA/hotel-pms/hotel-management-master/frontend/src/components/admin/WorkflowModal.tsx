import React, { useState } from 'react';
import { X, Users, Wrench, ClipboardList, CheckCircle, XCircle } from 'lucide-react';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'status_update';
  roomIds: string[];
  floorId?: number;
  onConfirm: (data: Record<string, unknown>) => void;
  loading?: boolean;
}

export const WorkflowModal: React.FC<WorkflowModalProps> = ({
  isOpen,
  onClose,
  type,
  roomIds,
  floorId,
  onConfirm,
  loading = false
}) => {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Reset form data when modal type changes or modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setFormData({});
    }
  }, [isOpen, type]);

  if (!isOpen) return null;

  const getModalConfig = () => {
    switch (type) {
      case 'checkin':
        return {
          title: 'Bulk Check-in',
          icon: <Users className="w-6 h-6 text-green-600" />,
          color: 'green',
          fields: [
            { name: 'guestName', label: 'Guest Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'phone', label: 'Phone', type: 'tel', required: true },
            { name: 'checkInDate', label: 'Check-in Date', type: 'datetime-local', required: true },
            { name: 'checkOutDate', label: 'Check-out Date', type: 'datetime-local', required: true },
            { name: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['Cash', 'Card', 'UPI', 'Corporate'], required: true },
            { name: 'specialRequests', label: 'Special Requests', type: 'textarea', required: false },
          ]
        };
      case 'checkout':
        return {
          title: 'Bulk Check-out',
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          color: 'red',
          fields: [
            { name: 'checkoutTime', label: 'Check-out Time', type: 'datetime-local', required: true },
            { name: 'paymentStatus', label: 'Payment Status', type: 'select', options: ['Paid', 'Pending', 'Partial'], required: true },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false },
          ]
        };
      case 'housekeeping':
        return {
          title: 'Schedule Housekeeping',
          icon: <ClipboardList className="w-6 h-6 text-blue-600" />,
          color: 'blue',
          fields: [
            { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'], required: true },
            { name: 'tasks', label: 'Tasks', type: 'multiselect', options: ['Cleaning', 'Bed Making', 'Bathroom', 'Amenities', 'Inspection'], required: true },
            { name: 'estimatedDuration', label: 'Estimated Duration (minutes)', type: 'number', required: true },
            { name: 'specialInstructions', label: 'Special Instructions', type: 'textarea', required: false },
          ]
        };
      case 'maintenance':
        return {
          title: 'Request Maintenance',
          icon: <Wrench className="w-6 h-6 text-orange-600" />,
          color: 'orange',
          fields: [
            { name: 'issueType', label: 'Issue Type', type: 'select', options: ['Plumbing', 'Electrical', 'HVAC', 'Furniture', 'Appliance', 'Other'], required: true },
            { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'], required: true },
            { name: 'description', label: 'Description', type: 'textarea', required: true },
            { name: 'estimatedCost', label: 'Estimated Cost', type: 'number', required: false },
            { name: 'scheduledDate', label: 'Scheduled Date', type: 'datetime-local', required: false },
          ]
        };
      case 'status_update':
        return {
          title: 'Update Room Status',
          icon: <CheckCircle className="w-6 h-6 text-purple-600" />,
          color: 'purple',
          fields: [
            { name: 'newStatus', label: 'New Status', type: 'select', options: ['Vacant', 'Occupied', 'Dirty', 'Maintenance', 'Out of Order', 'Reserved'], required: true },
            { name: 'reason', label: 'Reason', type: 'text', required: false },
            { name: 'notes', label: 'Notes', type: 'textarea', required: false },
          ]
        };
      default:
        return { title: 'Workflow Action', icon: null, color: 'gray', fields: [] };
    }
  };

  const config = getModalConfig();

  // Static Tailwind class mappings (dynamic class construction is not supported by Tailwind purge)
  const colorClasses: Record<string, { headerBg: string; submitBg: string; submitHover: string }> = {
    green: { headerBg: 'bg-green-50', submitBg: 'bg-green-600', submitHover: 'hover:bg-green-700' },
    red: { headerBg: 'bg-red-50', submitBg: 'bg-red-600', submitHover: 'hover:bg-red-700' },
    blue: { headerBg: 'bg-blue-50', submitBg: 'bg-blue-600', submitHover: 'hover:bg-blue-700' },
    orange: { headerBg: 'bg-orange-50', submitBg: 'bg-orange-600', submitHover: 'hover:bg-orange-700' },
    purple: { headerBg: 'bg-purple-50', submitBg: 'bg-purple-600', submitHover: 'hover:bg-purple-700' },
    gray: { headerBg: 'bg-gray-50', submitBg: 'bg-gray-600', submitHover: 'hover:bg-gray-700' },
  };
  const colors = colorClasses[config.color] || colorClasses.gray;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formData);
  };

  const handleFieldChange = (fieldName: string, value: string | string[]) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.headerBg}`}>
          <div className="flex items-center space-x-3">
            {config.icon}
            <h2 className="text-xl font-semibold text-gray-900">{config.title}</h2>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Room Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Selected Rooms</h3>
            <div className="text-sm text-gray-600">
              {roomIds.length} room{roomIds.length !== 1 ? 's' : ''} selected
              {floorId && ` on Floor ${floorId}`}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {roomIds.slice(0, 5).join(', ')}
              {roomIds.length > 5 && ` and ${roomIds.length - 5} more...`}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {config.fields.map((field) => (
              <div key={field.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                
                {field.type === 'text' || field.type === 'email' || field.type === 'tel' || field.type === 'number' || field.type === 'datetime-local' ? (
                  <input
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : field.type === 'textarea' ? (
                  <textarea
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={formData[field.name] || ''}
                    onChange={(e) => handleFieldChange(field.name, e.target.value)}
                    required={field.required}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select {field.label}</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option.toLowerCase().replace(' ', '_')}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'multiselect' ? (
                  <div className="space-y-2">
                    {field.options?.map((option) => (
                      <label key={option} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData[field.name]?.includes(option.toLowerCase().replace(' ', '_')) || false}
                          onChange={(e) => {
                            const currentValues = formData[field.name] || [];
                            const value = option.toLowerCase().replace(' ', '_');
                            if (e.target.checked) {
                              handleFieldChange(field.name, [...currentValues, value]);
                            } else {
                              handleFieldChange(field.name, currentValues.filter((v: string) => v !== value));
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {/* Actions */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button aria-label="Confirm"
                type="submit"
                className={`flex-1 px-4 py-2 ${colors.submitBg} text-white rounded-md ${colors.submitHover} transition-colors disabled:opacity-50`}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
