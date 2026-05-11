// Admin Chat Page
// Guest chat management for hotel staff

import React, { Suspense } from 'react';
import StaffChatDashboardWeb from '@/components/chat/StaffChatDashboardWeb';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AdminChat() {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();

  if (userLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Card className="m-4">
        <CardContent className="p-8 text-center">
          <p className="text-gray-500">Please log in to access chat management.</p>
        </CardContent>
      </Card>
    );
  }

  const staffId = currentUser._id || currentUser.id || '';
  const staffName = currentUser.name || 'Staff';
  const department = (currentUser.department as 'front_desk' | 'concierge' | 'housekeeping' | 'room_service' | 'maintenance' | 'spa' | 'transport') || 'front_desk';
  const hotelId = currentUser.hotelId as string | undefined;

  return (
    <div className="h-full">
      <StaffChatDashboardWeb
        staffId={staffId}
        staffName={staffName}
        department={department}
        hotelId={hotelId}
        apiBaseUrl={import.meta.env.VITE_API_URL || 'http://localhost:3001'}
        socketUrl={import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'}
        onNotification={(title, body) => {
          // Can integrate with browser notifications here
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body });
          }
        }}
      />
    </div>
  );
}
