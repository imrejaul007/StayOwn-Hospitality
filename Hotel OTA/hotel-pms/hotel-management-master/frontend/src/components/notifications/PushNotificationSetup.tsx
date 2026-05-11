import React, { useState, useEffect } from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Switch } from '../ui/switch';
import { pushNotificationService } from '../../services/pushNotificationService';
import { notificationService } from '../../services/notificationService';
import toast from 'react-hot-toast';

interface PushNotificationSetupProps {
  onSetupComplete?: (enabled: boolean) => void;
  showAdvancedSettings?: boolean;
}

export const PushNotificationSetup: React.FC<PushNotificationSetupProps> = ({
  onSetupComplete,
  showAdvancedSettings = false
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);

  useEffect(() => {
    checkPushSupport();
    checkSubscriptionStatus();
  }, []);

  const checkPushSupport = () => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const subscribed = await pushNotificationService.isSubscribed();
      setIsSubscribed(subscribed);
    } catch {
      // Error handled silently
    }
  };

  const handleEnablePushNotifications = async () => {
    if (!isSupported) {
      toast.error('Push notifications are not supported in this browser');
      return;
    }

    setIsLoading(true);
    try {
      // Initialize push service and request permission
      const initialized = await pushNotificationService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize push notifications');
      }

      // Subscribe to push notifications
      const subscription = await pushNotificationService.subscribe();
      if (!subscription) {
        throw new Error('Failed to subscribe to push notifications');
      }

      // Update user preferences with push token
      await notificationService.updatePreferences({
        channel: 'push',
        settings: {
          enabled: true,
          token: subscription
        }
      });

      setIsSubscribed(true);
      setPermission(Notification.permission);
      toast.success('Push notifications enabled successfully!');
      
      onSetupComplete?.(true);
    } catch (error) {
      toast.error('Failed to enable push notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisablePushNotifications = async () => {
    setIsLoading(true);
    try {
      // Unsubscribe from push notifications
      const unsubscribed = await pushNotificationService.unsubscribe();
      if (unsubscribed) {
        // Update user preferences
        await notificationService.updatePreferences({
          channel: 'push',
          settings: {
            enabled: false,
            token: ''
          }
        });

        setIsSubscribed(false);
        toast.success('Push notifications disabled');
        onSetupComplete?.(false);
      } else {
        toast.error('Failed to disable push notifications');
      }
    } catch (error) {
      toast.error('Failed to disable push notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!isSubscribed) {
      toast.error('Please enable push notifications first');
      return;
    }

    setIsTestingNotification(true);
    try {
      // Send a test notification through the API
      await notificationService.sendTestNotification({
        channel: 'push',
        type: 'system_alert'
      });

      // Also show a local notification for immediate feedback
      pushNotificationService.showLocalNotification(
        'Test Notification',
        {
          body: 'This is a test notification from PENTOUZ Hotel!',
          icon: '/icons/icon-192x192.png',
          tag: 'test-notification'
        }
      );

      toast.success('Test notification sent!');
    } catch (error) {
      toast.error('Failed to send test notification');
    } finally {
      setIsTestingNotification(false);
    }
  };

  const getStatusIcon = () => {
    if (!isSupported) {
      return <AlertCircle className="h-6 w-6 text-red-500" />;
    }
    
    if (isSubscribed && permission === 'granted') {
      return <CheckCircle className="h-6 w-6 text-green-500" />;
    }
    
    if (permission === 'denied') {
      return <BellOff className="h-6 w-6 text-red-500" />;
    }
    
    return <Bell className="h-6 w-6 text-gray-500" />;
  };

  const getStatusText = () => {
    if (!isSupported) {
      return 'Not supported in this browser';
    }
    
    if (isSubscribed && permission === 'granted') {
      return 'Push notifications are enabled';
    }
    
    if (permission === 'denied') {
      return 'Push notifications are blocked';
    }
    
    if (permission === 'granted' && !isSubscribed) {
      return 'Permission granted, not subscribed';
    }
    
    return 'Push notifications are disabled';
  };

  const getStatusColor = () => {
    if (!isSupported || permission === 'denied') {
      return 'text-red-600';
    }
    
    if (isSubscribed && permission === 'granted') {
      return 'text-green-600';
    }
    
    return 'text-gray-600';
  };

  if (!isSupported) {
    return (
      <Card className="p-6">
        <div className="flex items-center space-x-3">
          <AlertCircle className="h-6 w-6 text-red-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Push Notifications Not Supported
            </h3>
            <p className="text-sm text-gray-600">
              Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Status Section */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Push Notifications
              </h3>
              <p className={`text-sm ${getStatusColor()}`}>
                {getStatusText()}
              </p>
            </div>
          </div>
          
          <Switch
            checked={isSubscribed && permission === 'granted'}
            onCheckedChange={isSubscribed ? handleDisablePushNotifications : handleEnablePushNotifications}
            disabled={isLoading || permission === 'denied'}
            className="data-[state=checked]:bg-blue-600"
          />
        </div>

        {/* Description */}
        <div className="text-sm text-gray-600">
          <p>
            Enable push notifications to receive real-time updates about your bookings, 
            service reminders, and special offers even when you're not using the app.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          {!isSubscribed && permission !== 'denied' && (
            <Button
              onClick={handleEnablePushNotifications}
              disabled={isLoading}
              className="flex items-center space-x-2"
            >
              <Bell className="h-4 w-4" />
              <span>{isLoading ? 'Enabling...' : 'Enable Notifications'}</span>
            </Button>
          )}

          {isSubscribed && (
            <Button
              variant="outline"
              onClick={handleTestNotification}
              disabled={isTestingNotification}
              className="flex items-center space-x-2"
            >
              <Settings className="h-4 w-4" />
              <span>{isTestingNotification ? 'Sending...' : 'Test Notification'}</span>
            </Button>
          )}
        </div>

        {/* Browser Permission Blocked Warning */}
        {permission === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-red-800">
                  Notifications Blocked
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  You've blocked notifications for this site. To enable them:
                </p>
                <ol className="list-decimal list-inside text-sm text-red-700 mt-2 space-y-1">
                  <li>Click the lock icon in your browser's address bar</li>
                  <li>Change notifications from "Block" to "Allow"</li>
                  <li>Refresh this page and try again</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Settings */}
        {showAdvancedSettings && isSubscribed && (
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Advanced Settings</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Browser:</span>
                <span className="text-gray-900">{navigator.userAgent.split(' ')[0]}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Permission:</span>
                <span className={`capitalize ${permission === 'granted' ? 'text-green-600' : 'text-red-600'}`}>
                  {permission}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Service Worker:</span>
                <span className="text-green-600">Active</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};