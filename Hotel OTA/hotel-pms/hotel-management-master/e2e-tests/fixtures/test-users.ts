export const testUsers = {
  admin: {
    email: 'admin@hotel.com',
    password: 'Admin@123',
    role: 'admin',
    name: 'Admin User'
  },
  staff: {
    email: 'staff@hotel.com',
    password: 'Staff@123',
    role: 'staff',
    name: 'Staff Member'
  },
  guest: {
    email: 'john.doe@example.com',
    password: 'Guest@123',
    role: 'guest',
    name: 'John Doe',
    phone: '+1234567890'
  },
  corporate: {
    email: 'corporate@company.com',
    password: 'Corp@123',
    role: 'guest',
    type: 'corporate',
    name: 'Corporate User',
    company: 'Tech Corp'
  },
  newGuest: {
    email: `test.user.${Date.now()}@example.com`,
    password: 'Test@123',
    role: 'guest',
    name: 'Test User',
    phone: '+9876543210'
  }
};

export const testCards = {
  valid: {
    number: '4242424242424242',
    expiry: '12/25',
    cvc: '123',
    zip: '12345'
  },
  declined: {
    number: '4000000000000002',
    expiry: '12/25',
    cvc: '123',
    zip: '12345'
  },
  insufficient: {
    number: '4000000000009995',
    expiry: '12/25',
    cvc: '123',
    zip: '12345'
  }
};

export const testRooms = {
  standard: {
    type: 'Standard Room',
    basePrice: 100,
    capacity: 2
  },
  deluxe: {
    type: 'Deluxe Room',
    basePrice: 200,
    capacity: 3
  },
  suite: {
    type: 'Executive Suite',
    basePrice: 500,
    capacity: 4
  }
};

export const testBookingDates = {
  future: {
    checkIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    checkOut: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 10 days from now
  },
  tomorrow: {
    checkIn: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  },
  longStay: {
    checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    checkOut: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
};