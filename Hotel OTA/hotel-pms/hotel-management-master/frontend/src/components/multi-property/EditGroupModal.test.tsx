import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditGroupModal } from './EditGroupModal';
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
      data-testid={
        children?.includes?.('Update') ? 'update-button' :
        children?.includes?.('Delete') ? 'delete-button' : 'cancel-button'
      }
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

describe('EditGroupModal', () => {
  const mockGroup = {
    _id: '1',
    name: 'Test Group',
    description: 'Test Description',
    type: 'chain',
    manager: 'test@manager.com',
    budget: 500000,
    settings: {
      autoSync: true,
      consolidatedReporting: false,
      sharedInventory: true
    }
  };

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onSuccess: jest.fn(),
    group: mockGroup
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.confirm
    global.confirm = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders when open with group data', () => {
    render(<EditGroupModal {...defaultProps} />);

    expect(screen.getByTestId('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('dialog-title')).toHaveTextContent('Edit Property Group');
  });

  it('does not render when closed', () => {
    render(<EditGroupModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('does not render when group is null', () => {
    render(<EditGroupModal {...defaultProps} group={null} />);

    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('pre-fills form with group data', () => {
    render(<EditGroupModal {...defaultProps} />);

    expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@manager.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500000')).toBeInTheDocument();
    expect(screen.getByTestId('group-type-select')).toHaveValue('chain');
  });

  it('calls onClose when cancel button is clicked', () => {
    const onClose = jest.fn();
    render(<EditGroupModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('submits updated form data', async () => {
    mockedApi.put.mockResolvedValueOnce({ data: { group: mockGroup } });

    const onSuccess = jest.fn();
    render(<EditGroupModal {...defaultProps} onSuccess={onSuccess} />);

    // Update the name
    fireEvent.change(screen.getByDisplayValue('Test Group'), {
      target: { value: 'Updated Group Name' }
    });

    // Submit form
    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith('/property-groups/1', expect.objectContaining({
        name: 'Updated Group Name',
        type: 'chain',
        manager: 'test@manager.com',
        budget: 500000
      }));
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('handles update error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockedApi.put.mockRejectedValueOnce(new Error('API Error'));

    render(<EditGroupModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('update-button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error updating property group:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('deletes group when confirmed', async () => {
    (global.confirm as jest.Mock).mockReturnValue(true);
    mockedApi.delete.mockResolvedValueOnce({ data: {} });

    const onSuccess = jest.fn();
    render(<EditGroupModal {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    expect(global.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete the group "Test Group"? This action cannot be undone.'
    );

    await waitFor(() => {
      expect(mockedApi.delete).toHaveBeenCalledWith('/property-groups/1');
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('does not delete group when not confirmed', () => {
    (global.confirm as jest.Mock).mockReturnValue(false);

    render(<EditGroupModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    expect(global.confirm).toHaveBeenCalled();
    expect(mockedApi.delete).not.toHaveBeenCalled();
  });

  it('handles delete error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    (global.confirm as jest.Mock).mockReturnValue(true);
    mockedApi.delete.mockRejectedValueOnce(new Error('Delete Error'));

    render(<EditGroupModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('delete-button'));

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Error deleting property group:', expect.any(Error));
    });

    consoleError.mockRestore();
  });

  it('updates form when group prop changes', () => {
    const { rerender } = render(<EditGroupModal {...defaultProps} />);

    expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();

    const updatedGroup = { ...mockGroup, name: 'New Group Name' };
    rerender(<EditGroupModal {...defaultProps} group={updatedGroup} />);

    expect(screen.getByDisplayValue('New Group Name')).toBeInTheDocument();
  });
});