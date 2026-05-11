import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Bed } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import TapeChartView from '../../components/tapechart/TapeChartView';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const FrontDeskTapeChart: React.FC = () => {
  const { selectedPropertyId } = useProperty();

  // Show message if no property is selected
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['Tape Chart']} />
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view the tape chart.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Breadcrumb - placed at the top */}
      <div className="bg-white border-b">
        <div className="px-4 lg:px-6 py-2">
          <PropertyBreadcrumb items={['Tape Chart']} />
        </div>
      </div>

      {/* Compact Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="px-4 lg:px-6 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-4">
              <Bed className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900">Tape Chart</h1>
                <p className="text-sm text-gray-600">View room assignments and availability</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tape Chart Content - ONLY THE MAIN TAPE CHART, NO OTHER TABS */}
      <div className="flex-1 overflow-hidden">
        <div className="animate-in fade-in-50 duration-300">
          <Card className="m-1 border-0 shadow-lg">
            <CardContent className="p-0">
              <TapeChartView />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(FrontDeskTapeChart);
