import React, { useState } from 'react';
import { api } from '../../services/api';
import {
  X,
  Users,
  UserCheck,
  UserX,
  Shield,
  Building,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserBulkOperationsProps {
  selectedUsers: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface BulkOperation {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<unknown>;
  color: string;
  requiresConfirmation: boolean;
  requiresData?: boolean;
  dataFields?: Array<{
    name: string;
    label: string;
    type: 'select' | 'text' | 'number';
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
}

const UserBulkOperations: React.FC<UserBulkOperationsProps> = ({
  selectedUsers,
  onClose,
  onSuccess
}) => {
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [operationData, setOperationData] = useState<Record<string, unknown>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);

  const operations: BulkOperation[] = [
    {
      id: 'activate',
      name: 'Activate Users',
      description: 'Activate selected users to allow them to access the system',
      icon: UserCheck,
      color: 'bg-green-500',
      requiresConfirmation: true
    },
    {
      id: 'deactivate',
      name: 'Deactivate Users',
      description: 'Deactivate selected users to prevent system access',
      icon: UserX,
      color: 'bg-red-500',
      requiresConfirmation: true
    },
    {
      id: 'updateRole',
      name: 'Update Role',
      description: 'Change the role of selected users',
      icon: Shield,
      color: 'bg-purple-500',
      requiresConfirmation: true,
      requiresData: true,
      dataFields: [
        {
          name: 'role',
          label: 'New Role',
          type: 'select',
          required: true,
          options: [
            { value: 'guest', label: 'Guest' },
            { value: 'staff', label: 'Staff' },
            { value: 'admin', label: 'Admin' },
            { value: 'manager', label: 'Manager' }
          ]
        }
      ]
    },
    {
      id: 'updateHotel',
      name: 'Update Hotel',
      description: 'Assign selected users to a different hotel',
      icon: Building,
      color: 'bg-blue-500',
      requiresConfirmation: true,
      requiresData: true,
      dataFields: [
        {
          name: 'hotelId',
          label: 'Hotel ID',
          type: 'text',
          required: true
        }
      ]
    },
    {
      id: 'delete',
      name: 'Delete Users',
      description: 'Permanently delete selected users from the system',
      icon: Trash2,
      color: 'bg-red-600',
      requiresConfirmation: true
    }
  ];

  const handleOperationSelect = (operationId: string) => {
    setSelectedOperation(operationId);
    setOperationData({});
  };

  const handleDataChange = (fieldName: string, value: unknown) => {
    setOperationData(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleExecute = async () => {
    if (!selectedOperation) {
      toast.error('Please select an operation');
      return;
    }

    const operation = operations.find(op => op.id === selectedOperation);
    if (!operation) return;

    // Validate required data fields
    if (operation.requiresData && operation.dataFields) {
      for (const field of operation.dataFields) {
        if (field.required && !operationData[field.name]) {
          toast.error(`${field.label} is required`);
          return;
        }
      }
    }

    if (operation.requiresConfirmation) {
      setShowConfirmation(true);
      return;
    }

    await executeOperation();
  };

  const executeOperation = async () => {
    try {
      setLoading(true);

      const { data: result } = await api.post('/user-management/bulk-operations', {
        operation: selectedOperation,
        userIds: selectedUsers,
        data: operationData
      });
      const operation = operations.find(op => op.id === selectedOperation);
      
      toast.success(`${operation?.name} completed: ${result.data.modifiedCount || result.data.deletedCount} users affected`);
      onSuccess();
    } catch (error) {
      toast.error('Failed to execute bulk operation');
    } finally {
      setLoading(false);
      setShowConfirmation(false);
    }
  };

  const getOperationIcon = (operation: BulkOperation) => {
    const Icon = operation.icon;
    return <Icon className="w-6 h-6" />;
  };

  const getConfirmationMessage = () => {
    const operation = operations.find(op => op.id === selectedOperation);
    if (!operation) return '';

    const userCount = selectedUsers.length;
    const operationName = operation.name.toLowerCase();

    if (operation.id === 'delete') {
      return `Are you sure you want to permanently delete ${userCount} user${userCount > 1 ? 's' : ''}? This action cannot be undone.`;
    }

    return `Are you sure you want to ${operationName} ${userCount} user${userCount > 1 ? 's' : ''}?`;
  };

  const selectedOperationConfig = operations.find(op => op.id === selectedOperation);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-2/3 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Users className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">
              Bulk Operations ({selectedUsers.length} users selected)
            </h3>
          </div>
          <button aria-label="Close"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Operation Selection */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Select Operation</h4>
          <div className="grid grid-cols-1 gap-3">
            {operations.map((operation) => (
              <div role="button" tabIndex={0}
                key={operation.id}
                onClick={() => handleOperationSelect(operation.id)}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                  selectedOperation === operation.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
               onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleOperationSelect(operation.id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                <div className="flex items-center">
                  <div className={`flex-shrink-0 w-10 h-10 ${operation.color} rounded-lg flex items-center justify-center text-white mr-4`}>
                    {getOperationIcon(operation)}
                  </div>
                  <div className="flex-1">
                    <h5 className="text-sm font-medium text-gray-900">{operation.name}</h5>
                    <p className="text-sm text-gray-500">{operation.description}</p>
                  </div>
                  {operation.requiresConfirmation && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operation Data Fields */}
        {selectedOperationConfig?.requiresData && selectedOperationConfig.dataFields && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Operation Details</h4>
            <div className="space-y-4">
              {selectedOperationConfig.dataFields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={operationData[field.name] || ''}
                      onChange={(e) => handleDataChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={field.required}
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={operationData[field.name] || ''}
                      onChange={(e) => handleDataChange(field.name, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required={field.required}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Users Summary */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Selected Users</h4>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Info className="w-4 h-4 text-blue-500 mr-2" />
              <span className="text-sm text-gray-700">
                {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected for bulk operation
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button aria-label="Close"
            onClick={handleExecute}
            disabled={loading || !selectedOperation}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Executing...' : 'Execute Operation'}
          </button>
        </div>

        {/* Confirmation Modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-5 border w-11/12 md:w-1/2 shadow-lg rounded-md bg-white">
              <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Confirm Operation</h3>
              </div>
              
              <p className="text-sm text-gray-700 mb-6">
                {getConfirmationMessage()}
              </p>

              {selectedOperationConfig?.requiresData && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Operation Details:</h4>
                  {Object.entries(operationData).map(([key, value]) => (
                    <div key={key} className="text-sm text-gray-600">
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button aria-label="Delete"
                  onClick={executeOperation}
                  disabled={loading}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90 disabled:opacity-50 ${
                    selectedOperationConfig?.id === 'delete' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Executing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserBulkOperations;
