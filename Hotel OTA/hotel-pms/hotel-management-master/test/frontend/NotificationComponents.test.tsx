import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jest } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock API
const mockApiRequest = jest.fn();
jest.mock('../../frontend/src/services/api', () => ({
  apiRequest: mockApiRequest
}));

// Mock auth context
const mockAuthContext = {
  user: {
    _id: 'test-user-id',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    role: 'admin',
    hotelId: 'test-hotel-id'
  }
};

jest.mock('../../frontend/src/context/AuthContext', () => ({
  useAuth: () => mockAuthContext
}));

// Import components
import { NotificationList } from '../../frontend/src/components/notifications/NotificationList';
import { TemplateEditor } from '../../frontend/src/components/notifications/TemplateEditor';
import { TemplateManagement } from '../../frontend/src/components/notifications/TemplateManagement';
import { QuickNotificationSettings } from '../../frontend/src/components/notifications/QuickNotificationSettings';
import { RoleSpecificQuickSettings } from '../../frontend/src/components/notifications/RoleSpecificQuickSettings';
import { NotificationAnalyticsDashboard } from '../../frontend/src/components/analytics/NotificationAnalyticsDashboard';

// Test utilities
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('NotificationList Component', () => {
  const mockNotifications = [
    {
      _id: '1',
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed',
      type: 'booking_confirmation',
      category: 'booking',
      priority: 'medium',
      status: 'sent',
      channels: ['in_app', 'email'],
      createdAt: new Date().toISOString(),
      readAt: null
    },
    {
      _id: '2',
      title: 'Payment Received',
      message: 'Payment of $299.99 received',
      type: 'payment_success',
      category: 'payment',
      priority: 'high',
      status: 'read',
      channels: ['in_app'],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      readAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    mockApiRequest.mockClear();
  });

  it('should render notification list correctly', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: {
        notifications: mockNotifications,
        pagination: { page: 1, total: 2, pages: 1 }
      }
    });

    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
      expect(screen.getByText('Payment Received')).toBeInTheDocument();
    });
  });

  it('should show loading state', () => {
    mockApiRequest.mockImplementation(() => new Promise(() => {})); // Never resolves

    renderWithQueryClient(<NotificationList />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should show empty state when no notifications', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: {
        notifications: [],
        pagination: { page: 1, total: 0, pages: 0 }
      }
    });

    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('No notifications found')).toBeInTheDocument();
    });
  });

  it('should mark notifications as read', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: {
          notifications: mockNotifications,
          pagination: { page: 1, total: 2, pages: 1 }
        }
      })
      .mockResolvedValueOnce({
        data: { modifiedCount: 1 }
      });

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
    });

    const markReadButton = screen.getByTitle('Mark as read');
    await user.click(markReadButton);

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/v1/notifications/mark-read',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ notificationIds: ['1'] })
      })
    );
  });

  it('should filter notifications by status', async () => {
    mockApiRequest.mockResolvedValue({
      data: {
        notifications: [mockNotifications[0]],
        pagination: { page: 1, total: 1, pages: 1 }
      }
    });

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationList />);

    const filterSelect = screen.getByLabelText('Filter by status');
    await user.selectOptions(filterSelect, 'sent');

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('status=sent'),
      undefined
    );
  });

  it('should show notification details in modal', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: {
        notifications: mockNotifications,
        pagination: { page: 1, total: 2, pages: 1 }
      }
    });

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('Booking Confirmed')).toBeInTheDocument();
    });

    const viewButton = screen.getByTitle('View details');
    await user.click(viewButton);

    expect(screen.getByText('Notification Details')).toBeInTheDocument();
  });
});

