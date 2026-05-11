import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/utils/toast';
import {
  Bell,
  BellRing,
  X,
  Check,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  User,
  Bed,
  Settings,
  IndianRupee,
  UserCheck,
  UserX,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Volume2,
  VolumeX
} from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'urgent';
  category: 'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'guest_request' | 'payment' | 'system';
  timestamp: Date;
  isRead: boolean;
  isNew: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionRequired?: boolean;
  relatedData?: {
    roomNumber?: string;
    guestName?: string;
    bookingId?: string;
    staffMember?: string;
  };
  actions?: {
    label: string;
    action: () => void;
    variant?: 'default' | 'secondary' | 'destructive';
  }[];
}

interface NotificationSystemProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
  autoRemoveDelay?: number;
  soundEnabled?: boolean;
  className?: string;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({
  position = 'top-right',
  maxNotifications = 5,
  autoRemoveDelay = 5000,
  soundEnabled = true,
  className = ''
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(soundEnabled);
  const [filter, setFilter] = useState<string>('all');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev.slice(0, maxNotifications - 1)]);
    
    // Play sound if enabled
    if (soundsEnabled && notification.priority === 'critical') {
      playNotificationSound();
    }
    
    // Show toast for high priority notifications
    if (notification.priority === 'high' || notification.priority === 'critical') {
      toast.error(notification.title, {
        description: notification.message,
        duration: autoRemoveDelay
      });
    }

    // Auto-remove non-critical notifications
    if (notification.priority !== 'critical' && autoRemoveDelay > 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        removeNotification(notification.id);
      }, autoRemoveDelay);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true, isNew: false } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, isRead: true, isNew: false }))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((error) => {
        // Silently handle audio play failures (user interaction required)
        if (error.name !== 'NotAllowedError') {
        }
      });
    }
  };

  const getNotificationIcon = (type: string, category: string) => {
    const icons = {
      checkin: <UserCheck className="w-4 h-4" />,
      checkout: <UserX className="w-4 h-4" />,
      housekeeping: <Bed className="w-4 h-4" />,
      maintenance: <Settings className="w-4 h-4" />,
      guest_request: <MessageSquare className="w-4 h-4" />,
      payment: <IndianRupee className="w-4 h-4" />,
      system: <Info className="w-4 h-4" />
    };
    return icons[category as keyof typeof icons] || <Bell className="w-4 h-4" />;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      info: 'text-blue-600 bg-blue-50 border-blue-200',
      success: 'text-green-600 bg-green-50 border-green-200',
      warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      error: 'text-red-600 bg-red-50 border-red-200',
      urgent: 'text-purple-600 bg-purple-50 border-purple-200'
    };
    return colors[type as keyof typeof colors] || colors.info;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      critical: 'bg-red-100 text-red-600 animate-pulse'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getPositionClasses = () => {
    const base = 'fixed z-50';
    switch (position) {
      case 'top-right': return `${base} top-4 right-4`;
      case 'top-left': return `${base} top-4 left-4`;
      case 'bottom-right': return `${base} bottom-4 right-4`;
      case 'bottom-left': return `${base} bottom-4 left-4`;
      default: return `${base} top-4 right-4`;
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const criticalCount = notifications.filter(n => n.priority === 'critical' && !n.isRead).length;
  
  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.category === filter);

  return (
    <div className={`${getPositionClasses()} ${className}`}>
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/notification.mp3" type="audio/mpeg" />
      </audio>

      {!isExpanded ? (
        <Button
          onClick={() => setIsExpanded(true)}
          className={`
            h-12 w-12 rounded-full shadow-lg relative
            ${criticalCount > 0 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-blue-500 hover:bg-blue-600'
            }
          `}
        >
          {criticalCount > 0 ? (
            <BellRing className="w-6 h-6 text-white" />
          ) : (
            <Bell className="w-6 h-6 text-white" />
          )}
          
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-red-500">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      ) : (
        <Card className="w-96 shadow-xl max-h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-500" />
                <CardTitle className="text-base">Notifications</CardTitle>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSoundsEnabled(!soundsEnabled)}
                  className="h-6 w-6 p-0"
                >
                  {soundsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(false)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex justify-between items-center text-xs">
              <div className="flex gap-1">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                  className="h-6 px-2 text-xs"
                >
                  All
                </Button>
                <Button
                  variant={filter === 'maintenance' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('maintenance')}
                  className="h-6 px-2 text-xs"
                >
                  Maintenance
                </Button>
                <Button
                  variant={filter === 'payment' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('payment')}
                  className="h-6 px-2 text-xs"
                >
                  Payments
                </Button>
              </div>
              
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="h-6 px-2 text-xs"
                  disabled={unreadCount === 0}
                >
                  Mark all read
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-6 px-2 text-xs text-red-600"
                  disabled={notifications.length === 0}
                >
                  Clear all
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {filteredNotifications.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <div role="button" tabIndex={0}
                      key={notification.id}
                      className={`
                        relative rounded-lg border p-3 cursor-pointer transition-colors
                        ${getTypeColor(notification.type)}
                        ${notification.isNew ? 'ring-2 ring-blue-400' : ''}
                        ${!notification.isRead ? 'border-l-4' : 'opacity-75'}
                      `}
                      onClick={() => markAsRead(notification.id)}
                     onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => markAsRead(notification.id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type, notification.category)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {notification.title}
                            </span>
                            <Badge 
                              className={`text-xs px-1.5 py-0.5 ${getPriorityColor(notification.priority)}`}
                            >
                              {notification.priority}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2">
                            {notification.message}
                          </p>
                          
                          {notification.relatedData && (
                            <div className="flex gap-2 text-xs text-gray-600 mb-2">
                              {notification.relatedData.roomNumber && (
                                <span>Room: {notification.relatedData.roomNumber}</span>
                              )}
                              {notification.relatedData.guestName && (
                                <span>Guest: {notification.relatedData.guestName}</span>
                              )}
                            </div>
                          )}
                          
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {notification.timestamp.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex gap-1">
                                {notification.actions.map((action, index) => (
                                  <Button
                                    key={`notification-actions-${index}-${action.label}`}
                                    variant={action.variant || 'default'}
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      action.action();
                                      markAsRead(notification.id);
                                    }}
                                    className="h-6 px-2 text-xs"
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationSystem;