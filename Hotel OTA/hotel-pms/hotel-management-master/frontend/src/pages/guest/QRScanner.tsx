import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Loader2, QrCode, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '@/components/ErrorBoundary';

interface QRPayload {
  roomId: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  hotelId: string;
  hotelName: string;
  bookingId?: string;
  guestName?: string;
  checkIn?: string;
  checkOut?: string;
  expiresAt?: string;
  signature?: string;
  timestamp?: number;
}

const QRScanner: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanned, setLastScanned] = useState<QRPayload | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startCamera = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      return;
    }

    try {
      const html5Qrcode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5Qrcode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
        ],
        aspectRatio: 1,
      };

      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);
      setHasCamera(true);
    } catch (err: any) {
      console.error('Camera error:', err);
      setHasCamera(false);
      setManualMode(true);
      toast.error('Camera access denied. Please enter QR code manually.');
    }
  }, []);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current?.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
  }, []);

  const onScanSuccess = useCallback((decodedText: string) => {
    if (isProcessing) return;
    processQRCode(decodedText);
  }, [isProcessing]);

  const onScanFailure = useCallback((errorMessage: string) => {
    // Silent failure - camera is still scanning
  }, []);

  const processQRCode = async (qrData: string) => {
    setIsProcessing(true);

    try {
      let payload: QRPayload;

      // Try to decode as base64 JSON first
      try {
        const decoded = atob(qrData);
        payload = JSON.parse(decoded);
      } catch {
        // If that fails, try URL params format
        try {
          const params = new URLSearchParams(qrData);
          payload = {
            roomId: params.get('roomId') || '',
            roomNumber: params.get('roomNumber') || '',
            roomType: params.get('roomType') || '',
            floor: params.get('floor') || '',
            hotelId: params.get('hotelId') || '',
            hotelName: params.get('hotelName') || '',
            bookingId: params.get('bookingId') || undefined,
            guestName: params.get('guestName') || undefined,
            checkIn: params.get('checkIn') || undefined,
            checkOut: params.get('checkOut') || undefined,
            expiresAt: params.get('expiresAt') || undefined,
            signature: params.get('signature') || undefined,
            timestamp: params.get('timestamp') ? parseInt(params.get('timestamp')!) : undefined,
          };
        } catch {
          throw new Error('Invalid QR code format');
        }
      }

      // Validate required fields
      if (!payload.roomId || !payload.hotelId) {
        throw new Error('Missing required room information');
      }

      // Check expiration if present
      if (payload.expiresAt) {
        const expiryDate = new Date(payload.expiresAt);
        if (expiryDate < new Date()) {
          throw new Error('This QR code has expired. Please contact front desk.');
        }
      }

      // Validate signature if present (basic check)
      if (payload.signature && payload.timestamp) {
        const age = Date.now() - payload.timestamp;
        const fiveMinutes = 5 * 60 * 1000;
        if (age > fiveMinutes) {
          throw new Error('QR code signature has expired. Please refresh.');
        }
      }

      setLastScanned(payload);

      // Navigate to RoomHub with the payload data
      const queryParams = new URLSearchParams({
        roomId: payload.roomId,
        roomNumber: payload.roomNumber,
        roomType: payload.roomType,
        floor: payload.floor,
        hotelId: payload.hotelId,
        hotelName: payload.hotelName,
        ...(payload.bookingId && { bookingId: payload.bookingId }),
        ...(payload.guestName && { guestName: payload.guestName }),
        ...(payload.checkIn && { checkIn: payload.checkIn }),
        ...(payload.checkOut && { checkOut: payload.checkOut }),
        ...(payload.expiresAt && { expiresAt: payload.expiresAt }),
      });

      // Store in localStorage for persistence
      localStorage.setItem('roomContext', JSON.stringify(payload));

      // Stop camera before navigating
      await stopCamera();

      toast.success(`Room ${payload.roomNumber} connected!`);
      navigate(`/room-hub?${queryParams.toString()}`);
    } catch (err: any) {
      console.error('QR processing error:', err);
      toast.error(err.message || 'Failed to process QR code');
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      processQRCode(manualCode.trim());
    }
  };

  useEffect(() => {
    // Check for demo mode from URL params
    const demo = searchParams.get('demo');
    if (demo === 'true') {
      // Auto-load demo room context
      const demoPayload: QRPayload = {
        roomId: 'demo-room-101',
        roomNumber: '101',
        roomType: 'Deluxe King',
        floor: '1',
        hotelId: 'demo-hotel-001',
        hotelName: 'Demo Hotel',
        bookingId: 'demo-booking-001',
        guestName: 'Demo Guest',
        checkIn: new Date().toISOString(),
        checkOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      setLastScanned(demoPayload);
    }
  }, [searchParams]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopCamera();
    };
  }, [stopCamera]);

  const toggleCamera = () => {
    if (isScanning) {
      stopCamera();
    } else {
      startCamera();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full mb-4">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Room QR Scanner</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Scan the QR code on your room door to access services
          </p>
        </div>

        {/* Scanner Card */}
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <CardTitle className="flex items-center gap-2">
              {isScanning ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
              {isScanning ? 'Camera Active' : 'Camera Inactive'}
            </CardTitle>
            <CardDescription className="text-blue-100">
              {isScanning
                ? 'Point your camera at the QR code on your room door'
                : 'Tap "Start Camera" to scan QR code'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            {/* Camera View */}
            <div className="relative">
              <div
                id="qr-reader"
                ref={containerRef}
                className={`w-full rounded-lg overflow-hidden ${!isScanning ? 'hidden' : ''}`}
                style={{ minHeight: '250px' }}
              />

              {/* Scanner Overlay when not scanning */}
              {!isScanning && (
                <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <div className="text-center space-y-3">
                    {hasCamera ? (
                      <>
                        <Camera className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Camera preview will appear here
                        </p>
                      </>
                    ) : (
                      <>
                        <CameraOff className="w-12 h-12 text-gray-400 mx-auto" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Camera not available
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Scanning indicator */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <div className="text-white text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p>Processing...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls */}
            <div className="flex gap-2">
              <Button
                onClick={toggleCamera}
                className={`flex-1 ${isScanning
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-blue-500 hover:bg-blue-600'
                }`}
                disabled={!hasCamera && isScanning}
              >
                {isScanning ? (
                  <>
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => setManualMode(!manualMode)}
              >
                {manualMode ? <Camera className="w-4 h-4" /> : <QrCode className="w-4 h-4" />}
              </Button>
            </div>

            {/* Manual Entry */}
            {manualMode && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                    Enter QR Code Data Manually
                  </label>
                  <Input
                    type="text"
                    placeholder="Paste QR code data here..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!manualCode.trim()}>
                  Process Code
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Demo Mode Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              Demo Mode
            </CardTitle>
            <CardDescription>
              Try the Room Hub without scanning a QR code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const demoPayload: QRPayload = {
                  roomId: 'demo-room-101',
                  roomNumber: '101',
                  roomType: 'Deluxe King',
                  floor: '1',
                  hotelId: 'demo-hotel-001',
                  hotelName: 'Demo Hotel',
                  bookingId: 'demo-booking-001',
                  guestName: 'Demo Guest',
                  checkIn: new Date().toISOString(),
                  checkOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                };

                localStorage.setItem('roomContext', JSON.stringify(demoPayload));

                const queryParams = new URLSearchParams({
                  roomId: demoPayload.roomId,
                  roomNumber: demoPayload.roomNumber,
                  roomType: demoPayload.roomType,
                  floor: demoPayload.floor,
                  hotelId: demoPayload.hotelId,
                  hotelName: demoPayload.hotelName,
                  bookingId: demoPayload.bookingId || '',
                  guestName: demoPayload.guestName || '',
                  checkIn: demoPayload.checkIn || '',
                  checkOut: demoPayload.checkOut || '',
                  expiresAt: demoPayload.expiresAt || '',
                });

                navigate(`/room-hub?${queryParams.toString()}`);
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Open Demo Room Hub
            </Button>
          </CardContent>
        </Card>

        {/* Last Scanned Info */}
        {lastScanned && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                Last Scanned Room
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm text-green-800 dark:text-green-300">
                <p><strong>Room:</strong> {lastScanned.roomNumber}</p>
                <p><strong>Type:</strong> {lastScanned.roomType}</p>
                <p><strong>Floor:</strong> {lastScanned.floor}</p>
                {lastScanned.guestName && (
                  <p><strong>Guest:</strong> {lastScanned.guestName}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">QR Code Location</p>
                <p>
                  Find the QR code on your room door or床头柜. Each QR code is unique to your room
                  and is valid for your stay duration.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default withErrorBoundary(QRScanner, 'QRScanner');
