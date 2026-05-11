import React from 'react';
import { render, screen } from '../../utils/testUtils';
import { MetricCard } from './MetricCard';

describe('MetricCard', () => {
  it('renders metric value and title correctly', () => {
    render(
      <MetricCard
        title="Total Revenue"
        value={125000}
        type="currency"
        color="green"
      />
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('$125,000')).toBeInTheDocument();
  });

  it('displays trend information when provided', () => {
    render(
      <MetricCard
        title="Occupancy Rate"
        value={85}
        type="percentage"
        trend={{
          value: 5.2,
          direction: 'up',
          label: 'vs last week'
        }}
        color="blue"
      />
    );

    expect(screen.getByText('Occupancy Rate')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('↗ 5.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    render(
      <MetricCard
        title="Total Bookings"
        value={0}
        loading={true}
        color="purple"
      />
    );

    expect(screen.getByText('Total Bookings')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('animate-pulse');
  });

  it('applies correct color theme', () => {
    const { container } = render(
      <MetricCard
        title="Guest Satisfaction"
        value={4.5}
        suffix="/5"
        color="yellow"
      />
    );

    const card = container.querySelector('.border-yellow-200');
    expect(card).toBeInTheDocument();
  });

  it('handles different value types', () => {
    const { rerender } = render(
      <MetricCard
        title="Revenue"
        value={125000}
        type="currency"
      />
    );

    expect(screen.getByText('$125,000')).toBeInTheDocument();

    rerender(
      <MetricCard
        title="Occupancy"
        value={85}
        type="percentage"
      />
    );

    expect(screen.getByText('85%')).toBeInTheDocument();

    rerender(
      <MetricCard
        title="Bookings"
        value={1234}
        type="number"
      />
    );

    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  it('is accessible', () => {
    const { container } = render(
      <MetricCard
        title="Test Metric"
        value={100}
        trend={{
          value: 10,
          direction: 'up',
          label: 'improvement'
        }}
      />
    );

    // Should have proper heading structure
    const title = screen.getByText('Test Metric');
    expect(title).toHaveClass('uppercase');

    // Should have proper color contrast
    const value = screen.getByText('100');
    expect(value).toHaveClass('text-gray-900');

    // Should not have any accessibility violations
    const violations = require('../../utils/testUtils').checkAccessibility(container);
    expect(violations).toHaveLength(0);
  });
});