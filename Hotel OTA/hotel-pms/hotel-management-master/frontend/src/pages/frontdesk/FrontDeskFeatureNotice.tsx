import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface FrontDeskFeatureNoticeProps {
  title: string;
  description: string;
  fallbackPath?: string;
  fallbackLabel?: string;
}

function FrontDeskFeatureNotice({
  title,
  description,
  fallbackPath = '/frontdesk',
  fallbackLabel = 'Return to dashboard'
}: FrontDeskFeatureNoticeProps) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">{description}</p>
          <Button asChild>
            <Link to={fallbackPath}>
              {fallbackLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(FrontDeskFeatureNotice);
