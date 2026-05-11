import websocketService from '../../services/websocketService.js';

describe('websocketService.handleSubscription', () => {
  beforeEach(() => {
    websocketService.connections.clear();
    websocketService.hotelConnections.clear();
  });

  const createSocket = (overrides = {}) => ({
    id: `socket-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    userRole: 'staff',
    hotelId: 'hotel-1',
    join: jest.fn(),
    on: jest.fn(),
    emit: jest.fn(),
    ...overrides
  });

  it('allows subscription to own user room', () => {
    const socket = createSocket();

    websocketService.handleSubscription(socket, { subscription: 'user:user-1' });

    expect(socket.join).toHaveBeenCalledWith('user:user-1');
    expect(socket.emit).toHaveBeenCalledWith('subscribed', { subscription: 'user:user-1' });
  });

  it('denies subscription to another hotel room', () => {
    const socket = createSocket();

    websocketService.handleSubscription(socket, { subscription: 'hotel:hotel-999' });

    expect(socket.join).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Subscription not allowed' });
  });

  it('tracks multiple sockets for same user safely', () => {
    const socket1 = createSocket({ id: 'socket-1' });
    const socket2 = createSocket({ id: 'socket-2' });

    websocketService.handleConnection(socket1);
    websocketService.handleConnection(socket2);

    expect(websocketService.getStats().totalConnections).toBe(2);

    websocketService.handleDisconnection(socket1, 'test-disconnect');
    expect(websocketService.getStats().totalConnections).toBe(1);

    websocketService.handleDisconnection(socket2, 'test-disconnect');
    expect(websocketService.getStats().totalConnections).toBe(0);
  });
});
