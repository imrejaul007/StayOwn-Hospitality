import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import {
  Shield,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface ComplianceReportingProps {
  propertyGroupId?: string;
  onGenerateReport?: (type: string, filters: Record<string, unknown>) => void;
  onExportReport?: (reportId: string, format: string) => void;
}

export const ComplianceReporting: React.FC<ComplianceReportingProps> = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Compliance Monitoring Not Configured</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                Compliance monitoring has not been configured for this property. Real compliance assessments
                require integration with your organization&#39;s compliance management tools and formal audit processes.
              </p>
              <p className="mb-2">
                Displaying fabricated compliance scores (GDPR, PCI-DSS, SOX) without actual assessments could
                create a false sense of security and lead to real regulatory issues.
              </p>
              <p className="font-medium">
                Contact your system administrator to configure compliance monitoring with verified assessment data.
              </p>
            </AlertDescription>
          </Alert>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-700">GDPR Compliance</div>
                <div className="text-xs text-muted-foreground mt-1">Not assessed</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-700">PCI DSS Compliance</div>
                <div className="text-xs text-muted-foreground mt-1">Not assessed</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <div className="text-sm font-medium text-gray-700">SOX Compliance</div>
                <div className="text-xs text-muted-foreground mt-1">Not assessed</div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