describe('TemplateEditor Component', () => {
  const mockTemplate = {
    _id: 'template-1',
    name: 'Test Template',
    description: 'Test description',
    category: 'booking',
    type: 'booking_confirmation',
    subject: 'Booking {{bookingNumber}} confirmed',
    title: 'Booking Confirmed',
    message: 'Hello {{guestName}}, your booking is confirmed.',
    channels: ['in_app', 'email'],
    priority: 'medium',
    variables: [
      {
        name: 'guestName',
        description: 'Guest name',
        type: 'string',
        required: true,
        defaultValue: ''
      },
      {
        name: 'bookingNumber',
        description: 'Booking number',
        type: 'string',
        required: true,
        defaultValue: ''
      }
    ],
    routing: {
      targetRoles: ['guest'],
      departments: []
    },
    metadata: {
      isSystem: false,
      version: 1
    }
  };

  const mockOnClose = jest.fn();
  const mockOnSaved = jest.fn();

  beforeEach(() => {
    mockApiRequest.mockClear();
    mockOnClose.mockClear();
    mockOnSaved.mockClear();
  });

  it('should render template editor in create mode', () => {
    renderWithQueryClient(
      <TemplateEditor
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
  });

  it('should render template editor in edit mode', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: { template: mockTemplate }
    });

    renderWithQueryClient(
      <TemplateEditor
        templateId="template-1"
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Template')).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue('Test Template')).toBeInTheDocument();
  });

  it('should navigate between tabs', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <TemplateEditor
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    const variablesTab = screen.getByText('Variables');
    await user.click(variablesTab);

    expect(screen.getByText('Define dynamic content placeholders')).toBeInTheDocument();
  });

  it('should add and remove variables', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <TemplateEditor
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Navigate to variables tab
    const variablesTab = screen.getByText('Variables');
    await user.click(variablesTab);

    // Add variable
    const addVariableButton = screen.getByText('Add Variable');
    await user.click(addVariableButton);

    expect(screen.getByPlaceholderText('e.g., guestName')).toBeInTheDocument();

    // Remove variable
    const removeButton = screen.getByText('Remove');
    await user.click(removeButton);

    expect(screen.queryByPlaceholderText('e.g., guestName')).not.toBeInTheDocument();
  });

  it('should save template', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: { template: { ...mockTemplate, _id: 'new-template-id' } }
    });

    const user = userEvent.setup();
    renderWithQueryClient(
      <TemplateEditor
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    // Fill required fields
    const nameInput = screen.getByPlaceholderText('e.g., Booking Confirmation');
    await user.type(nameInput, 'New Template');

    const subjectInput = screen.getByPlaceholderText('e.g., Booking Confirmed - {{bookingNumber}}');
    await user.type(subjectInput, 'Test Subject');

    const titleInput = screen.getByPlaceholderText('e.g., Booking Confirmed');
    await user.type(titleInput, 'Test Title');

    // Navigate to content tab
    const contentTab = screen.getByText('Content');
    await user.click(contentTab);

    const messageTextarea = screen.getByPlaceholderText('Your notification message with {{variables}}...');
    await user.type(messageTextarea, 'Test message');

    // Save
    const saveButton = screen.getByText('Create Template');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        '/api/v1/notifications/templates',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    expect(mockOnSaved).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should preview template with variables', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: { template: mockTemplate }
      })
      .mockResolvedValueOnce({
        data: {
          preview: {
            subject: 'Booking BK123456 confirmed',
            title: 'Booking Confirmed',
            message: 'Hello John Doe, your booking is confirmed.'
          }
        }
      });

    const user = userEvent.setup();
    renderWithQueryClient(
      <TemplateEditor
        templateId="template-1"
        isOpen={true}
        onClose={mockOnClose}
        onSaved={mockOnSaved}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Template')).toBeInTheDocument();
    });

    // Navigate to preview tab
    const previewTab = screen.getByText('Preview');
    await user.click(previewTab);

    // Fill test variables
    const guestNameInput = screen.getByPlaceholderText('Guest name');
    await user.type(guestNameInput, 'John Doe');

    const bookingNumberInput = screen.getByPlaceholderText('Booking number');
    await user.type(bookingNumberInput, 'BK123456');

    // Generate preview
    const generateButton = screen.getByText('Generate Preview');
    await user.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('Live Preview')).toBeInTheDocument();
      expect(screen.getByText('Booking BK123456 confirmed')).toBeInTheDocument();
    });
  });
});

