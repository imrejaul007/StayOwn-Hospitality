import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/utils/toast';
import {
  Smartphone, QrCode, Clock,
  Wifi, CheckCircle, User,
  Settings, Scan, Hand, Bell, RefreshCw,
  Key, ShieldCheck, XCircle, AlertTriangle, Loader2, Plus, Trash2
} from 'lucide-react';
import { digitalKeyService, DigitalKey, KeyStats } from '@/services/digitalKeyService';

// Interfaces for client-side-only tabs (Touch Control, Offline Mode)
interface TouchGesture {
  id: string;
  gesture: 'swipe_left' | 'swipe_right' | 'tap' | 'long_press';
  action: string;
  description: string;
  enabled: boolean;
}

interface MobileExperienceProps {}

export const MobileExperience: React.FC<MobileExperienceProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('devices');

  // Digital Keys tab state
  const [digitalKeys, setDigitalKeys] = useState<DigitalKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysError, setKeysError] = useState<string | null>(null);
  const [keysPage, setKeysPage] = useState(1);
  const [keysTotalPages, setKeysTotalPages] = useState(1);
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);

  // QR / Stats tab state
  const [keyStats, setKeyStats] = useState<KeyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Touch Control tab state (client-side only)
  const [touchGestures, setTouchGestures] = useState<TouchGesture[]>([]);

  // Offline Mode tab state (client-side only)
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(true);

  // Generate key dialog state
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateBookingId, setGenerateBookingId] = useState('');
  const [generateKeyType, setGenerateKeyType] = useState<'primary' | 'temporary' | 'emergency'>('primary');
  const [generating, setGenerating] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Initialize default gesture configuration (client-side settings)
  useEffect(() => {
    initializeDefaultGestures();
  }, []);

  // Fetch digital keys when dialog opens or page changes
  const fetchDigitalKeys = useCallback(async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const response = await digitalKeyService.getAdminKeys({ page: keysPage, limit: 20 });
      if (!isMountedRef.current) return;
      setDigitalKeys(response.keys);
      setKeysTotalPages(response.pagination.totalPages);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load digital keys';
      setKeysError(message);
    } finally {
      if (isMountedRef.current) setKeysLoading(false);
    }
  }, [keysPage]);

  // Fetch stats for the QR/stats tab
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const stats = await digitalKeyService.getStats();
      if (!isMountedRef.current) return;
      setKeyStats(stats);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load key statistics';
      setStatsError(message);
    } finally {
      if (isMountedRef.current) setStatsLoading(false);
    }
  }, []);

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchDigitalKeys();
      fetchStats();
    }
  }, [isOpen, fetchDigitalKeys, fetchStats]);

  // Generate a new key
  const handleGenerateKey = async () => {
    if (!generateBookingId.trim()) {
      toast.error('Please enter a booking ID');
      return;
    }
    setGenerating(true);
    try {
      await digitalKeyService.generateKey({
        bookingId: generateBookingId.trim(),
        type: generateKeyType,
      });
      toast.success('Digital key generated successfully');
      setGenerateDialogOpen(false);
      setGenerateBookingId('');
      setGenerateKeyType('primary');
      // Refresh both tabs
      fetchDigitalKeys();
      fetchStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate key';
      toast.error(message);
    } finally {
      if (isMountedRef.current) setGenerating(false);
    }
  };

  // Revoke a key
  const handleRevokeKey = async (keyId: string) => {
    setRevokingKeyId(keyId);
    try {
      await digitalKeyService.revokeKey(keyId);
      toast.success('Digital key revoked successfully');
      // Refresh both tabs
      fetchDigitalKeys();
      fetchStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to revoke key';
      toast.error(message);
    } finally {
      if (isMountedRef.current) setRevokingKeyId(null);
    }
  };

  const initializeDefaultGestures = () => {
    const gestures: TouchGesture[] = [
      {
        id: 'gesture-1',
        gesture: 'swipe_right',
        action: 'Mark room as clean',
        description: 'Swipe right on room to mark as cleaned',
        enabled: true
      },
      {
        id: 'gesture-2',
        gesture: 'swipe_left',
        action: 'Report maintenance issue',
        description: 'Swipe left to report maintenance',
        enabled: true
      },
      {
        id: 'gesture-3',
        gesture: 'long_press',
        action: 'Open room details',
        description: 'Long press for detailed room information',
        enabled: true
      },
      {
        id: 'gesture-4',
        gesture: 'tap',
        action: 'Quick check-in/out',
        description: 'Double tap for guest check-in/out',
        enabled: false
      }
    ];
    setTouchGestures(gestures);
  };

  const toggleGesture = (gestureId: string) => {
    setTouchGestures(prev => prev.map(gesture =>
      gesture.id === gestureId ? { ...gesture, enabled: !gesture.enabled } : gesture
    ));
  };

  const getKeyStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-red-100 text-red-800';
      case 'used': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getKeyTypeColor = (type: string) => {
    switch (type) {
      case 'primary': return 'bg-blue-100 text-blue-800';
      case 'temporary': return 'bg-yellow-100 text-yellow-800';
      case 'emergency': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityActionColor = (action: string) => {
    switch (action) {
      case 'generated': return 'bg-blue-100 text-blue-700';
      case 'accessed': return 'bg-green-100 text-green-700';
      case 'shared': return 'bg-purple-100 text-purple-700';
      case 'revoked': return 'bg-red-100 text-red-700';
      case 'expired': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Shared loading component
  const LoadingState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <Loader2 className="h-8 w-8 animate-spin mb-3 text-blue-500" />
      <p className="text-sm">{message}</p>
    </div>
  );

  // Shared error component
  const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <AlertTriangle className="h-8 w-8 mb-3 text-red-400" />
      <p className="text-sm text-red-600 mb-3">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </Button>
    </div>
  );

  // Shared empty component
  const EmptyState = ({ message, icon: Icon }: { message: string; icon: React.ElementType }) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <Icon className="h-10 w-10 mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-200 hover:from-cyan-100 hover:to-blue-100 transition-all duration-200"
        >
          <Smartphone className="h-4 w-4 mr-2 text-cyan-600" />
          Mobile Hub
          <Badge
            variant="secondary"
            className="ml-2 bg-gradient-to-r from-green-500 to-blue-500 text-white border-0"
          >
            Touch
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            Mobile Experience Hub
            <Badge className="bg-gradient-to-r from-green-500 to-cyan-500 text-white">
              Touch Optimized
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Mobile-first workflows with QR code scanning, touch gestures, and offline capabilities
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="devices" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Digital Keys
            </TabsTrigger>
            <TabsTrigger value="qr" className="flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              QR Scanning
            </TabsTrigger>
            <TabsTrigger value="gestures" className="flex items-center gap-2">
              <Hand className="h-4 w-4" />
              Touch Control
            </TabsTrigger>
            <TabsTrigger value="offline" className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              Offline Mode
            </TabsTrigger>
          </TabsList>

          {/* ===== DIGITAL KEYS TAB (API-backed) ===== */}
          <TabsContent value="devices" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Digital Keys</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGenerateDialogOpen(true)}
                  className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100"
                >
                  <Plus className="h-4 w-4 mr-2 text-green-600" />
                  Generate Key
                </Button>
                <Button
                  onClick={fetchDigitalKeys}
                  disabled={keysLoading}
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                >
                  {keysLoading ? (
                    <>
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Generate Key Dialog */}
            {generateDialogOpen && (
              <Card className="border-green-200 bg-green-50/30">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      Generate New Digital Key
                    </h4>
                    <Button variant="ghost" size="sm" onClick={() => setGenerateDialogOpen(false)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Booking ID</label>
                      <input
                        type="text"
                        value={generateBookingId}
                        onChange={(e) => setGenerateBookingId(e.target.value)}
                        placeholder="Enter booking ID"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Key Type</label>
                      <select
                        value={generateKeyType}
                        onChange={(e) => setGenerateKeyType(e.target.value as 'primary' | 'temporary' | 'emergency')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="primary">Primary</option>
                        <option value="temporary">Temporary</option>
                        <option value="emergency">Emergency</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={handleGenerateKey}
                        disabled={generating}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                      >
                        {generating ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Key className="h-4 w-4 mr-2" />
                            Generate
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Keys List */}
            {keysLoading && digitalKeys.length === 0 ? (
              <LoadingState message="Loading digital keys..." />
            ) : keysError ? (
              <ErrorState message={keysError} onRetry={fetchDigitalKeys} />
            ) : digitalKeys.length === 0 ? (
              <EmptyState message="No digital keys found. Generate a key to get started." icon={Key} />
            ) : (
              <>
                <div className="grid gap-4">
                  {digitalKeys.map((key) => (
                    <Card key={key._id} className="transition-all hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-gray-100">
                              <Key className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                              <h4 className="font-medium font-mono text-sm">{key.keyCode}</h4>
                              <p className="text-sm text-gray-600">
                                {key.roomId?.number ? `Room ${key.roomId.number}` : 'No room assigned'}
                                {key.bookingId?.bookingNumber && (
                                  <span className="text-gray-400 ml-2">
                                    (Booking #{key.bookingId.bookingNumber})
                                  </span>
                                )}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                <Badge className={getKeyStatusColor(key.status)}>
                                  {key.status.toUpperCase()}
                                </Badge>
                                <Badge variant="outline" className={getKeyTypeColor(key.type)}>
                                  {key.type.toUpperCase()}
                                </Badge>
                                {key.qrCode && (
                                  <QrCode className="h-4 w-4 text-purple-500" title="QR code available" />
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-6">
                            {/* Usage Info */}
                            <div className="text-right text-sm">
                              <div className="text-gray-500">
                                Uses: {key.currentUses}/{key.maxUses === -1 ? 'Unlimited' : key.maxUses}
                              </div>
                              {key.lastUsedAt && (
                                <div className="text-xs text-gray-400">
                                  Last used: {digitalKeyService.formatTimeAgo(key.lastUsedAt)}
                                </div>
                              )}
                              <div className="text-xs text-gray-400">
                                Expires: {new Date(key.validUntil).toLocaleDateString()}
                              </div>
                            </div>

                            {/* Shared users indicator */}
                            {key.sharedWith && key.sharedWith.length > 0 && (
                              <div className="flex items-center gap-1" title={`Shared with ${key.sharedWith.length} user(s)`}>
                                <User className="h-4 w-4 text-purple-500" />
                                <span className="text-xs text-purple-600">{key.sharedWith.length}</span>
                              </div>
                            )}

                            {/* Security indicator */}
                            {key.securitySettings?.requirePin && (
                              <ShieldCheck className="h-4 w-4 text-green-600" title="PIN required" />
                            )}

                            {/* Revoke button */}
                            {key.status === 'active' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokeKey(key._id)}
                                disabled={revokingKeyId === key._id}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Revoke key"
                              >
                                {revokingKeyId === key._id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 text-xs text-gray-500">
                          Created: {new Date(key.createdAt).toLocaleString()}
                          {key.hotelId?.name && (
                            <span className="ml-4">Hotel: {key.hotelId.name}</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination Controls */}
                {keysTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={keysPage <= 1 || keysLoading}
                      onClick={() => setKeysPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-gray-600">
                      Page {keysPage} of {keysTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={keysPage >= keysTotalPages || keysLoading}
                      onClick={() => setKeysPage(p => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ===== QR SCANNING / STATS TAB (API-backed) ===== */}
          <TabsContent value="qr" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Digital Key Statistics</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStats}
                disabled={statsLoading}
              >
                {statsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
            </div>

            {statsLoading && !keyStats ? (
              <LoadingState message="Loading key statistics..." />
            ) : statsError ? (
              <ErrorState message={statsError} onRetry={fetchStats} />
            ) : !keyStats ? (
              <EmptyState message="No statistics available" icon={QrCode} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Overview Cards */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scan className="h-5 w-5 text-blue-600" />
                      Key Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-900">Total Keys</span>
                        <span className="text-lg font-bold text-blue-700">{keyStats.totalKeys}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-green-900">Active Keys</span>
                        <span className="text-lg font-bold text-green-700">{keyStats.activeKeys}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">Expired Keys</span>
                        <span className="text-lg font-bold text-gray-700">{keyStats.expiredKeys}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-purple-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-purple-900">Shared Keys</span>
                        <span className="text-lg font-bold text-purple-700">{keyStats.sharedKeys}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-orange-50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-orange-900">Total Uses</span>
                        <span className="text-lg font-bold text-orange-700">{keyStats.totalUses}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-medium">Recent Activity</h4>
                  {keyStats.recentActivity && keyStats.recentActivity.length > 0 ? (
                    keyStats.recentActivity.map((activity, index) => (
                      <Card key={`${activity.keyId}-${index}`} className="transition-all hover:shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                activity.action === 'revoked' ? 'bg-red-100' :
                                activity.action === 'accessed' ? 'bg-green-100' :
                                activity.action === 'generated' ? 'bg-blue-100' :
                                activity.action === 'shared' ? 'bg-purple-100' :
                                'bg-gray-100'
                              }`}>
                                <Key className={`h-4 w-4 ${
                                  activity.action === 'revoked' ? 'text-red-600' :
                                  activity.action === 'accessed' ? 'text-green-600' :
                                  activity.action === 'generated' ? 'text-blue-600' :
                                  activity.action === 'shared' ? 'text-purple-600' :
                                  'text-gray-600'
                                }`} />
                              </div>
                              <div>
                                <h5 className="font-medium text-sm">Key {activity.keyId.slice(-8)}</h5>
                                <p className="text-xs text-gray-500">
                                  {digitalKeyService.formatTimeAgo(activity.timestamp)}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <Badge className={getActivityActionColor(activity.action)}>
                                {activity.action.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <Card className="bg-gray-50">
                      <CardContent className="p-6 text-center text-gray-400">
                        <Clock className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">No recent activity</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ===== TOUCH CONTROL TAB (client-side only) ===== */}
          <TabsContent value="gestures" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Touch Gesture Controls</h3>
              <Badge className="bg-blue-100 text-blue-700">
                {touchGestures.filter(g => g.enabled).length} Active Gestures
              </Badge>
            </div>

            <div className="grid gap-4">
              {touchGestures.map((gesture) => (
                <Card key={gesture.id} className={`transition-all ${
                  gesture.enabled ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-gray-100">
                          <Hand className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{gesture.action}</h4>
                          <p className="text-sm text-gray-600">{gesture.description}</p>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {gesture.gesture.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <Switch
                        checked={gesture.enabled}
                        onCheckedChange={() => toggleGesture(gesture.id)}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-900">Training Tip</span>
                </div>
                <p className="text-sm text-orange-800">
                  New staff members can enable "Gesture Guide" in settings to see visual hints for touch interactions during their first week.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== OFFLINE MODE TAB (client-side only) ===== */}
          <TabsContent value="offline" className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Offline Mode Configuration</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Enable Offline Mode</span>
                <Switch
                  checked={offlineModeEnabled}
                  onCheckedChange={setOfflineModeEnabled}
                />
              </div>
            </div>

            {offlineModeEnabled && (
              <div className="grid gap-6">
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Offline Capabilities
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Room status updates (cached locally)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">QR code scanning and identification</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Photo capture for maintenance reports</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Guest check-in/out processing</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Clock className="h-4 w-4 text-blue-600" />
                        Sync Schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Last sync:</span>
                          <span className="font-medium">2 minutes ago</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Next sync:</span>
                          <span className="font-medium">3 minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sync interval:</span>
                          <span className="font-medium">Every 5 minutes</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Settings className="h-4 w-4 text-purple-600" />
                        Storage Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Cache size:</span>
                          <span className="font-medium">12.4 MB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Photos stored:</span>
                          <span className="font-medium">8 files</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending sync:</span>
                          <span className="font-medium">3 items</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {!offlineModeEnabled && (
              <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
                <CardContent className="p-6 text-center">
                  <Wifi className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="font-medium text-gray-700 mb-2">Offline Mode Disabled</h4>
                  <p className="text-sm text-gray-600">
                    Enable offline mode to allow mobile devices to work without internet connectivity.
                    This is essential for housekeeping and maintenance staff working in areas with poor signal.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
