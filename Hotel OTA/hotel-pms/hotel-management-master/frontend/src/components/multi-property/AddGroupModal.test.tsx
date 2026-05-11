import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddGroupModal } from './AddGroupModal';
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
    <select value={value} onChange={(e) => onValueChange(e.target.value)} data-testid="group-type-select">
      {options.map((option: Record<string, unknown>) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}));

describe('AddGroupModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when open', () => {
    render(<AddGroupModal {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Add New Property Group');
  });

  it('does not render when closed', () => {
    render(<AddGroupModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders all form fields', () => {
    render(<AddGroupModal {...defaultProps} />);

    expect(screen.getByTestId('input-enter-group-name')).toBeInTheDocument();
    expect(screen.getByTestId('group-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-manager-name-or-email')).toBeInTheDocument();
    expect(screen.getByTestId('input-enter-annual-budget')).toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<AddGroupModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits form with correct data', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { group: { id: '1' } } });

    const onSuccess = jest.fn();
    render(<AddGroupModal {...defaultProps} onSuccess={onSuccess} />);

    // Fill in required fields
    fireEvent.change(screen.getByTestId('input-enter-group-name'), {
      target: { value: 'Test Group' }
    });
    fireEvent.change(screen.getByTestId('group-type-select'), {
      target: { value: 'chain' }
    });
    fireEvent.change(screen.getByTestId('input-enter-manager-name-or-email'), {
      target: { value: 'manager@test.com' }
    });
    fireEvent.change(screen.getByTestId('input-enter-annual-budget'), {
      target: { value: '1000000' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith('/property-groups', expect.objectContaining({
        name: 'Test Group',
        type: 'chain',
        manager: 'manager@test.com',
        budget: 1000000
      }));
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handles form submission error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.post.mockRejectedValueOnce(new Error('API Error'));

    render(<AddGroupModal {...defaultProps} />);

    // Fill in required fields and submit
    fireEvent.change(screen.getByTestId('input-enter-group-name'), {
      target: { value: 'Test Group' }
    });

    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error creating property group:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('toggles settings checkboxes', () => {
    render(<AddGroupModal {...defaultProps} />);

    // Find checkboxes by their parent labels or specific attributes
    const autoSyncCheckbox = screen.getByRole('checkbox', { name: '' });

    // Initially should be checked (default value)
    expect(autoSyncCheckbox).toBeChecked();

    // Click to uncheck
    fireEvent.click(autoSyncCheckbox);
    expect(autoSyncCheckbox).not.toBeChecked();
  });

  it('has correct default values', () => {
    render(<AddGroupModal {...defaultProps} />);

    expect(screen.getByTestId('group-type-select')).toHaveValue('chain');
    expect(screen.getByTestId('input-enter-annual-budget')).toHaveValue('0');
  });
});