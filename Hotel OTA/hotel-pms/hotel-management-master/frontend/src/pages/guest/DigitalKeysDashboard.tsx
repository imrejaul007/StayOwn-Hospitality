import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Key, 
  QrCode, 
  Share2, 
  Trash2, 
  Eye, 
  Clock, 
  Users, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Download, 
  Copy, 
  MoreHorizontal,
  Calendar,
  MapPin,
  Building,
  User,
  Smartphone,
  Globe,
  Lock,
  Unlock,
  History,
  BarChart3,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { digitalKeyService, DigitalKey, KeyStats, GenerateKeyRequest, ShareKeyRequest } from '../../services/digitalKeyService';
import { bookingService } from '../../services/bookingService';
import { Booking } from '../../types/booking';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function DigitalKeysDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'my-keys' | 'shared-keys' | 'stats'>('my-keys');
  const [selectedKey, setSelectedKey] = useState<DigitalKey | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmRevokeKeyId, setConfirmRevokeKeyId] = useState<string | null>(null);
  const [confirmRevokeShare, setConfirmRevokeShare] = useState<{ keyId: string; userIdOrEmail: string } | null>(null);

  const queryClient = useQueryClient();
  const { connectionState, connect, on, off } = useRealTime();

  // Real-time WebSocket connection setup
  useEffect(() => {
    connect().catch((error) => {
      console.error('Real-time connection failed (page remains usable):', error);
    });
    return () => {
      // Do not disconnect shared singleton socket on page unmount.
    };
  }, [connect]);

  // Real-time event listeners for digital key updates
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleDigitalKeyCreated = (data: { digitalKey: DigitalKey }) => {
      const newKey = data.digitalKey;
      
      // Invalidate and refetch keys data to include the new key
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['key-stats'] });
      
      toast.success(`Digital key for Room ${newKey.roomId?.number || 'N/A'} has been generated!`, {
        duration: 5000,
        icon: '🔑'
      });
    };

    const handleDigitalKeyUpdated = (data: { digitalKey: DigitalKey; previousStatus?: string }) => {
      const updatedKey = data.digitalKey;

      // Invalidate the paginated keys query so the current page refetches with
      // fresh data. setQueryData is intentionally NOT used here because the query
      // key includes page/status/type filters and a partial cache write would
      // silently miss the active entry.
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });

      // Show notification for key status changes
      if (data.previousStatus && data.previousStatus !== updatedKey.status) {
        const statusMessages = {
          'revoked': `Digital key for Room ${updatedKey.roomId?.number || 'N/A'} has been revoked`,
          'expired': `Digital key for Room ${updatedKey.roomId?.number || 'N/A'} has expired`,
          'used': `Digital key for Room ${updatedKey.roomId?.number || 'N/A'} was used for access`
        };

        const message = statusMessages[updatedKey.status as keyof typeof statusMessages];
        if (message) {
          toast(message, {
            duration: 4000,
            icon: updatedKey.status === 'revoked' ? '🚫' :
                  updatedKey.status === 'expired' ? '⏰' : '🚪'
          });
        }

        queryClient.invalidateQueries({ queryKey: ['key-stats'] });
      }
    };

    const handleDigitalKeyShared = (data: { digitalKey: DigitalKey; sharedWith?: { name?: string } }) => {
      const sharedKey = data.digitalKey;
      
      // Update the cache with sharing information
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['shared-keys'] });
      queryClient.invalidateQueries({ queryKey: ['key-stats'] });
      
      toast.success(`Digital key for Room ${sharedKey.roomId?.number || 'N/A'} has been shared with ${data.sharedWith?.name || 'user'}`, {
        duration: 4000,
        icon: '🤝'
      });
    };

    const handleDigitalKeyShareRevoked = (data: { digitalKey: DigitalKey }) => {
      const key = data.digitalKey;
      
      // Update the cache
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      queryClient.invalidateQueries({ queryKey: ['shared-keys'] });
      
      toast(`Share access revoked for Room ${key.roomId?.number || 'N/A'}`, {
        duration: 4000,
        icon: '❌'
      });
    };

    const handleDigitalKeyAccessed = (data: { digitalKey: DigitalKey }) => {
      const accessedKey = data.digitalKey;

      // Invalidate the paginated query so the current page refetches with the
      // updated usage count. setQueryData is intentionally NOT used here because
      // the query key includes page/status/type filters and a partial cache write
      // would silently miss the active entry.
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });

      toast.success(`Room ${accessedKey.roomId?.number || 'N/A'} accessed successfully`, {
        duration: 3000,
        icon: '🚪'
      });

      // Refresh stats
      queryClient.invalidateQueries({ queryKey: ['key-stats'] });
    };

    // Set up event listeners
    on('digital-key:created', handleDigitalKeyCreated);
    on('digital-key:updated', handleDigitalKeyUpdated);
    on('digital-key:shared', handleDigitalKeyShared);
    on('digital-key:share-revoked', handleDigitalKeyShareRevoked);
    on('digital-key:accessed', handleDigitalKeyAccessed);

    return () => {
      off('digital-key:created', handleDigitalKeyCreated);
      off('digital-key:updated', handleDigitalKeyUpdated);
      off('digital-key:shared', handleDigitalKeyShared);
      off('digital-key:share-revoked', handleDigitalKeyShareRevoked);
      off('digital-key:accessed', handleDigitalKeyAccessed);
    };
  }, [connectionState, on, off, queryClient]);

  // Queries
  const { data: keysData, isLoading: keysLoading, error: keysError } = useQuery({
    queryKey: ['digital-keys', currentPage, statusFilter, typeFilter],
    queryFn: () => digitalKeyService.getKeys({
      page: currentPage,
      status: statusFilter || undefined,
      type: typeFilter || undefined
    }),
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sharedKeysData, isLoading: sharedKeysLoading, error: sharedKeysError } = useQuery({
    queryKey: ['shared-keys', currentPage],
    queryFn: () => digitalKeyService.getSharedKeys({ page: currentPage }),
    enabled: activeTab === 'shared-keys',
    retry: 2,
  });

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['key-stats'],
    queryFn: () => digitalKeyService.getStats(),
    enabled: activeTab === 'stats',
    retry: 2,
  });

  // Mutations
  const generateKeyMutation = useMutation({
    mutationFn: (request: GenerateKeyRequest) => digitalKeyService.generateKey(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      setShowGenerateModal(false);
      toast.success('Digital key generated successfully!');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to generate key');
    }
  });

  const shareKeyMutation = useMutation({
    mutationFn: ({ keyId, request }: { keyId: string; request: ShareKeyRequest }) =>
      digitalKeyService.shareKey(keyId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      setShowShareModal(false);
      toast.success('Key shared successfully!');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to share key');
    }
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId: string) => digitalKeyService.revokeKey(keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      toast.success('Key revoked successfully!');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to revoke key');
    }
  });

  const revokeShareMutation = useMutation({
    mutationFn: ({ keyId, userIdOrEmail }: { keyId: string; userIdOrEmail: string }) =>
      digitalKeyService.revokeShare(keyId, userIdOrEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
      toast.success('Share revoked successfully!');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || 'Failed to revoke share');
    }
  });

  const filteredKeys = keysData?.keys.filter(key => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        key.roomId?.number?.toLowerCase().includes(searchLower) ||
        key.hotelId?.name?.toLowerCase().includes(searchLower) ||
        key.keyCode.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }) || [];

  const handleGenerateKey = (formData: GenerateKeyRequest) => {
    generateKeyMutation.mutate(formData);
  };

  const handleShareKey = (keyId: string, formData: ShareKeyRequest) => {
    shareKeyMutation.mutate({ keyId, request: formData });
  };

  const handleRevokeKey = (keyId: string) => {
    setConfirmRevokeKeyId(keyId);
  };

  const confirmRevokeKeyAction = () => {
    if (confirmRevokeKeyId) {
      revokeKeyMutation.mutate(confirmRevokeKeyId);
      setConfirmRevokeKeyId(null);
    }
  };

  const handleRevokeShare = (keyId: string, userIdOrEmail: string) => {
    setConfirmRevokeShare({ keyId, userIdOrEmail });
  };

  const confirmRevokeShareAction = () => {
    if (confirmRevokeShare) {
      revokeShareMutation.mutate(confirmRevokeShare);
      setConfirmRevokeShare(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const downloadQRCode = (key: DigitalKey) => {
    if (key.qrCode?.startsWith('data:image/')) {
      const link = document.createElement('a');
      link.download = `key-${key.keyCode}.png`;
      link.href = key.qrCode;
      link.click();
      return;
    }
    const canvas = document.querySelector(`#qr-${key._id} canvas`) as HTMLCanvasElement | null;
    if (canvas) {
      const link = document.createElement('a');
      link.download = `key-${key.keyCode}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } else {
      toast.error('QR image is not ready to download yet.');
    }
  };

  if (keysLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Room Keys</h1>
          <div className="flex items-center space-x-4">
            <p className="text-gray-600">Manage your digital room access keys</p>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionState === 'connected' ? 'bg-green-500' : 
                connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-gray-500">
                {connectionState === 'connected' ? 'Live Updates' : 
                 connectionState === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Generate New Key
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'my-keys', label: 'My Keys', count: keysData?.pagination.totalItems || 0 },
            { id: 'shared-keys', label: 'Shared Keys', count: sharedKeysData?.pagination.totalItems || 0 },
            { id: 'stats', label: 'Statistics' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'my-keys' | 'shared-keys' | 'stats')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      {activeTab === 'my-keys' && (
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <Input
              placeholder="Search keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="revoked">Revoked</option>
            <option value="used">Used</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2"
          >
            <option value="">All Types</option>
            <option value="primary">Primary</option>
            <option value="temporary">Temporary</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      )}

      {/* Content */}
      {activeTab === 'my-keys' && (
        <div className="grid gap-6">
          {keysLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : keysError ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Keys</h3>
              <p className="text-gray-600 mb-4">
                There was a problem loading your digital keys. Please try again.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['digital-keys'] })}>
                Try Again
              </Button>
            </Card>
          ) : filteredKeys.length === 0 ? (
            <Card className="p-8 text-center">
              <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No digital keys found</h3>
              <p className="text-gray-600 mb-4">
                {keysData?.keys && keysData.keys.length === 0 
                  ? "You haven't generated any digital keys yet. Generate your first key from one of your confirmed bookings." 
                  : "No keys match your current search filters. Try adjusting your filters or search terms."
                }
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setShowGenerateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Key
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/app/bookings')}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View Bookings
                </Button>
                {keysData?.keys && keysData.keys.length > 0 && (
                  <Button variant="outline" onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('');
                    setTypeFilter('');
                  }}>
                    Clear Filters
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredKeys.map((key) => (
                <KeyCard
                  key={key._id}
                  digitalKey={key}
                  onViewDetails={() => setSelectedKey(key)}
                  onShare={() => {
                    setSelectedKey(key);
                    setShowShareModal(true);
                  }}
                  onRevoke={() => handleRevokeKey(key._id)}
                  onViewLogs={() => {
                    setSelectedKey(key);
                    setShowLogsModal(true);
                  }}
                  onCopyCode={() => copyToClipboard(key.keyCode)}
                  onDownloadQR={() => downloadQRCode(key)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {keysData && keysData.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={!keysData.pagination.hasPrev}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {keysData.pagination.currentPage} of {keysData.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={!keysData.pagination.hasNext}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'shared-keys' && (
        <div className="grid gap-6">
          {sharedKeysLoading ? (
            <LoadingSpinner />
          ) : sharedKeysError ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Shared Keys</h3>
              <p className="text-gray-600 mb-4">
                There was a problem loading shared keys. Please try again.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['shared-keys'] })}>
                Try Again
              </Button>
            </Card>
          ) : sharedKeysData?.keys.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No shared keys</h3>
              <p className="text-gray-600">
                Keys shared with you will appear here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sharedKeysData?.keys.map((key) => (
                <SharedKeyCard
                  key={key._id}
                  digitalKey={key}
                  onViewDetails={() => setSelectedKey(key)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && (
        <div className="grid gap-6">
          {statsLoading ? (
            <LoadingSpinner />
          ) : statsError ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Statistics</h3>
              <p className="text-gray-600 mb-4">
                There was a problem loading your key statistics. Please try again.
              </p>
              <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['key-stats'] })}>
                Try Again
              </Button>
            </Card>
          ) : stats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Keys"
                value={stats.totalKeys}
                icon={Key}
                color="bg-blue-100 text-blue-600"
              />
              <StatCard
                title="Active Keys"
                value={stats.activeKeys}
                icon={CheckCircle}
                color="bg-green-100 text-green-600"
              />
              <StatCard
                title="Shared Keys"
                value={stats.sharedKeys}
                icon={Users}
                color="bg-purple-100 text-purple-600"
              />
              <StatCard
                title="Total Uses"
                value={stats.totalUses}
                icon={BarChart3}
                color="bg-orange-100 text-orange-600"
              />
            </div>
          ) : (
            <Card className="p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No statistics available</h3>
              <p className="text-gray-600">
                Statistics will appear here once you start using digital keys.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Modals */}
      {showGenerateModal && (
        <GenerateKeyModal
          onClose={() => setShowGenerateModal(false)}
          onSubmit={handleGenerateKey}
          isLoading={generateKeyMutation.isPending}
        />
      )}

      {showShareModal && selectedKey && (
        <ShareKeyModal
          digitalKey={selectedKey}
          onClose={() => setShowShareModal(false)}
          onSubmit={(formData) => handleShareKey(selectedKey._id, formData)}
          isLoading={shareKeyMutation.isPending}
        />
      )}

      {showLogsModal && selectedKey && (
        <KeyLogsModal
          digitalKey={selectedKey}
          onClose={() => setShowLogsModal(false)}
        />
      )}

      {/* Revoke Key Confirmation Dialog */}
      {confirmRevokeKeyId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-key-title">
          <Card className="max-w-md w-full p-6">
            <h3 id="revoke-key-title" className="text-lg font-semibold text-gray-900 mb-2">Revoke Digital Key</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to revoke this key? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmRevokeKeyId(null)}>Cancel</Button>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={confirmRevokeKeyAction}>
                <Trash2 className="w-4 h-4 mr-1" /> Revoke Key
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Revoke Share Confirmation Dialog */}
      {confirmRevokeShare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-share-title">
          <Card className="max-w-md w-full p-6">
            <h3 id="revoke-share-title" className="text-lg font-semibold text-gray-900 mb-2">Revoke Shared Access</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to revoke access for this user?</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirmRevokeShare(null)}>Cancel</Button>
              <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={confirmRevokeShareAction}>
                Revoke Access
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

interface QRCodeDisplayProps {
  qrCode: string;
  keyId: string;
}

function QRCodeDisplay({ qrCode, keyId }: QRCodeDisplayProps) {
  try {
    // Try to use the qrCode data URL directly if it's already generated
    if (qrCode.startsWith('data:image/')) {
      return (
        <img 
          src={qrCode} 
          alt={`QR Code for key ${keyId}`}
          className="w-30 h-30 border border-gray-200 rounded"
        />
      );
    }
    
    // Fallback to generating QR code with error handling
    return (
      <div className="w-30 h-30 flex items-center justify-center border border-gray-200 rounded bg-gray-50">
        <QRCode
          value={qrCode.length > 200 ? qrCode.substring(0, 200) : qrCode}
          size={120}
          level="L" // Use lowest error correction for maximum data capacity
          includeMargin={true}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="w-30 h-30 flex items-center justify-center border border-gray-200 rounded bg-gray-100">
        <div className="text-center p-2">
          <QrCode className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <span className="text-xs text-gray-500">QR Code</span>
        </div>
      </div>
    );
  }
}

interface KeyCardProps {
  digitalKey: DigitalKey;
  onViewDetails: () => void;
  onShare: () => void;
  onRevoke: () => void;
  onViewLogs: () => void;
  onCopyCode: () => void;
  onDownloadQR: () => void;
}

function KeyCard({
  digitalKey,
  onViewDetails,
  onShare,
  onRevoke,
  onViewLogs,
  onCopyCode,
  onDownloadQR
}: KeyCardProps) {
  const navigate = useNavigate();
  const typeInfo = digitalKeyService.getKeyTypeInfo(digitalKey.type);
  const statusInfo = digitalKeyService.getStatusInfo(digitalKey.status);
  const expirationStatus = digitalKeyService.getExpirationStatus(digitalKey);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-2xl">{typeInfo.icon}</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Room {digitalKey.roomId?.number ?? '—'}
              </h3>
              <p className="text-sm text-gray-600">{digitalKey.hotelId?.name ?? '—'}</p>
              {digitalKey.bookingId && (
                <p className="text-xs text-gray-500">
                  Booking #{digitalKey.bookingId.bookingNumber} • {formatDate(digitalKey.bookingId.checkIn)} - {formatDate(digitalKey.bookingId.checkOut)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">Key Code</p>
              <p className="font-mono text-sm font-medium">{digitalKey.keyCode}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Valid Until</p>
              <p className="text-sm font-medium">
                {new Date(digitalKey.validUntil).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Uses</p>
              <p className="text-sm font-medium">
                {digitalKey.currentUses} / {digitalKeyService.formatRemainingUses(digitalKey.remainingUses)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Shared</p>
              <p className="text-sm font-medium">
                {(digitalKey.sharedWith ?? []).filter(s => s.isActive).length} users
              </p>
            </div>
          </div>

          {expirationStatus === 'expiring' && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-sm text-yellow-800">
                  This key expires in less than 24 hours
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
              className="flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Details
            </Button>
            {digitalKey.bookingId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/app/bookings')}
                className="flex items-center gap-2 text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                <Calendar className="w-4 h-4" />
                View Booking
              </Button>
            )}
            {digitalKeyService.canShareKey(digitalKey) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onShare}
                className="flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onViewLogs}
              className="flex items-center gap-2"
            >
              <History className="w-4 h-4" />
              Logs
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onCopyCode}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownloadQR}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download QR
            </Button>
            {digitalKeyService.canRevokeKey(digitalKey) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRevoke}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Revoke
              </Button>
            )}
          </div>
        </div>

        <div className="ml-6">
          <div id={`qr-${digitalKey._id}`}>
            <QRCodeDisplay qrCode={digitalKey.qrCode} keyId={digitalKey._id} />
          </div>
        </div>
      </div>
    </Card>
  );
}

interface SharedKeyCardProps {
  digitalKey: DigitalKey;
  onViewDetails: () => void;
}

function SharedKeyCard({ digitalKey, onViewDetails }: SharedKeyCardProps) {
  const typeInfo = digitalKeyService.getKeyTypeInfo(digitalKey.type);
  const statusInfo = digitalKeyService.getStatusInfo(digitalKey.status);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{typeInfo.icon}</div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Room {digitalKey.roomId?.number ?? '—'}
            </h3>
            <p className="text-sm text-gray-600">{digitalKey.hotelId?.name ?? '—'}</p>
            <p className="text-xs text-gray-500">
              Shared by {typeof digitalKey.userId === 'object' ? digitalKey.userId.name || digitalKey.userId.email || 'Unknown' : 'Unknown'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const displayValue = Number.isFinite(value) ? value : 0;
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{displayValue}</p>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </Card>
  );
}

interface GenerateKeyModalProps {
  onClose: () => void;
  onSubmit: (data: GenerateKeyRequest) => void;
  isLoading: boolean;
}

function GenerateKeyModal({ onClose, onSubmit, isLoading }: GenerateKeyModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<GenerateKeyRequest>({
    bookingId: '',
    type: 'primary',
    maxUses: -1,
    securitySettings: {
      requirePin: false,
      allowSharing: true,
      maxSharedUsers: 5,
      requireApproval: false
    }
  });

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Fetch eligible bookings for key generation
  const { data: bookingsData, isLoading: bookingsLoading, error: bookingsError } = useQuery({
    queryKey: ['eligible-bookings-for-keys'],
    queryFn: async () => {
      // Use server-side filter for confirmed/checked_in status to avoid unbounded fetch
      const response = await bookingService.getUserBookings({ status: 'confirmed,checked_in', limit: 20, page: 1 });
      const bookingsData = response.data?.bookings || response.data || [];
      // Filter out expired checkout dates (server returns status-matched only)
      return Array.isArray(bookingsData) ? bookingsData.filter((booking: Booking) =>
        new Date(booking.checkOut) > new Date()
      ) : [];
    },
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });

  // Show toast when bookings fail to load
  React.useEffect(() => {
    if (bookingsError) toast.error('Failed to load bookings');
  }, [bookingsError]);

  const handleBookingSelect = (bookingId: string) => {
    const booking = bookingsData?.find((b: Booking) => b._id === bookingId);
    setSelectedBooking(booking || null);
    setFormData(prev => ({ ...prev, bookingId }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.bookingId) {
      toast.error('Please select a booking');
      return;
    }
    
    if (!selectedBooking) {
      toast.error('Invalid booking selection');
      return;
    }
    
    // Additional validation for booking eligibility
    if (!['confirmed', 'checked_in'].includes(selectedBooking.status)) {
      toast.error('Only confirmed or checked-in bookings are eligible for key generation');
      return;
    }
    
    if (new Date(selectedBooking.checkOut) <= new Date()) {
      toast.error('Cannot generate keys for expired bookings');
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Generate Digital Key" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Generate Digital Key</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Booking
            </label>
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-4">
                <LoadingSpinner />
                <span className="ml-2 text-sm text-gray-600">Loading bookings...</span>
              </div>
            ) : bookingsError ? (
              <div className="text-center py-4 text-red-500">
                <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
                <p className="text-sm">Failed to load bookings</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => queryClient.invalidateQueries({ queryKey: ['eligible-bookings-for-keys'] })}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            ) : bookingsData && bookingsData.length > 0 ? (
              <select
                value={formData.bookingId}
                onChange={(e) => handleBookingSelect(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select a booking...</option>
                {bookingsData.map((booking: Booking) => (
                  <option key={booking._id} value={booking._id}>
                    {booking.bookingNumber} - Room {booking.rooms[0]?.roomId?.roomNumber || 'N/A'} 
                    ({formatDate(booking.checkIn)} to {formatDate(booking.checkOut)})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>No eligible bookings found</p>
                <p className="text-xs mt-1 mb-3">You need confirmed bookings to generate digital keys</p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/app/bookings')}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  View My Bookings
                </Button>
              </div>
            )}
          </div>

          {/* Show selected booking details */}
          {selectedBooking && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="font-medium text-blue-900 mb-2">Selected Booking</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Booking:</strong> {selectedBooking.bookingNumber}</p>
                <p><strong>Room:</strong> {selectedBooking.rooms[0]?.roomId?.roomNumber || 'N/A'} - {selectedBooking.rooms[0]?.roomId?.type || 'Standard'}</p>
                <p><strong>Dates:</strong> {formatDate(selectedBooking.checkIn)} to {formatDate(selectedBooking.checkOut)}</p>
                <p><strong>Status:</strong> <span className="capitalize">{selectedBooking.status}</span></p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Key Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as string }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="primary">Primary</option>
              <option value="temporary">Temporary</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Uses (-1 for unlimited)
            </label>
            <Input
              type="number"
              value={formData.maxUses}
              onChange={(e) => setFormData(prev => ({ ...prev, maxUses: parseInt(e.target.value) }))}
              min="-1"
            />
          </div>
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.bookingId || !selectedBooking || bookingsLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating Key...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Generate Key
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface ShareKeyModalProps {
  digitalKey: DigitalKey;
  onClose: () => void;
  onSubmit: (data: ShareKeyRequest) => void;
  isLoading: boolean;
}

function ShareKeyModal({ digitalKey, onClose, onSubmit, isLoading }: ShareKeyModalProps) {
  const [formData, setFormData] = useState<ShareKeyRequest>({
    email: '',
    name: '',
    expiresAt: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Share Digital Key" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">Share Digital Key</h2>
        <p className="text-sm text-gray-600 mb-4">
          Share access to Room {digitalKey.roomId?.number ?? '—'} with another person.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter email address"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter full name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expires At (Optional)
            </label>
            <Input
              type="datetime-local"
              value={formData.expiresAt}
              onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
            />
          </div>
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Sharing...' : 'Share Key'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface KeyLogsModalProps {
  digitalKey: DigitalKey;
  onClose: () => void;
}

function KeyLogsModal({ digitalKey, onClose }: KeyLogsModalProps) {
  const { data: logsData, isLoading } = useQuery({
    queryKey: ['key-logs', digitalKey._id],
    queryFn: () => digitalKeyService.getKeyLogs(digitalKey._id)
  });

  return (
    <div role="dialog" aria-modal="true" aria-label="Access Logs" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Access Logs</h2>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Activity history for Room {digitalKey.roomId?.number ?? '—'}
        </p>
        
        {isLoading ? (
          <LoadingSpinner />
        ) : logsData?.logs && logsData.logs.length > 0 ? (
          <div className="space-y-3">
            {logsData.logs.map((log, index) => {
              const actionInfo = digitalKeyService.getActionInfo(log.action);
              return (
                <div key={`logs-${index}`} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className={`p-2 rounded-full ${actionInfo.color}`}>
                    <span className="text-lg">{actionInfo.icon}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{actionInfo.label}</p>
                    <p className="text-sm text-gray-600">
                      {digitalKeyService.formatTimeAgo(log.timestamp)}
                    </p>
                    {log.deviceInfo && (
                      <p className="text-xs text-gray-500">
                        {log.deviceInfo.ipAddress} • {log.deviceInfo.userAgent}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No access logs yet</h3>
            <p className="text-gray-600">
              Activity for this key will be recorded here.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}


export default withErrorBoundary(DigitalKeysDashboard, { level: 'page' });