import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Smartphone,
  Settings,
  AlertCircle
} from 'lucide-react';
import { withErrorBoundary } from '../ErrorBoundary';

export const MobileAppInfrastructure: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Mobile App Infrastructure</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile App Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Mobile App Infrastructure Not Configured
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-4">
              Mobile application management, push notification services, and device analytics
              require integration with a mobile app platform (e.g., Firebase, App Store Connect,
              Google Play Console).
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Settings className="h-4 w-4" />
              <span>Contact your system administrator to set up mobile app infrastructure.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default withErrorBoundary(MobileAppInfrastructure);
