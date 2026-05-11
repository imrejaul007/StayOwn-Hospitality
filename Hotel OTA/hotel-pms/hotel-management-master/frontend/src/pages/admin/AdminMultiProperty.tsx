import React from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { MultiPropertyManager } from '../../components/multi-property/MultiPropertyManager';

const AdminMultiProperty: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <MultiPropertyManager />
    </div>
  );
};

export default AdminMultiProperty;