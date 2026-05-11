import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Key,
  X,
  Clock,
  Users,
  MapPin,
  Calendar,
  Shield,
  Share2,
  QrCode,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { digitalKeyService, GenerateKeyRequest } from '../../services/digitalKeyService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

interface Booking {
  _id: string;
  bookingNumber: string;
  roomId: {
    number: string;
    type: string;
    floor: string;
  };
  hotelId: {
    name: string;
    address: string;
  };
  checkIn: string;
  checkOut: string;
  status: string;
  guest: {
    name: string;
    email: string;
  };
}

interface BookingKeyGeneratorProps {
  booking: Booking;
  onClose: () => void;
  onSuccess?: () => void;
  existingKeys?: unknown[]; // Array of existing keys for this booking
}

export default function BookingKeyGenerator({ 
  booking, 
  onClose, 
  onSuccess,
  existingKeys = []
}: BookingKeyGeneratorProps) {
  const [formData, setFormData] = useState<GenerateKeyRequest>({
    bookingId: booking._id,
    type: 'primary',
    maxUses: -1,
    securitySettings: {
      requirePin: false,
      allowSharing: true,
      maxSharedUsers: 3,
      requireApproval: false
    }
  });

  const queryClient = useQueryClient();

  const generateKeyMutation = useMutation({
    mutationFn: (request: GenerateKeyRequest) => digitalKeyService.generateKey(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['booking-keys'] });
      toast.success('Digital key generated successfully!');
      onSuccess?.();
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to generate digital key');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateKeyMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSecuritySettingChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      securitySettings: {
        ...prev.securitySettings,
        [field]: value
      }
    }));
  };

  const isCheckInTime = new Date() >= new Date(booking.checkIn);
  const isCheckOutPassed = new Date() > new Date(booking.checkOut);

  const canGenerateKey = booking.status === 'confirmed' && !isCheckOutPassed;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Generate Digital Key</h2>
              <p className="text-sm text-gray-600">Create a digital room key for this booking</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Booking Summary */}
        <Card className="p-4 bg-gray-50 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Booking Details</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {booking.status}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium">Room {booking.roomId.number}</p>
                <p className="text-gray-600">{booking.roomId.type}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium">{booking.guest.name}</p>
                <p className="text-gray-600">{booking.guest.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium">Check-in</p>
                <p className="text-gray-600">{new Date(booking.checkIn).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium">Check-out</p>
                <p className="text-gray-600">{new Date(booking.checkOut).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Existing Keys Alert */}
        {existingKeys.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-yellow-800">Existing Keys Found</h4>
                <p className="text-yellow-700 text-sm mt-1">
                  This booking already has {existingKeys.length} digital key{existingKeys.length > 1 ? 's' : ''}. 
                  Generating a new key will create an additional key for this booking.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Validation Warnings */}
        {!canGenerateKey && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">Cannot Generate Key</h4>
                <p className="text-red-700 text-sm mt-1">
                  {isCheckOutPassed 
                    ? 'This booking has already ended. Keys cannot be generated for past bookings.'
                    : 'Keys can only be generated for confirmed bookings.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {canGenerateKey && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Key Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Key Type
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { value: 'primary', label: 'Primary Key', icon: '🔑', desc: 'Main access key' },
                  { value: 'temporary', label: 'Temporary Key', icon: '⏰', desc: 'Limited time access' },
                  { value: 'emergency', label: 'Emergency Key', icon: '🚨', desc: 'Emergency access only' }
                ].map((type) => (
                  <div key={type.value}>
                    <input
                      type="radio"
                      id={`type-${type.value}`}
                      name="keyType"
                      value={type.value}
                      checked={formData.type === type.value}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                      className="sr-only"
                    />
                    <label
                      htmlFor={`type-${type.value}`}
                      className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                        formData.type === type.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-2">{type.icon}</div>
                        <div className="font-medium text-gray-900">{type.label}</div>
                        <div className="text-xs text-gray-600 mt-1">{type.desc}</div>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Limits */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Uses
              </label>
              <select
                value={formData.maxUses}
                onChange={(e) => handleInputChange('maxUses', parseInt(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={-1}>Unlimited</option>
                <option value={1}>1 use only</option>
                <option value={5}>5 uses</option>
                <option value={10}>10 uses</option>
                <option value={20}>20 uses</option>
                <option value={50}>50 uses</option>
              </select>
            </div>

            {/* Security Settings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Shield className="w-4 h-4 inline mr-2" />
                Security Settings
              </label>
              <div className="space-y-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.securitySettings?.allowSharing || false}
                    onChange={(e) => handleSecuritySettingChange('allowSharing', e.target.checked)}
                    className="mt-1 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Allow Sharing</div>
                    <div className="text-sm text-gray-600">
                      Guest can share this key with other people
                    </div>
                  </div>
                </label>

                {formData.securitySettings?.allowSharing && (
                  <div className="ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Shared Users
                    </label>
                    <select
                      value={formData.securitySettings?.maxSharedUsers || 3}
                      onChange={(e) => handleSecuritySettingChange('maxSharedUsers', parseInt(e.target.value))}
                      className="w-32 border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                    </select>
                  </div>
                )}

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.securitySettings?.requirePin || false}
                    onChange={(e) => handleSecuritySettingChange('requirePin', e.target.checked)}
                    className="mt-1 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Require PIN</div>
                    <div className="text-sm text-gray-600">
                      Require a PIN code to use the key
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={formData.securitySettings?.requireApproval || false}
                    onChange={(e) => handleSecuritySettingChange('requireApproval', e.target.checked)}
                    className="mt-1 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Require Admin Approval</div>
                    <div className="text-sm text-gray-600">
                      Sharing requires admin approval
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={generateKeyMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={generateKeyMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {generateKeyMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating Key...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Generate Digital Key
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Info Footer */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start gap-3">
            <QrCode className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">How Digital Keys Work</p>
              <p className="text-blue-800">
                A unique QR code will be generated that the guest can use to access their room. 
                The key will be automatically valid from check-in to check-out time.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}