describe('TemplateManagement Component', () => {
  const mockTemplates = [
    {
      _id: 'template-1',
      name: 'Booking Confirmation',
      description: 'Standard booking confirmation',
      category: 'booking',
      type: 'booking_confirmation',
      channels: ['in_app', 'email'],
      priority: 'medium',
      variables: [{ name: 'guestName' }, { name: 'bookingNumber' }],
      usage: {
        timesUsed: 25,
        avgDeliveryRate: 95.5,
        avgReadRate: 80.2
      },
      metadata: {
        isSystem: true,
        version: 1,
        isActive: true
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  beforeEach(() => {
    mockApiRequest.mockClear();
  });

  it('should render template management dashboard', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: {
        templates: mockTemplates,
        pagination: { page: 1, total: 1, pages: 1 }
      }
    });

    renderWithQueryClient(<TemplateManagement />);

    await waitFor(() => {
      expect(screen.getByText('Template Management')).toBeInTheDocument();
      expect(screen.getByText('Booking Confirmation')).toBeInTheDocument();
    });
  });

  it('should search templates', async () => {
    mockApiRequest.mockResolvedValue({
      data: {
        templates: mockTemplates,
        pagination: { page: 1, total: 1, pages: 1 }
      }
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TemplateManagement />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    await user.type(searchInput, 'booking');

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        expect.stringContaining('search=booking'),
        undefined
      );
    });
  });

  it('should filter by category', async () => {
    mockApiRequest.mockResolvedValue({
      data: {
        templates: mockTemplates,
        pagination: { page: 1, total: 1, pages: 1 }
      }
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TemplateManagement />);

    await waitFor(() => {
      expect(screen.getByText('All Categories')).toBeInTheDocument();
    });

    const categorySelect = screen.getByDisplayValue('All Categories');
    await user.selectOptions(categorySelect, 'booking');

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('category=booking'),
      undefined
    );
  });

  it('should open template editor for editing', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: {
        templates: mockTemplates,
        pagination: { page: 1, total: 1, pages: 1 }
      }
    });

    const user = userEvent.setup();
    renderWithQueryClient(<TemplateManagement />);

    await waitFor(() => {
      expect(screen.getByTitle('Edit template')).toBeInTheDocument();
    });

    const editButton = screen.getByTitle('Edit template');
    await user.click(editButton);

    expect(screen.getByText('Edit Template')).toBeInTheDocument();
  });

  it('should initialize default templates', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: {
          templates: [],
          pagination: { page: 1, total: 0, pages: 0 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          templates: mockTemplates
        }
      });

    const user = userEvent.setup();
    renderWithQueryClient(<TemplateManagement />);

    await waitFor(() => {
      expect(screen.getByText('Initialize Templates')).toBeInTheDocument();
    });

    const initButton = screen.getByText('Initialize Templates');
    await user.click(initButton);

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/v1/notifications/templates/initialize',
      expect.objectContaining({
        method: 'POST'
      })
    );
  });
});

describe('QuickNotificationSettings Component', () => {
  const mockPreferences = {
    channels: {
      inApp: true,
      email: true,
      sms: false,
      push: true
    },
    categories: {
      bookings: true,
      payments: true,
      services: false,
      promotional: false
    },
    quietHours: {
      enabled: false,
      start: 22,
      end: 7
    },
    sound: true,
    frequency: 'immediate'
  };

  beforeEach(() => {
    mockApiRequest.mockClear();
  });

  it('should render quick settings modal', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: { preferences: { notifications: mockPreferences } }
    });

    renderWithQueryClient(
      <QuickNotificationSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Quick Settings')).toBeInTheDocument();
      expect(screen.getByText('Channels')).toBeInTheDocument();
      expect(screen.getByText('Categories')).toBeInTheDocument();
      expect(screen.getByText('Timing')).toBeInTheDocument();
    });
  });

  it('should toggle channel preferences', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: { preferences: { notifications: mockPreferences } }
      })
      .mockResolvedValueOnce({
        data: { preferences: { notifications: mockPreferences } }
      });

    const user = userEvent.setup();
    renderWithQueryClient(
      <QuickNotificationSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('In-App')).toBeInTheDocument();
    });

    // Find and click the SMS toggle (should be off)
    const smsToggle = screen.getByLabelText('SMS toggle');
    await user.click(smsToggle);

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/v1/notifications/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('sms')
      })
    );
  });

  it('should change notification frequency', async () => {
    mockApiRequest
      .mockResolvedValueOnce({
        data: { preferences: { notifications: mockPreferences } }
      })
      .mockResolvedValueOnce({
        data: { preferences: { notifications: mockPreferences } }
      });

    const user = userEvent.setup();
    renderWithQueryClient(
      <QuickNotificationSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Timing')).toBeInTheDocument();
    });

    // Navigate to timing tab
    const timingTab = screen.getByText('Timing');
    await user.click(timingTab);

    // Select daily digest
    const digestOption = screen.getByText('Daily Digest');
    await user.click(digestOption);

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/api/v1/notifications/preferences',
      expect.objectContaining({
        method: 'PATCH'
      })
    );
  });
});

