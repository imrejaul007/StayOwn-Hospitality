import React from 'react';
import { useProperty } from '../../context/PropertyContext';
import AdminDashboard from './AdminDashboard';
import PortfolioDashboard from './PortfolioDashboard';

/**
 * Wrapper component to handle switching between single-property and portfolio dashboards
 * This prevents React hooks errors by deciding which component to render BEFORE any hooks are called
 */
export default function AdminDashboardWrapper() {
  const { viewMode } = useProperty();

  // Render portfolio or single property dashboard based on viewMode
  // This must be done at the top level to avoid hook ordering issues
  if (viewMode === 'all') {
    return <PortfolioDashboard />;
  }

  return <AdminDashboard />;
}
