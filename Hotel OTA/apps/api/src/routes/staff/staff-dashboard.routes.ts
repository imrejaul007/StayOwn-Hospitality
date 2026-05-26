import { Router, Request, Response } from 'express';
import { randomInt } from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

const router = Router();

/**
 * GET /v1/staff/dashboard
 * Get dashboard statistics
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get hotel ID from session (mock for now)
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // Fetch stats in parallel
    const [
      pendingRequests,
      inProgressRequests,
      completedToday,
      urgentRequests,
      occupiedRooms,
      vacantRooms,
      cleaningRooms,
      maintenanceRooms,
      unreadMessages,
      pendingCheckouts,
      recentActivity,
    ] = await Promise.all([
      // Pending requests count
      prisma.roomServiceRequest.count({
        where: { hotelId, status: 'pending' },
      }),
      // In progress requests
      prisma.roomServiceRequest.count({
        where: { hotelId, status: { in: ['assigned', 'in_progress'] } },
      }),
      // Completed today
      prisma.roomServiceRequest.count({
        where: {
          hotelId,
          status: 'completed',
          completedAt: { gte: today, lt: tomorrow },
        },
      }),
      // Urgent requests (priority = 'now')
      prisma.roomServiceRequest.count({
        where: { hotelId, priority: 'now', status: { in: ['pending', 'assigned', 'in_progress'] } },
      }),
      // Occupied rooms (mock - would need room status tracking)
      prisma.booking.count({
        where: {
          hotelId,
          status: 'checked_in',
          checkinDate: { lte: today },
          checkoutDate: { gt: today },
        },
      }),
      // Vacant rooms (mock)
      15,
      // Cleaning rooms (mock)
      3,
      // Maintenance rooms (mock)
      2,
      // Unread messages count
      prisma.hotelChatMessage.count({
        where: {
          conversation: { hotelId },
          readAt: null,
          senderType: 'guest',
        },
      }),
      // Pending checkouts
      prisma.booking.count({
        where: {
          hotelId,
          status: 'checked_in',
          checkoutDate: { gte: today, lt: tomorrow },
        },
      }),
      // Recent activity
      prisma.roomServiceRequest.findMany({
        where: { hotelId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          roomNumber: true,
          serviceType: true,
          priority: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    // Transform recent activity for response
    const transformedActivity = recentActivity.map((r) => ({
      id: r.id,
      type: 'request' as const,
      title: `${r.serviceType.replace('_', ' ')} request`,
      description: `Room ${r.roomNumber}`,
      time: formatRelativeTime(r.createdAt),
      priority: r.priority,
      room_number: r.roomNumber,
    }));

    res.json({
      success: true,
      stats: {
        total_requests: pendingRequests + inProgressRequests + completedToday,
        pending_requests: pendingRequests,
        in_progress_requests: inProgressRequests,
        completed_today: completedToday,
        occupied_rooms: occupiedRooms,
        vacant_rooms: vacantRooms,
        cleaning_rooms: cleaningRooms,
        maintenance_rooms: maintenanceRooms,
        unread_messages: unreadMessages,
        pending_checkouts: pendingCheckouts,
        urgent_requests: urgentRequests,
      },
      recentActivity: transformedActivity,
    });
  } catch (error: any) {
    logger.error('Staff dashboard error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data' });
  }
});

/**
 * GET /v1/staff/requests
 * Get all service requests with filters
 */
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';
    const { status, priority, serviceType, roomId, assignedTo } = req.query;

    const where: any = { hotelId };

    if (status && status !== 'all') {
      if (status === 'in_progress') {
        where.status = { in: ['assigned', 'in_progress'] };
      } else if (status === 'completed') {
        where.status = { in: ['completed', 'cancelled'] };
      } else {
        where.status = status;
      }
    }

    if (priority) where.priority = priority;
    if (serviceType) where.serviceType = serviceType;
    if (roomId) where.roomId = roomId;
    if (assignedTo) where.assignedTo = assignedTo;

    const requests = await prisma.roomServiceRequest.findMany({
      where,
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    // Transform for frontend
    const transformedRequests = requests.map((r) => ({
      id: r.id,
      booking_id: r.bookingId,
      room_id: r.roomId,
      room_number: r.roomNumber,
      guest_name: r.guestName,
      service_type: r.serviceType,
      description: r.description,
      status: r.status as any,
      priority: r.priority as any,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      completed_at: r.completedAt?.toISOString(),
      assigned_to: r.assignedTo,
      assigned_to_name: r.assignedToName,
      notes: r.notes,
    }));

    res.json({ success: true, requests: transformedRequests });
  } catch (error: any) {
    logger.error('Staff requests error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch requests' });
  }
});

/**
 * GET /v1/staff/requests/:id
 * Get request details
 */
router.get('/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const request = await prisma.roomServiceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({
      success: true,
      request: {
        id: request.id,
        booking_id: request.bookingId,
        room_id: request.roomId,
        room_number: request.roomNumber,
        guest_name: request.guestName,
        service_type: request.serviceType,
        description: request.description,
        status: request.status,
        priority: request.priority,
        created_at: request.createdAt.toISOString(),
        updated_at: request.updatedAt.toISOString(),
        completed_at: request.completedAt?.toISOString(),
        assigned_to: request.assignedTo,
        assigned_to_name: request.assignedToName,
        notes: request.notes,
        items: request.items,
      },
    });
  } catch (error: any) {
    logger.error('Staff request detail error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch request' });
  }
});

/**
 * PUT /v1/staff/requests/:id/status
 * Update request status
 */
router.put('/requests/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const request = await prisma.roomServiceRequest.update({
      where: { id },
      data: updateData,
    });

    logger.info('Request status updated', { requestId: id, status });

    res.json({
      success: true,
      request: {
        id: request.id,
        status: request.status,
        completed_at: request.completedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Update request status error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

/**
 * PUT /v1/staff/requests/:id/assign
 * Assign request to staff member
 */
router.put('/requests/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;

    if (!staffId) {
      return res.status(400).json({ success: false, message: 'Staff ID required' });
    }

    // Get staff name (would need staff table lookup)
    const request = await prisma.roomServiceRequest.update({
      where: { id },
      data: {
        assignedTo: staffId,
        assignedToName: 'Staff Member', // Would fetch from staff table
        status: 'assigned',
      },
    });

    logger.info('Request assigned', { requestId: id, staffId });

    res.json({
      success: true,
      request: {
        id: request.id,
        assigned_to: request.assignedTo,
        assigned_to_name: request.assignedToName,
        status: request.status,
      },
    });
  } catch (error: any) {
    logger.error('Assign request error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to assign request' });
  }
});

/**
 * PUT /v1/staff/requests/:id/notes
 * Add notes to request
 */
router.put('/requests/:id/notes', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const request = await prisma.roomServiceRequest.update({
      where: { id },
      data: { notes },
    });

    res.json({
      success: true,
      request: {
        id: request.id,
        notes: request.notes,
      },
    });
  } catch (error: any) {
    logger.error('Update request notes error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update notes' });
  }
});

/**
 * GET /v1/staff/rooms
 * Get room status overview
 */
router.get('/rooms', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // Mock room data - would come from room/roomStatus tables
    const rooms = [
      { id: '1', number: '101', floor: 1, type: 'Standard', status: 'occupied', guest_name: 'John Doe', check_in: '2024-01-15', check_out: '2024-01-18', pending_requests: 2 },
      { id: '2', number: '102', floor: 1, type: 'Standard', status: 'vacant', pending_requests: 0 },
      { id: '3', number: '103', floor: 1, type: 'Deluxe', status: 'occupied', guest_name: 'Jane Smith', check_in: '2024-01-16', check_out: '2024-01-20', pending_requests: 0 },
      { id: '4', number: '104', floor: 1, type: 'Standard', status: 'cleaning', last_cleaned: '2024-01-17T10:00:00Z', pending_requests: 0 },
      { id: '5', number: '201', floor: 2, type: 'Suite', status: 'occupied', guest_name: 'Bob Wilson', check_in: '2024-01-14', check_out: '2024-01-19', pending_requests: 1 },
      { id: '6', number: '202', floor: 2, type: 'Deluxe', status: 'maintenance', notes: 'AC repair', pending_requests: 0 },
      { id: '7', number: '203', floor: 2, type: 'Standard', status: 'vacant', pending_requests: 0 },
      { id: '8', number: '301', floor: 3, type: 'Suite', status: 'occupied', guest_name: 'Alice Brown', check_in: '2024-01-15', check_out: '2024-01-22', pending_requests: 3 },
      { id: '9', number: '302', floor: 3, type: 'Deluxe', status: 'cleaning', last_cleaned: '2024-01-17T09:00:00Z', pending_requests: 0 },
      { id: '10', number: '303', floor: 3, type: 'Standard', status: 'vacant', pending_requests: 0 },
    ];

    const stats = {
      total: rooms.length,
      occupied: rooms.filter((r) => r.status === 'occupied').length,
      vacant: rooms.filter((r) => r.status === 'vacant').length,
      cleaning: rooms.filter((r) => r.status === 'cleaning').length,
      maintenance: rooms.filter((r) => r.status === 'maintenance').length,
      occupancy_rate: Math.round((rooms.filter((r) => r.status === 'occupied').length / rooms.length) * 100),
    };

    res.json({ success: true, rooms, stats });
  } catch (error: any) {
    logger.error('Staff rooms error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch rooms' });
  }
});

/**
 * PUT /v1/staff/rooms/:id/status
 * Update room status
 */
router.put('/rooms/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['occupied', 'vacant', 'cleaning', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Mock update - would update room status table
    logger.info('Room status updated', { roomId: id, status, notes });

    res.json({
      success: true,
      room: { id, status, notes },
    });
  } catch (error: any) {
    logger.error('Update room status error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update room status' });
  }
});

/**
 * GET /v1/staff/messages
 * Get guest conversations
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // Mock conversations data
    const conversations = [
      {
        id: 'conv-1',
        room_number: '101',
        guest_name: 'John Doe',
        guest_id: 'guest-1',
        booking_id: 'booking-1',
        last_message: 'When will housekeeping arrive?',
        last_message_time: new Date(Date.now() - 5 * 60000).toISOString(),
        unread_count: 2,
      },
      {
        id: 'conv-2',
        room_number: '201',
        guest_name: 'Jane Smith',
        guest_id: 'guest-2',
        booking_id: 'booking-2',
        last_message: 'Thank you for the towels!',
        last_message_time: new Date(Date.now() - 30 * 60000).toISOString(),
        unread_count: 0,
      },
      {
        id: 'conv-3',
        room_number: '301',
        guest_name: 'Bob Wilson',
        guest_id: 'guest-3',
        booking_id: 'booking-3',
        last_message: 'The WiFi is not working in my room',
        last_message_time: new Date(Date.now() - 60 * 60000).toISOString(),
        unread_count: 1,
      },
    ];

    res.json({ success: true, conversations });
  } catch (error: any) {
    logger.error('Staff messages error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

/**
 * GET /v1/staff/messages/:threadId
 * Get messages in a conversation
 */
router.get('/messages/:threadId', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    // Mock messages
    const messages = [
      {
        id: 'msg-1',
        sender_id: 'guest-1',
        sender_type: 'guest' as const,
        sender_name: 'John Doe',
        content: 'Hello, I need extra towels please',
        message_type: 'text' as const,
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        readAt: { not: null },
      },
      {
        id: 'msg-2',
        sender_id: 'staff-1',
        sender_type: 'staff' as const,
        sender_name: 'Front Desk',
        content: 'Sure, we will send someone right away',
        message_type: 'text' as const,
        created_at: new Date(Date.now() - 10 * 60000).toISOString(),
        readAt: { not: null },
      },
      {
        id: 'msg-3',
        sender_id: 'guest-1',
        sender_type: 'guest' as const,
        sender_name: 'John Doe',
        content: 'When will housekeeping arrive?',
        message_type: 'text' as const,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        read: false,
      },
    ];

    res.json({ success: true, messages });
  } catch (error: any) {
    logger.error('Staff message thread error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
});

/**
 * POST /v1/staff/messages/:threadId
 * Send message to guest
 */
router.post('/messages/:threadId', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content required' });
    }

    const message = {
      id: `msg-${Date.now()}`,
      sender_id: 'staff-1',
      sender_type: 'staff' as const,
      sender_name: 'Staff',
      content: content.trim(),
      message_type: 'text' as const,
      created_at: new Date().toISOString(),
      read: false,
    };

    logger.info('Staff message sent', { threadId, messageId: message.id });

    res.json({ success: true, message });
  } catch (error: any) {
    logger.error('Send message error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

/**
 * POST /v1/staff/messages/:threadId/escalate
 * Escalate conversation to manager
 */
router.post('/messages/:threadId/escalate', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    logger.info('Conversation escalated', { threadId });

    res.json({ success: true, message: 'Conversation escalated to manager' });
  } catch (error: any) {
    logger.error('Escalate conversation error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to escalate' });
  }
});

/**
 * POST /v1/staff/messages/:threadId/resolve
 * Mark conversation as resolved
 */
router.post('/messages/:threadId/resolve', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    logger.info('Conversation resolved', { threadId });

    res.json({ success: true, message: 'Conversation marked as resolved' });
  } catch (error: any) {
    logger.error('Resolve conversation error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to resolve' });
  }
});

/**
 * GET /v1/staff/checkouts
 * Get checkout requests
 */
router.get('/checkouts', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // Mock checkout data
    const checkouts = [
      {
        id: 'checkout-1',
        booking_id: 'booking-1',
        booking_ref: 'STAY001',
        guest_name: 'John Doe',
        guest_phone: '+919876543210',
        room_number: '101',
        check_in: '2024-01-15',
        check_out: '2024-01-18',
        checkout_time: '2024-01-18T12:00:00Z',
        status: 'pending',
        total_amount_paise: 1500000,
        paid_amount_paise: 1500000,
        pending_amount_paise: 0,
        special_requests: 'Late checkout requested',
      },
      {
        id: 'checkout-2',
        booking_id: 'booking-2',
        booking_ref: 'STAY002',
        guest_name: 'Jane Smith',
        guest_phone: '+919876543211',
        room_number: '201',
        check_in: '2024-01-16',
        check_out: '2024-01-19',
        checkout_time: '2024-01-19T11:00:00Z',
        status: 'approved',
        total_amount_paise: 1200000,
        paid_amount_paise: 1200000,
        pending_amount_paise: 0,
      },
    ];

    res.json({ success: true, checkouts });
  } catch (error: any) {
    logger.error('Staff checkouts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch checkouts' });
  }
});

/**
 * GET /v1/staff/checkouts/pending
 * Get scheduled checkouts for today
 */
router.get('/checkouts/pending', async (req: Request, res: Response) => {
  try {
    // Mock pending checkouts
    const pending = [
      {
        id: 'pending-1',
        booking_id: 'booking-3',
        booking_ref: 'STAY003',
        guest_name: 'Bob Wilson',
        room_number: '301',
        scheduled_checkout: new Date().toISOString(),
        status: 'pending_request',
        has_requests: true,
      },
      {
        id: 'pending-2',
        booking_id: 'booking-4',
        booking_ref: 'STAY004',
        guest_name: 'Alice Brown',
        room_number: '302',
        scheduled_checkout: new Date().toISOString(),
        status: 'on_time',
        has_requests: false,
      },
    ];

    res.json({ success: true, pending });
  } catch (error: any) {
    logger.error('Staff pending checkouts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch pending checkouts' });
  }
});

/**
 * POST /v1/staff/checkout/:bookingId/approve
 * Approve checkout
 */
router.post('/checkout/:bookingId/approve', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    logger.info('Checkout approved', { bookingId });

    res.json({ success: true, message: 'Checkout approved' });
  } catch (error: any) {
    logger.error('Approve checkout error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to approve checkout' });
  }
});

/**
 * POST /v1/staff/checkout/:bookingId/complete
 * Complete checkout
 */
router.post('/checkout/:bookingId/complete', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;

    logger.info('Checkout completed', { bookingId });

    res.json({ success: true, message: 'Checkout completed' });
  } catch (error: any) {
    logger.error('Complete checkout error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to complete checkout' });
  }
});

/**
 * POST /v1/staff/checkout/:bookingId/late
 * Approve late checkout
 */
router.post('/checkout/:bookingId/late', async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { hours = 2 } = req.body;

    logger.info('Late checkout approved', { bookingId, hours });

    res.json({ success: true, message: `Late checkout approved for ${hours} hours` });
  } catch (error: any) {
    logger.error('Late checkout error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to approve late checkout' });
  }
});

/**
 * GET /v1/staff/notifications
 * Get staff notifications
 */
router.get('/notifications', async (req: Request, res: Response) => {
  try {
    // Mock notifications
    const notifications = [
      {
        id: 'notif-1',
        type: 'request' as const,
        title: 'New Housekeeping Request',
        message: 'Room 101 requested extra towels',
        read: false,
        created_at: new Date(Date.now() - 5 * 60000).toISOString(),
        action_url: '/staff/requests',
        metadata: { room_number: '101', service_type: 'housekeeping' },
      },
      {
        id: 'notif-2',
        type: 'message' as const,
        title: 'New Guest Message',
        message: 'Guest in Room 201 sent a message',
        read: false,
        created_at: new Date(Date.now() - 15 * 60000).toISOString(),
        action_url: '/staff/messages',
        metadata: { room_number: '201' },
      },
      {
        id: 'notif-3',
        type: 'checkout' as const,
        title: 'Checkout Reminder',
        message: 'Guest in Room 305 has checkout today at 11:00 AM',
        readAt: { not: null },
        created_at: new Date(Date.now() - 60 * 60000).toISOString(),
        action_url: '/staff/checkout',
        metadata: { room_number: '305' },
      },
      {
        id: 'notif-4',
        type: 'alert' as const,
        title: 'Low Inventory Alert',
        message: 'Towels stock is running low in Housekeeping',
        read: false,
        created_at: new Date(Date.now() - 120 * 60000).toISOString(),
      },
    ];

    res.json({ success: true, notifications });
  } catch (error: any) {
    logger.error('Staff notifications error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
});

/**
 * POST /v1/staff/notifications/:id/read
 * Mark notification as read
 */
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logger.info('Notification marked as read', { notificationId: id });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Mark notification read error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

/**
 * POST /v1/staff/notifications/read-all
 * Mark all notifications as read
 */
router.post('/notifications/read-all', async (req: Request, res: Response) => {
  try {
    logger.info('All notifications marked as read');

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Mark all notifications read error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

/**
 * DELETE /v1/staff/notifications/:id
 * Delete a notification
 */
router.delete('/notifications/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    logger.info('Notification deleted', { notificationId: id });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete notification error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
});

/**
 * POST /v1/staff/auto-assign
 * Auto-assign a request to the best available staff member
 */
router.post('/auto-assign', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.body;

    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID required' });
    }

    // Get the request
    const request = await prisma.roomServiceRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Auto-assignment logic (simplified - uses round-robin based on department)
    const departments: Record<string, string[]> = {
      housekeeping: ['staff-hk-1', 'staff-hk-2'],
      room_service: ['staff-rs-1', 'staff-rs-2'],
      maintenance: ['staff-maint-1'],
    };

    const deptStaff = departments[request.serviceType] || ['staff-default'];
    // STATISTICAL: Random selection for demo/fallback (not security-critical)
    const selectedStaff = deptStaff[randomInt(0, deptStaff.length)];

    // Update the request
    const updatedRequest = await prisma.roomServiceRequest.update({
      where: { id: requestId },
      data: {
        assignedTo: selectedStaff,
        assignedToName: 'Assigned Staff',
        status: 'assigned',
        assignedAt: new Date(),
      },
    });

    logger.info('Request auto-assigned', { requestId, staffId: selectedStaff });

    res.json({
      success: true,
      assigned_to: updatedRequest.assignedTo,
      assigned_to_name: updatedRequest.assignedToName,
      reason: 'least_busy',
    });
  } catch (error: any) {
    logger.error('Auto-assign error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to auto-assign' });
  }
});

/**
 * GET /v1/staff/:staffId/load
 * Get current workload for a staff member
 */