describe('RoleSpecificQuickSettings Component', () => {
  beforeEach(() => {
    mockApiRequest.mockClear();
  });

  it('should render admin quick settings', async () => {
    mockAuthContext.user.role = 'admin';

    mockApiRequest.mockResolvedValueOnce({
      data: {
        preferences: {
          notifications: {
            priorities: {
              urgent: true,
              high: true,
              medium: false,
              low: false
            },
            categories: {
              system: true,
              security: true,
              financial: false
            }
          }
        }
      }
    });

    renderWithQueryClient(
      <RoleSpecificQuickSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Admin Settings')).toBeInTheDocument();
      expect(screen.getByText('Priority Alerts')).toBeInTheDocument();
      expect(screen.getByText('Critical Issues')).toBeInTheDocument();
    });
  });

  it('should render staff quick settings', async () => {
    mockAuthContext.user.role = 'staff';

    mockApiRequest.mockResolvedValueOnce({
      data: {
        preferences: {
          notifications: {
            categories: {
              tasks: true,
              maintenance: true,
              housekeeping: false
            },
            shifts: {
              morning: true,
              afternoon: false,
              night: false
            }
          }
        }
      }
    });

    renderWithQueryClient(
      <RoleSpecificQuickSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Staff Settings')).toBeInTheDocument();
      expect(screen.getByText('Work Categories')).toBeInTheDocument();
      expect(screen.getByText('Shift Preferences')).toBeInTheDocument();
    });
  });

  it('should render guest quick settings', async () => {
    mockAuthContext.user.role = 'guest';

    mockApiRequest.mockResolvedValueOnce({
      data: {
        preferences: {
          notifications: {
            categories: {
              bookings: true,
              payments: true,
              services: false,
              offers: false
            },
            frequency: 'immediate'
          }
        }
      }
    });

    renderWithQueryClient(
      <RoleSpecificQuickSettings
        isOpen={true}
        onClose={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Guest Preferences')).toBeInTheDocument();
      expect(screen.getByText('What I Want to Know')).toBeInTheDocument();
      expect(screen.getByText('How Often?')).toBeInTheDocument();
    });
  });
});

describe('NotificationAnalyticsDashboard Component', () => {
  const mockAnalyticsData = {
    summary: {
      total: 150,
      delivered: 142,
      read: 120,
      failed: 8,
      deliveryRate: 94.7,
      readRate: 80.0
    },
    chartData: [
      { date: '2024-01-01', sent: 25, delivered: 24, read: 20 },
      { date: '2024-01-02', sent: 30, delivered: 28, read: 22 },
      { date: '2024-01-03', sent: 35, delivered: 33, read: 28 }
    ],
    categoryBreakdown: [
      { category: 'booking', count: 50, percentage: 33.3 },
      { category: 'payment', count: 40, percentage: 26.7 },
      { category: 'service', count: 35, percentage: 23.3 },
      { category: 'system', count: 25, percentage: 16.7 }
    ],
    channelPerformance: [
      { channel: 'in_app', sent: 150, delivered: 148, rate: 98.7 },
      { channel: 'email', sent: 100, delivered: 92, rate: 92.0 },
      { channel: 'push', sent: 75, delivered: 70, rate: 93.3 }
    ]
  };

  beforeEach(() => {
    mockApiRequest.mockClear();
    mockAuthContext.user.role = 'admin'; // Ensure admin access
  });

  it('should render analytics dashboard for admin users', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: mockAnalyticsData
    });

    renderWithQueryClient(<NotificationAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Notification Analytics')).toBeInTheDocument();
      expect(screen.getByText('150')).toBeInTheDocument(); // Total notifications
      expect(screen.getByText('94.7%')).toBeInTheDocument(); // Delivery rate
    });
  });

  it('should show access denied for non-admin users', () => {
    mockAuthContext.user.role = 'guest';

    renderWithQueryClient(<NotificationAnalyticsDashboard />);

    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to view analytics")).toBeInTheDocument();
  });

  it('should change time period filter', async () => {
    mockApiRequest.mockResolvedValue({
      data: mockAnalyticsData
    });

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last 7 days')).toBeInTheDocument();
    });

    const timeFilter = screen.getByDisplayValue('Last 7 days');
    await user.selectOptions(timeFilter, '30');

    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining('days=30'),
      undefined
    );
  });

  it('should export analytics data', async () => {
    mockApiRequest.mockResolvedValueOnce({
      data: mockAnalyticsData
    });

    // Mock URL.createObjectURL
    const mockCreateObjectURL = jest.fn(() => 'mock-blob-url');
    global.URL.createObjectURL = mockCreateObjectURL;

    // Mock link click
    const mockClick = jest.fn();
    const mockLink = { click: mockClick, href: '', download: '' };
    document.createElement = jest.fn(() => mockLink);

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
  });
});

describe('Integration Tests', () => {
  it('should handle API errors gracefully', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('API Error'));

    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('Error loading notifications')).toBeInTheDocument();
    });
  });

  it('should show network offline message', async () => {
    // Mock network offline
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    mockApiRequest.mockRejectedValueOnce(new Error('Network Error'));

    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('You are offline')).toBeInTheDocument();
    });
  });

  it('should retry failed requests', async () => {
    mockApiRequest
      .mockRejectedValueOnce(new Error('Temporary Error'))
      .mockResolvedValueOnce({
        data: {
          notifications: [],
          pagination: { page: 1, total: 0, pages: 0 }
        }
      });

    const user = userEvent.setup();
    renderWithQueryClient(<NotificationList />);

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    const retryButton = screen.getByText('Retry');
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('No notifications found')).toBeInTheDocument();
    });
  });
});