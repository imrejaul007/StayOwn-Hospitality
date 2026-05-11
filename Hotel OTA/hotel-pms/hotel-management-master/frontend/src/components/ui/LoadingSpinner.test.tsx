import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingSpinner from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render with default size', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
  });

  it('should render with custom message', () => {
    render(<LoadingSpinner message="Loading data..." />);

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render with small size', () => {
    render(<LoadingSpinner size="small" />);

    const spinner = screen.getByRole('status');
    expect(spinner.querySelector('svg')).toHaveClass('w-4', 'h-4');
  });

  it('should render with large size', () => {
    render(<LoadingSpinner size="large" />);

    const spinner = screen.getByRole('status');
    expect(spinner.querySelector('svg')).toHaveClass('w-8', 'h-8');
  });

  it('should render with custom className', () => {
    render(<LoadingSpinner className="custom-spinner" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-spinner');
  });

  it('should render centered layout', () => {
    render(<LoadingSpinner centered />);

    const container = screen.getByRole('status').parentElement;
    expect(container).toHaveClass('flex', 'justify-center', 'items-center');
  });

  it('should render with overlay style', () => {
    render(<LoadingSpinner overlay />);

    const container = screen.getByRole('status').parentElement;
    expect(container).toHaveClass('absolute', 'inset-0', 'bg-white', 'bg-opacity-75');
  });

  it('should be accessible with proper aria attributes', () => {
    render(<LoadingSpinner message="Loading content" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-label', 'Loading');

    const hiddenText = spinner.querySelector('.sr-only');
    expect(hiddenText).toHaveTextContent('Loading');
  });

  it('should render different variants', () => {
    const { rerender } = render(<LoadingSpinner variant="primary" />);
    let spinner = screen.getByRole('status');
    expect(spinner.querySelector('svg')).toHaveClass('text-blue-600');

    rerender(<LoadingSpinner variant="secondary" />);
    spinner = screen.getByRole('status');
    expect(spinner.querySelector('svg')).toHaveClass('text-gray-600');

    rerender(<LoadingSpinner variant="success" />);
    spinner = screen.getByRole('status');
    expect(spinner.querySelector('svg')).toHaveClass('text-green-600');
  });
});