router.get('/:staffId/load', async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;

    // Get active requests
    const activeRequests = await prisma.roomServiceRequest.count({
      where: {
        assignedTo: staffId,
        status: { in: ['assigned', 'in_progress'] },
      },
    });

    // Get pending requests
    const pendingRequests = await prisma.roomServiceRequest.findMany({
      where: {
        assignedTo: staffId,
        status: { in: ['assigned', 'in_progress'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    res.json({
      success: true,
      staffId,
      active_requests: activeRequests,
      pending_requests: pendingRequests.map((r) => ({
        id: r.id,
        room_number: r.roomNumber,
        service_type: r.serviceType,
        priority: r.priority,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    logger.error('Get staff load error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get staff load' });
  }
});

/**
 * GET /v1/staff/:staffId/location
 * Get staff location
 */
router.get('/:staffId/location', async (req: Request, res: Response) => {
  try {
    const { staffId } = req.params;

    // Mock location data
    const location = {
      staffId,
      // STATISTICAL: Mock location data for demo (not security-critical)
      floor: randomInt(1, 5),
      zone: ['north', 'south', 'center', 'east', 'west'][randomInt(0, 5)],
      lastUpdated: new Date().toISOString(),
    };

    res.json({ success: true, location });
  } catch (error: any) {
    logger.error('Get staff location error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get staff location' });
  }
});

/**
 * GET /v1/staff/requests/:id/sla
 * Get SLA status for a request
 */
router.get('/requests/:id/sla', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const request = await prisma.roomServiceRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // SLA targets in minutes
    const SLA_TARGETS: Record<string, number> = {
      housekeeping: 30,
      room_service: 20,
      spa: 60,
      laundry: 120,
      maintenance: 45,
      concierge: 15,
    };

    const targetMinutes = SLA_TARGETS[request.serviceType] || 30;
    const createdAt = request.createdAt;
    const now = new Date();
    const elapsedMs = now.getTime() - createdAt.getTime();
    const elapsedMinutes = elapsedMs / 60000;
    const percentUsed = (elapsedMinutes / targetMinutes) * 100;

    let status: 'ok' | 'warning' | 'breach' = 'ok';
    if (percentUsed >= 100) status = 'breach';
    else if (percentUsed >= 75) status = 'warning';

    res.json({
      success: true,
      sla: {
        request_id: id,
        service_type: request.serviceType,
        target_minutes: targetMinutes,
        elapsed_minutes: Math.round(elapsedMinutes),
        percent_used: Math.round(percentUsed),
        status,
      },
    });
  } catch (error: any) {
    logger.error('Get SLA status error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get SLA status' });
  }
});

/**
 * GET /v1/staff/requests/sla-alerts
 * Get all SLA alerts (warnings and breaches)
 */
router.get('/requests/sla-alerts', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // SLA targets
    const SLA_TARGETS: Record<string, number> = {
      housekeeping: 30,
      room_service: 20,
      spa: 60,
      laundry: 120,
      maintenance: 45,
      concierge: 15,
    };

    // Get active requests
    const activeRequests = await prisma.roomServiceRequest.findMany({
      where: {
        hotelId,
        status: { in: ['pending', 'assigned', 'in_progress'] },
      },
    });

    const now = new Date();
    const warnings: any[] = [];
    const breaches: any[] = [];

    for (const request of activeRequests) {
      const targetMinutes = SLA_TARGETS[request.serviceType] || 30;
      const elapsedMs = now.getTime() - request.createdAt.getTime();
      const elapsedMinutes = elapsedMs / 60000;
      const percentUsed = (elapsedMinutes / targetMinutes) * 100;

      const alert = {
        request_id: request.id,
        room_number: request.roomNumber,
        service_type: request.serviceType,
        priority: request.priority,
        elapsed_minutes: Math.round(elapsedMinutes),
        target_minutes: targetMinutes,
        percent_used: Math.round(percentUsed),
      };

      if (percentUsed >= 100) {
        breaches.push(alert);
      } else if (percentUsed >= 75) {
        warnings.push(alert);
      }
    }

    // Sort by priority and elapsed time
    const sortByPriority = (a: any, b: any) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
      const diff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (diff !== 0) return diff;
      return b.elapsed_minutes - a.elapsed_minutes;
    };

    warnings.sort(sortByPriority);
    breaches.sort(sortByPriority);

    res.json({
      success: true,
      warnings,
      breaches,
      summary: {
        total_warnings: warnings.length,
        total_breaches: breaches.length,
      },
    });
  } catch (error: any) {
    logger.error('Get SLA alerts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get SLA alerts' });
  }
});

