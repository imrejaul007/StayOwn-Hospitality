import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Settings,
  Shield,
  Zap,
  CheckCircle,
  AlertTriangle,
  Calendar,
  CreditCard,
  Tool,
  Home,
  Package,
  UserCheck,
  BarChart,
  Users
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import { useBrowserNotifications } from '../../hooks/useBrowserNotifications';
import toast from 'react-hot-toast';

interface NotificationPreferencesProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationType {
  type: string;
  label: string;
  description: string;
  category: string;
  priority: string;
  channels: string[];
  defaultEnabled: boolean;
}

interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  supportsQuietHours: boolean;
  supportsFrequency: boolean;
  instantDelivery: boolean;
  supportedPriorities: string[];
  recommended?: boolean;
}

interface NotificationPreference {
  email: {
    enabled: boolean;
    address: string;
    frequency: string;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    types: Record<string, boolean>;
  };
  sms: {
    enabled: boolean;
    number: string;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    types: Record<string, boolean>;
  };
  push: {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    types: Record<string, boolean>;
  };
  in_app: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
    types: Record<string, boolean>;
  };
}

export default function NotificationPreferences({ isOpen, onClose }: NotificationPreferencesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const browserNotifications = useBrowserNotifications();
  const [activeTab, setActiveTab] = useState('channels');
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  // Fetch notification types for user's role
  const { data: notificationData, isLoading: isLoadingTypes } = useQuery({
    queryKey: ['notification-types', user?.role],
    queryFn: () => notificationService.getNotificationTypes(),
    enabled: isOpen
  });

  // Fetch notification channels
  const { data: channelData, isLoading: isLoadingChannels } = useQuery({
    queryKey: ['notification-channels', user?.role],
    queryFn: () => notificationService.getNotificationChannels(),
    enabled: isOpen
  });

  // Fetch current preferences
  const { data: preferences, isLoading: isLoadingPreferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationService.getNotificationPreferences(),
    enabled: isOpen
  });

  // Local state for form
  const [formData, setFormData] = useState<Partial<NotificationPreference>>({});

  useEffect(() => {
    if (preferences?.preferences) {
      setFormData(preferences.preferences);
    }
  }, [preferences]);

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: (data: { channel: string; settings: Record<string, unknown> }) =>
      notificationService.updateNotificationPreferences(data.channel, data.settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Preferences updated successfully');
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update preferences');
    }
  });

  // Send test notification mutation
  const testNotificationMutation = useMutation({
    mutationFn: (data: { channel: string; type?: string }) =>
      notificationService.sendTestNotification({ channel: data.channel, type: data.type }),
    onSuccess: () => {
      toast.success('Test notification sent!');
      setTestingChannel(null);
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send test notification');
      setTestingChannel(null);
    }
  });

  const handleChannelToggle = async (channel: string, enabled: boolean) => {
    const updatedSettings = {
      ...formData[channel as keyof NotificationPreference],
      enabled
    };

    // For push notifications, handle browser permission
    if (channel === 'push' && enabled && !browserNotifications.hasPermission) {
      try {
        const permission = await browserNotifications.requestPermission();
        if (permission !== 'granted') {
          toast.error('Browser notification permission is required');
          return;
        }
      } catch (error) {
        toast.error('Failed to request notification permission');
        return;
      }
    }

    setFormData(prev => ({
      ...prev,
      [channel]: updatedSettings
    }));

    updatePreferencesMutation.mutate({
      channel,
      settings: updatedSettings
    });
  };

  const handleTypeToggle = (channel: string, type: string, enabled: boolean) => {
    const channelSettings = formData[channel as keyof NotificationPreference];
    if (!channelSettings) return;

    const updatedSettings = {
      ...channelSettings,
      types: {
        ...channelSettings.types,
        [type]: enabled
      }
    };

    setFormData(prev => ({
      ...prev,
      [channel]: updatedSettings
    }));

    updatePreferencesMutation.mutate({
      channel,
      settings: updatedSettings
    });
  };

  const handleQuietHoursToggle = (channel: string, enabled: boolean) => {
    const channelSettings = formData[channel as keyof NotificationPreference];
    if (!channelSettings || !('quietHours' in channelSettings)) return;

    const updatedSettings = {
      ...channelSettings,
      quietHours: {
        ...channelSettings.quietHours,
        enabled
      }
    };

    setFormData(prev => ({
      ...prev,
      [channel]: updatedSettings
    }));

    updatePreferencesMutation.mutate({
      channel,
      settings: updatedSettings
    });
  };

  const handleTestNotification = (channel: string) => {
    setTestingChannel(channel);
    testNotificationMutation.mutate({ channel });
  };

  const getChannelIcon = (channelId: string) => {
    const icons = {
      email: Mail,
      sms: MessageSquare,
      push: Bell,
      in_app: Smartphone
    };
    return icons[channelId as keyof typeof icons] || Bell;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      booking: Calendar,
      payment: CreditCard,
      operations: Settings,
      maintenance: Tool,
      housekeeping: Home,
      inventory: Package,
      guest_service: UserCheck,
      emergency: AlertTriangle,
      security: Shield,
      system: Zap,
      analytics: BarChart,
      staff: Users
    };
    return icons[category as keyof typeof icons] || Bell;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoadingTypes || isLoadingChannels || isLoadingPreferences) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const notificationTypes = notificationData?.data?.notificationTypes || [];
  const channels = channelData?.data?.channels || [];
  const categories = [...new Set(notificationTypes.map((type: NotificationType) => type.category))];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Preferences
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Customize how and when you receive notifications for {user?.role} activities
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="types">Types</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Notification Channels Tab */}
          <TabsContent value="channels" className="space-y-6">
            <div className="space-y-4">
              {channels.map((channel: NotificationChannel) => {
                const Icon = getChannelIcon(channel.id);
                const channelSettings = formData[channel.id as keyof NotificationPreference];
                const isEnabled = channelSettings?.enabled ?? channel.defaultEnabled;

                return (
                  <Card key={channel.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-gray-600" />
                          <div>
                            <CardTitle className="text-base">{channel.name}</CardTitle>
                            <CardDescription>{channel.description}</CardDescription>
                          </div>
                          {channel.recommended && (
                            <Badge variant="secondary">Recommended</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestNotification(channel.id)}
                            disabled={!isEnabled || testingChannel === channel.id}
                          >
                            {testingChannel === channel.id ? 'Testing...' : 'Test'}
                          </Button>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={(enabled) => handleChannelToggle(channel.id, enabled)}
                            disabled={updatePreferencesMutation.isLoading}
                          />
                        </div>
                      </div>
                    </CardHeader>

                    {isEnabled && (
                      <CardContent className="pt-0 space-y-4">
                        {/* Channel-specific settings */}
                        {channel.id === 'push' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Browser Permission</Label>
                              <div className="flex items-center gap-2">
                                {browserNotifications.hasPermission ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                                )}
                                <span className="text-sm text-gray-600">
                                  {browserNotifications.hasPermission ? 'Granted' : 'Required'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <Label>Sound</Label>
                              <Switch
                                checked={channelSettings?.sound ?? true}
                                onCheckedChange={(sound) => {
                                  const updatedSettings = { ...channelSettings, sound };
                                  setFormData(prev => ({ ...prev, [channel.id]: updatedSettings }));
                                  updatePreferencesMutation.mutate({ channel: channel.id, settings: updatedSettings });
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Quiet Hours */}
                        {channel.supportsQuietHours && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Quiet Hours
                              </Label>
                              <Switch
                                checked={channelSettings?.quietHours?.enabled ?? false}
                                onCheckedChange={(enabled) => handleQuietHoursToggle(channel.id, enabled)}
                              />
                            </div>

                            {channelSettings?.quietHours?.enabled && (
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm">From</Label>
                                  <Input
                                    type="time"
                                    value={channelSettings.quietHours.start || '22:00'}
                                    onChange={(e) => {
                                      const updatedSettings = {
                                        ...channelSettings,
                                        quietHours: {
                                          ...channelSettings.quietHours,
                                          start: e.target.value
                                        }
                                      };
                                      setFormData(prev => ({ ...prev, [channel.id]: updatedSettings }));
                                    }}
                                    className="text-sm"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">To</Label>
                                  <Input
                                    type="time"
                                    value={channelSettings.quietHours.end || '07:00'}
                                    onChange={(e) => {
                                      const updatedSettings = {
                                        ...channelSettings,
                                        quietHours: {
                                          ...channelSettings.quietHours,
                                          end: e.target.value
                                        }
                                      };
                                      setFormData(prev => ({ ...prev, [channel.id]: updatedSettings }));
                                    }}
                                    className="text-sm"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Supported Priorities */}
                        <div>
                          <Label className="text-sm text-gray-600">Supported Priorities</Label>
                          <div className="flex gap-2 mt-1">
                            {channel.supportedPriorities.map((priority) => (
                              <Badge key={priority} className={getPriorityColor(priority)}>
                                {priority}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Notification Types Tab */}
          <TabsContent value="types" className="space-y-6">
            <div className="space-y-6">
              {categories.map((category) => {
                const categoryTypes = notificationTypes.filter((type: NotificationType) => type.category === category);

                return (
                  <Card key={category}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {getCategoryIcon(category) && React.createElement(getCategoryIcon(category), { className: "h-4 w-4" })}
                        {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {categoryTypes.map((type: NotificationType) => (
                        <div key={type.type} className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Label className="text-sm font-medium">{type.label}</Label>
                                <Badge className={getPriorityColor(type.priority)}>
                                  {type.priority}
                                </Badge>
                              </div>
                              <p className="text-xs text-gray-600">{type.description}</p>
                            </div>
                          </div>

                          {/* Channel toggles for this type */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {channels
                              .filter((channel: NotificationChannel) =>
                                type.channels.includes(channel.id) &&
                                formData[channel.id as keyof NotificationPreference]?.enabled
                              )
                              .map((channel: NotificationChannel) => {
                                const channelSettings = formData[channel.id as keyof NotificationPreference];
                                const isTypeEnabled = channelSettings?.types?.[type.type] ?? type.defaultEnabled;

                                return (
                                  <div key={`${type.type}-${channel.id}`} className="flex items-center justify-between p-2 border rounded">
                                    <Label className="text-xs">{channel.name}</Label>
                                    <Switch
                                      size="sm"
                                      checked={isTypeEnabled}
                                      onCheckedChange={(enabled) => handleTypeToggle(channel.id, type.type, enabled)}
                                    />
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Schedule</CardTitle>
                <CardDescription>
                  Configure when you want to receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-gray-600">
                  Schedule settings are configured per channel in the Channels tab under "Quiet Hours".
                </div>

                {/* Summary of current quiet hours settings */}
                <div className="space-y-3">
                  {channels
                    .filter((channel: NotificationChannel) =>
                      channel.supportsQuietHours &&
                      formData[channel.id as keyof NotificationPreference]?.enabled
                    )
                    .map((channel: NotificationChannel) => {
                      const channelSettings = formData[channel.id as keyof NotificationPreference];
                      const quietHours = channelSettings?.quietHours;

                      return (
                        <div key={channel.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-2">
                            {React.createElement(getChannelIcon(channel.id), { className: "h-4 w-4" })}
                            <span className="font-medium">{channel.name}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {quietHours?.enabled
                              ? `Quiet: ${quietHours.start} - ${quietHours.end}`
                              : 'Always active'
                            }
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  Additional notification configuration options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Browser Notifications</Label>
                      <p className="text-xs text-gray-600">Show notifications when browser is not active</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {browserNotifications.isSupported ? 'Supported' : 'Not supported'}
                      </span>
                      {browserNotifications.isSupported && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={browserNotifications.requestPermission}
                          disabled={browserNotifications.hasPermission}
                        >
                          {browserNotifications.hasPermission ? 'Granted' : 'Request Permission'}
                        </Button>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label>Role-based Configuration</Label>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Current role: <Badge variant="secondary">{user?.role}</Badge></p>
                      <p>Available notification types: {notificationTypes.length}</p>
                      <p>Recommended channels: {channels.filter((c: NotificationChannel) => c.recommended).map((c: NotificationChannel) => c.name).join(', ')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}