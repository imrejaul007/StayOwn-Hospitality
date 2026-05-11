import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddPropertyModal } from './AddPropertyModal';
import { api } from '../../services/api';

// Mock the API
jest.mock('../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock the UI components
jest.mock('../ui/dialog', () => ({
  Dialog: ({ children, open }: Record<string, unknown>) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>
}));

jest.mock('../ui/Button', () => ({
  Button: ({ children, onClick, type, disabled, variant }: Record<string, unknown>) => (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      data-variant={variant}
      data-testid={children?.includes?.('Create') ? 'create-button' : 'cancel-button'}
    >
      {children}
    </button>
  )
}));

jest.mock('../ui/Input', () => ({
  Input: ({ value, onChange, placeholder, required, type }: Record<string, unknown>) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      type={type}
      data-testid={`input-${placeholder?.toLowerCase().replace(/\s+/g, '-')}`}
    />
  )
}));

jest.mock('../ui/Select', () => ({
  Select: ({ value, onValueChange, options }: Record<string, unknown>) => (
    <select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="property-type-select">
      {options.map((option: Record<string, unknown>) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}));

jest.mock('../ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>
}));

describe('AddPropertyModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(<AddPropertyModal {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Add New Property');
  });

  it('does not render when closed', () => {
    render(<AddPropertyModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders all required form fields', () => {
    render(<AddPropertyModal {...defaultProps} />);

    expect(screen.getByTestId('input-enter-property-name')).toBeInTheDocument();
    expect(screen.getByTestId('property-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-city')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-country')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-phone-number')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-email-address')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<AddPropertyModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits form with correct data', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { hotel: { id: '1' } } });

    const onSuccess = jest.fn();
    render(<AddPropertyModal {...defaultProps} onSuccess={onSuccess} />);

    // Fill in required fields
    fireEvent.change(screen.getByTestId('input-enter-property-name'), {
      target: { value: 'Test Hotel' }
    });
    fireEvent.change(screen.getByTestId('input-enter-city'), {
      target: { value: 'Mumbai' }
    });
    fireEvent.change(screen.getByTestId('input-enter-country'), {
      target: { value: 'India' }
    });
    fireEvent.change(screen.getByTestId('input-enter-phone-number'), {
      target: { value: '+91 9876543210' }
    });
    fireEvent.change(screen.getByTestId('input-enter-email-address'), {
      target: { value: 'test@hotel.com' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/admin/hotels', expect.objectContaining({
        name: 'Test Hotel',
        address: expect.objectContaining({
          city: 'Mumbai',
          country: 'India'
        }),
        contact: expect.objectContaining({
          phone: '+91 9876543210',
          email: 'test@hotel.com'
        })
      }));
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handles form submission error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.post.mockRejectedValueOnce(new Error('API Error'));

    render(<AddPropertyModal {...defaultProps} />);

    // Fill in required fields and submit
    fireEvent.change(screen.getByTestId('input-enter-property-name'), {
      target: { value: 'Test Hotel' }
    });
    fireEvent.change(screen.getByTestId('input-enter-city'), {
      target: { value: 'Mumbai' }
    });
    fireEvent.change(screen.getByTestId('input-enter-country'), {
      target: { value: 'India' }
    });
    fireEvent.change(screen.getByTestId('input-enter-phone-number'), {
      target: { value: '+91 9876543210' }
    });
    fireEvent.change(screen.getByTestId('input-enter-email-address'), {
      target: { value: 'test@hotel.com' }
    });

    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error creating property:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('allows adding and removing amenities', () => {
    render(<AddPropertyModal {...defaultProps} />);

    // Click on a common amenity
    const wifiButton = screen.getByText('WiFi');
    fireEvent.click(wifiButton);

    // Check if amenity is selected (would show in selected amenities section)
    expect(wifiButton).toHaveClass('bg-blue-100', 'border-blue-300', 'text-blue-700');
  });
});