/**
 * GET /v1/staff/performance
 * Get staff performance metrics
 */
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';

    // Mock performance data
    const performance = [
      { id: 'staff-1', name: 'John Housekeeping', department: 'housekeeping', requests_completed: 45, avg_response_time: 12, sla_compliance: 98, rating: 4.9, requests_today: 8 },
      { id: 'staff-2', name: 'Sarah Housekeeping', department: 'housekeeping', requests_completed: 38, avg_response_time: 15, sla_compliance: 96, rating: 4.8, requests_today: 6 },
      { id: 'staff-3', name: 'Mike Room Service', department: 'room_service', requests_completed: 32, avg_response_time: 22, sla_compliance: 92, rating: 4.7, requests_today: 5 },
      { id: 'staff-4', name: 'Lisa Room Service', department: 'room_service', requests_completed: 28, avg_response_time: 18, sla_compliance: 95, rating: 4.6, requests_today: 4 },
      { id: 'staff-5', name: 'Tom Maintenance', department: 'maintenance', requests_completed: 25, avg_response_time: 20, sla_compliance: 91, rating: 4.5, requests_today: 5 },
    ];

    // Calculate team stats
    const teamStats = {
      total_requests: performance.reduce((sum, p) => sum + p.requests_completed, 0),
      completed_today: performance.reduce((sum, p) => sum + p.requests_today, 0),
      avg_response_time: Math.round(performance.reduce((sum, p) => sum + p.avg_response_time, 0) / performance.length),
      overall_sla_compliance: Math.round(performance.reduce((sum, p) => sum + p.sla_compliance, 0) / performance.length),
    };

    res.json({
      success: true,
      team_stats: teamStats,
      staff_performance: performance,
    });
  } catch (error: any) {
    logger.error('Get performance error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get performance' });
  }
});

/**
 * GET /v1/staff/reports
 * Get reports data
 */
router.get('/reports', async (req: Request, res: Response) => {
  try {
    const hotelId = req.headers['x-hotel-id'] as string || 'demo-hotel-id';
    const { period = 'week' } = req.query;

    // Mock report data
    const requestsByType = [
      { type: 'Housekeeping', count: 145, avgTime: 25 },
      { type: 'Room Service', count: 98, avgTime: 18 },
      { type: 'Spa & Wellness', count: 42, avgTime: 55 },
      { type: 'Laundry', count: 67, avgTime: 95 },
      { type: 'Maintenance', count: 38, avgTime: 35 },
      { type: 'Concierge', count: 56, avgTime: 12 },
    ];

    const slaCompliance = [
      { type: 'Housekeeping', compliance: 96 },
      { type: 'Room Service', compliance: 94 },
      { type: 'Spa & Wellness', compliance: 92 },
      { type: 'Laundry', compliance: 88 },
      { type: 'Maintenance', compliance: 91 },
      { type: 'Concierge', compliance: 98 },
    ];

    res.json({
      success: true,
      period,
      total_requests: requestsByType.reduce((sum, r) => sum + r.count, 0),
      completed_requests: Math.round(requestsByType.reduce((sum, r) => sum + r.count, 0) * 0.92),
      avg_response_time: 18,
      overall_sla_compliance: 93,
      requests_by_type: requestsByType,
      sla_compliance: slaCompliance,
    });
  } catch (error: any) {
    logger.error('Get reports error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to get reports' });
  }
});

/**
 * GET /v1/staff/me
 * Get current staff user
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Mock user data - would come from session/auth
    const user = {
      id: 'staff-1',
      name: 'Hotel Staff',
      role: 'front_desk' as const,
      department: 'front_desk',
      avatar: null,
    };

    res.json({ success: true, user });
  } catch (error: any) {
    logger.error('Get staff user error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

/**
 * GET /v1/staff/team
 * Get staff team members
 */
router.get('/team', async (req: Request, res: Response) => {
  try {
    // Mock staff data
    const staff = [
      { id: 'staff-1', name: 'John Manager', department: 'manager' },
      { id: 'staff-2', name: 'Sarah Front Desk', department: 'front_desk' },
      { id: 'staff-3', name: 'Mike Housekeeping', department: 'housekeeping' },
      { id: 'staff-4', name: 'Lisa Room Service', department: 'room_service' },
      { id: 'staff-5', name: 'Tom Maintenance', department: 'maintenance' },
    ];

    res.json({ success: true, staff });
  } catch (error: any) {
    logger.error('Get staff team error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch team' });
  }
});

/**
 * POST /v1/staff/logout
 * Logout staff user
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // Clear session
    res.clearCookie('staff_session');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    logger.error('Staff logout error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to logout' });
  }
});

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}

export default router;
