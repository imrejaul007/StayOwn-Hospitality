import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Eye, 
  FileText, 
  Printer, 
  Mail, 
  Download,
  RefreshCw,
  Calendar,
  User,
  IndianRupee,
  Hash,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BillMessage {
  _id: string;
  code: string;
  name: string;
  type: string;
  category: string;
  template: {
    subject?: string;
    content: string;
    variables: string[];
    footer?: string;
  };
  formatting: {
    fontSize: number;
    fontFamily: string;
    alignment: string;
    lineHeight: number;
    margins: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    headerImage?: string;
    footerText?: string;
  };
  triggers: {
    events: string[];
    conditions: Array<{
      field: string;
      operator: string;
      value: string;
    }>;
    schedule?: {
      frequency: string;
      time?: string;
      daysOfWeek?: number[];
    };
  };
  settings: {
    printAutomatically: boolean;
    emailToGuest: boolean;
    attachToFolio: boolean;
    requireApproval: boolean;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface PreviewData {
  roomNumber?: string;
  guestName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  totalAmount?: number;
  folioNumber?: string;
  customVariables?: Record<string, string>;
}

interface BillMessagePreviewProps {
  message?: BillMessage;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

const BillMessagePreview: React.FC<BillMessagePreviewProps> = ({
  message,
  isOpen,
  onClose,
  onEdit
}) => {
  const [previewData, setPreviewData] = useState<PreviewData>({
    roomNumber: '101',
    guestName: 'John Doe',
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    totalAmount: 450.00,
    folioNumber: 'F2024001',
    customVariables: {}
  });
  const [processedContent, setProcessedContent] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
    };
  }, []);

  // Sample variable mappings for preview
  const variableMap: Record<string, string> = {
    '{roomNumber}': previewData.roomNumber || '',
    '{guestName}': previewData.guestName || '',
    '{checkInDate}': previewData.checkInDate ? format(new Date(previewData.checkInDate), 'MMM dd, yyyy') : '',
    '{checkOutDate}': previewData.checkOutDate ? format(new Date(previewData.checkOutDate), 'MMM dd, yyyy') : '',
    '{totalAmount}': previewData.totalAmount ? `$${previewData.totalAmount.toFixed(2)}` : '',
    '{folioNumber}': previewData.folioNumber || '',
    '{currentDate}': format(new Date(), 'MMM dd, yyyy'),
    '{hotelName}': 'Grand Hotel',
    '{hotelPhone}': '(555) 123-4567',
    '{hotelEmail}': 'info@grandhotel.com'
  };

  const processTemplate = (template: string): string => {
    let processed = template;
    
    // Replace standard variables
    Object.entries(variableMap).forEach(([variable, value]) => {
      processed = processed.replace(new RegExp(variable.replace(/[{}]/g, '\\$&'), 'g'), value);
    });

    // Replace custom variables
    Object.entries(previewData.customVariables || {}).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });

    return processed;
  };

  const validateTemplate = (template: string): string[] => {
    const errors: string[] = [];
    const variableRegex = /{([^}]+)}/g;
    const matches = template.match(variableRegex);
    
    if (matches) {
      matches.forEach(match => {
        const variable = match;
        const key = match.slice(1, -1);
        
        if (!variableMap[variable] && !previewData.customVariables?.[key]) {
          errors.push(`Unknown variable: ${variable}`);
        }
      });
    }

    return errors;
  };

  useEffect(() => {
    if (message?.template.content) {
      setIsProcessing(true);
      
      // Simulate processing delay
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      processingTimerRef.current = setTimeout(() => {
        const processed = processTemplate(message.template.content);
        const errors = validateTemplate(message.template.content);

        setProcessedContent(processed);
        setValidationErrors(errors);
        setIsProcessing(false);
      }, 500);
    }
  }, [message, previewData]);

  const handlePreviewDataChange = (field: keyof PreviewData, value: string | number) => {
    setPreviewData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCustomVariableChange = (key: string, value: string) => {
    setPreviewData(prev => ({
      ...prev,
      customVariables: {
        ...prev.customVariables,
        [key]: value
      }
    }));
  };

  const handlePrint = async () => {
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        const printContent = `
          <html>
            <head>
              <title>${message?.name} - Preview</title>
              <style>
                body {
                  font-family: ${message?.formatting.fontFamily || 'Arial'};
                  font-size: ${message?.formatting.fontSize || 12}px;
                  line-height: ${message?.formatting.lineHeight || 1.5};
                  text-align: ${message?.formatting.alignment || 'left'};
                  margin: ${message?.formatting.margins?.top || 20}px ${message?.formatting.margins?.right || 20}px ${message?.formatting.margins?.bottom || 20}px ${message?.formatting.margins?.left || 20}px;
                }
                .header { margin-bottom: 20px; }
                .content { white-space: pre-wrap; }
                .footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; }
              </style>
            </head>
            <body>
              ${message?.formatting.headerImage ? `<div class="header"><img src="${message.formatting.headerImage}" alt="Header" /></div>` : ''}
              <div class="content">${processedContent}</div>
              ${message?.formatting.footerText ? `<div class="footer">${message.formatting.footerText}</div>` : ''}
            </body>
          </html>
        `;
        printWindow.document.write(DOMPurify.sanitize(printContent, { WHOLE_DOCUMENT: true }));
        printWindow.document.close();
        printWindow.print();
      }
      toast.success('Print dialog opened');
    } catch (error) {
      toast.error('Failed to open print dialog');
    }
  };

  const handleExport = async (format: 'pdf' | 'txt' | 'html') => {
    try {
      // In a real implementation, you'd call an API endpoint
      const content = processedContent;
      const blob = new Blob([content], { 
        type: format === 'html' ? 'text/html' : 'text/plain' 
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${message?.code || 'message'}_preview.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`Message exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export message');
    }
  };

  if (!isOpen || !message) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Message Preview</h2>
                <p className="text-sm text-gray-500">{message.name} ({message.code})</p>
              </div>
              <Badge 
                variant={message.status === 'active' ? 'default' : 'secondary'}
                className="ml-2"
              >
                {message.status}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-2">
              {onEdit && (
                <Button variant="outline" onClick={onEdit} className="flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Edit</span>
                </Button>
              )}
              <Button variant="outline" onClick={handlePrint} className="flex items-center space-x-2">
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </Button>
              <Select onValueChange={(value: 'pdf' | 'txt' | 'html') => handleExport(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Export" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="html">HTML</SelectItem>
                  <SelectItem value="txt">Text</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel - Preview Data */}
            <div className="w-1/3 border-r bg-gray-50 p-6 overflow-y-auto">
              <div className="space-y-6">
                {/* Message Info */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Message Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Type:</span>
                      <Badge variant="outline">{message.type}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Category:</span>
                      <span className="text-sm font-medium">{message.category}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Created:</span>
                      <span className="text-sm">{format(new Date(message.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Preview Data */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Preview Data</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label htmlFor="roomNumber" className="text-xs">Room Number</Label>
                        <Input
                          id="roomNumber"
                          value={previewData.roomNumber}
                          onChange={(e) => handlePreviewDataChange('roomNumber', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="guestName" className="text-xs">Guest Name</Label>
                        <Input
                          id="guestName"
                          value={previewData.guestName}
                          onChange={(e) => handlePreviewDataChange('guestName', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="folioNumber" className="text-xs">Folio Number</Label>
                        <Input
                          id="folioNumber"
                          value={previewData.folioNumber}
                          onChange={(e) => handlePreviewDataChange('folioNumber', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="totalAmount" className="text-xs">Total Amount</Label>
                        <Input
                          id="totalAmount"
                          type="number"
                          step="0.01"
                          value={previewData.totalAmount}
                          onChange={(e) => handlePreviewDataChange('totalAmount', parseFloat(e.target.value) || 0)}
                          className="h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="checkInDate" className="text-xs">Check-in Date</Label>
                        <Input
                          id="checkInDate"
                          type="date"
                          value={previewData.checkInDate}
                          onChange={(e) => handlePreviewDataChange('checkInDate', e.target.value)}
                          className="h-8"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="checkOutDate" className="text-xs">Check-out Date</Label>
                        <Input
                          id="checkOutDate"
                          type="date"
                          value={previewData.checkOutDate}
                          onChange={(e) => handlePreviewDataChange('checkOutDate', e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>

                    {/* Custom Variables */}
                    {message.template.variables?.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-xs font-medium">Custom Variables</Label>
                          <div className="space-y-2 mt-2">
                            {message.template.variables.map((variable) => (
                              <div key={variable}>
                                <Label htmlFor={`custom-${variable}`} className="text-xs">{variable}</Label>
                                <Input
                                  id={`custom-${variable}`}
                                  value={previewData.customVariables?.[variable] || ''}
                                  onChange={(e) => handleCustomVariableChange(variable, e.target.value)}
                                  className="h-8"
                                  placeholder={`Enter ${variable} value`}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Validation Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Validation Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {validationErrors.length === 0 ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Template is valid</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-amber-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-sm">Validation Issues</span>
                        </div>
                        <ul className="text-xs text-red-600 space-y-1">
                          {validationErrors.map((error, index) => (
                            <li key={`validationErrors-${index}-${error}`}>• {error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Right Panel - Preview Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Preview Controls */}
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <h3 className="font-medium text-gray-900">Live Preview</h3>
                  {isProcessing && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Processing...</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>Font: {message.formatting.fontFamily}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Size: {message.formatting.fontSize}px</span>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                <div 
                  className="bg-white border rounded-lg shadow-sm p-8 max-w-2xl mx-auto"
                  style={{
                    fontFamily: message.formatting.fontFamily || 'Arial',
                    fontSize: `${message.formatting.fontSize || 12}px`,
                    lineHeight: message.formatting.lineHeight || 1.5,
                    textAlign: message.formatting.alignment as unknown || 'left',
                    marginTop: `${message.formatting.margins?.top || 0}px`,
                    marginBottom: `${message.formatting.margins?.bottom || 0}px`,
                    marginLeft: `${message.formatting.margins?.left || 0}px`,
                    marginRight: `${message.formatting.margins?.right || 0}px`
                  }}
                >
                  {/* Header */}
                  {message.formatting.headerImage && (
                    <div className="mb-6 text-center">
                      <img 
                        src={message.formatting.headerImage} 
                        alt="Header" 
                        className="max-w-full h-auto mx-auto"
                        style={{ maxHeight: '100px' }}
                      />
                    </div>
                  )}

                  {/* Subject */}
                  {message.template.subject && (
                    <div className="mb-4">
                      <h1 className="text-lg font-bold text-gray-900">
                        {processTemplate(message.template.subject)}
                      </h1>
                    </div>
                  )}

                  {/* Content */}
                  <div
                    className="whitespace-pre-wrap text-gray-800 mb-6"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(processedContent.replace(/\n/g, '<br/>'))
                    }}
                  />

                  {/* Footer */}
                  {message.formatting.footerText && (
                    <div className="mt-6 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        {processTemplate(message.formatting.footerText)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillMessagePreview;