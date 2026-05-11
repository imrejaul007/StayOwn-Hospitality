import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, type LucideIcon } from 'lucide-react';

interface ComingSoonFeatureProps {
  name: string;
  description: string;
  icon: LucideIcon;
  capabilities: string[];
  badgeText?: string;
  badgeColor?: string;
  phase?: number;
}

export function ComingSoonFeature({
  name,
  description,
  icon: Icon,
  capabilities,
  badgeText = 'Coming Soon',
  badgeColor = 'bg-gray-100 text-gray-600',
  phase,
}: ComingSoonFeatureProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative opacity-75 hover:opacity-100 transition-opacity"
        >
          <Icon className="h-4 w-4 mr-2 text-gray-400" />
          {name}
          <Badge variant="secondary" className={`ml-2 text-[10px] ${badgeColor}`}>
            {phase ? `Phase ${phase}` : badgeText}
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Icon className="h-5 w-5 text-gray-600" />
            </div>
            {name}
            <Badge variant="secondary" className={badgeColor}>
              {badgeText}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-gray-600">{description}</p>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Planned Capabilities</h4>
            <ul className="space-y-1.5">
              {capabilities.map((cap) => (
                <li key={cap} className="flex items-start gap-2 text-sm text-gray-600">
                  <Clock className="h-3.5 w-3.5 mt-0.5 text-gray-400 shrink-0" />
                  {cap}
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-gray-500 text-center">
              This feature is under development and will be available in a future release.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ComingSoonFeature;
