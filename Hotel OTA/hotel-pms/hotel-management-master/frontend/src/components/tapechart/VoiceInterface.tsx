import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/utils/toast';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '@/services/api';
import { useProperty } from '@/context/PropertyContext';
import {
  Mic, MicOff, Volume2, VolumeX, Languages,
  MessageSquare, Settings, Play, Pause,
  RotateCcw, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';

// Voice Interface Types
interface VoiceCommand {
  id: string;
  trigger: string;
  action: string;
  description: string;
  category: 'room' | 'guest' | 'booking' | 'housekeeping' | 'navigation';
  language: string;
  enabled: boolean;
  confidence: number;
}

interface VoiceSettings {
  enabled: boolean;
  language: string;
  wakeWord: string;
  sensitivity: number;
  autoResponse: boolean;
  voiceGender: 'male' | 'female' | 'neutral';
  speechRate: number;
  volume: number;
}

interface ConversationLog {
  id: string;
  timestamp: string;
  userInput: string;
  systemResponse: string;
  action: string;
  success: boolean;
  language: string;
}

export const VoiceInterface: React.FC = () => {
  const { selectedPropertyId } = useProperty();
  const [isListening, setIsListening] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [recognition, setRecognition] = useState<unknown>(null);
  const [synthesis, setSynthesis] = useState<SpeechSynthesis | null>(null);
  const [currentCommand, setCurrentCommand] = useState<string>('');

  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    enabled: true,
    language: 'en-US',
    wakeWord: 'Hotel Assistant',
    sensitivity: 0.7,
    autoResponse: true,
    voiceGender: 'female',
    speechRate: 1.0,
    volume: 0.8
  });

  const [voiceCommands, setVoiceCommands] = useState<VoiceCommand[]>([]);
  const [conversationLog, setConversationLog] = useState<ConversationLog[]>([]);
  const [supportedLanguages] = useState([
    { code: 'en-US', name: 'English (US)', flag: '🇺🇸' },
    { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧' },
    { code: 'es-ES', name: 'Spanish', flag: '🇪🇸' },
    { code: 'fr-FR', name: 'French', flag: '🇫🇷' },
    { code: 'de-DE', name: 'German', flag: '🇩🇪' },
    { code: 'it-IT', name: 'Italian', flag: '🇮🇹' },
    { code: 'pt-BR', name: 'Portuguese', flag: '🇧🇷' },
    { code: 'zh-CN', name: 'Chinese', flag: '🇨🇳' },
    { code: 'ja-JP', name: 'Japanese', flag: '🇯🇵' },
    { code: 'hi-IN', name: 'Hindi', flag: '🇮🇳' }
  ]);

  useEffect(() => {
    initializeVoiceFeatures();
    loadVoiceCommands();
  }, []);

  const initializeVoiceFeatures = () => {
    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as unknown).SpeechRecognition || (window as unknown).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = voiceSettings.language;

      recognitionInstance.onstart = () => {
        setIsListening(true);
      };

      recognitionInstance.onend = () => {
        setIsListening(false);
      };

      recognitionInstance.onresult = (event: unknown) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        const confidence = event.results[current][0].confidence;

        setCurrentCommand(transcript);

        if (event.results[current].isFinal) {
          processVoiceCommand(transcript, confidence);
        }
      };

      recognitionInstance.onerror = (event: unknown) => {
        toast.error(`Voice recognition error: ${event.error}`);
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
      setSynthesis(window.speechSynthesis);
    }
  };

  const loadVoiceCommands = () => {
    const commands: VoiceCommand[] = [
      // Room Management Commands
      {
        id: 'check-room-status',
        trigger: 'check room status',
        action: 'checkRoomStatus',
        description: 'Check the status of a specific room',
        category: 'room',
        language: 'en-US',
        enabled: true,
        confidence: 0.8
      },
      {
        id: 'set-room-clean',
        trigger: 'set room clean',
        action: 'setRoomClean',
        description: 'Mark a room as clean',
        category: 'room',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },
      {
        id: 'set-room-dirty',
        trigger: 'set room dirty',
        action: 'setRoomDirty',
        description: 'Mark a room as dirty',
        category: 'room',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },

      // Guest Management Commands
      {
        id: 'check-guest-info',
        trigger: 'check guest information',
        action: 'checkGuestInfo',
        description: 'Get guest information for a booking',
        category: 'guest',
        language: 'en-US',
        enabled: true,
        confidence: 0.8
      },
      {
        id: 'check-in-guest',
        trigger: 'check in guest',
        action: 'checkInGuest',
        description: 'Process guest check-in',
        category: 'guest',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },
      {
        id: 'check-out-guest',
        trigger: 'check out guest',
        action: 'checkOutGuest',
        description: 'Process guest check-out',
        category: 'guest',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },

      // Booking Commands
      {
        id: 'create-booking',
        trigger: 'create new booking',
        action: 'createBooking',
        description: 'Create a new reservation',
        category: 'booking',
        language: 'en-US',
        enabled: true,
        confidence: 0.8
      },
      {
        id: 'cancel-booking',
        trigger: 'cancel booking',
        action: 'cancelBooking',
        description: 'Cancel an existing booking',
        category: 'booking',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },

      // Navigation Commands
      {
        id: 'show-dashboard',
        trigger: 'show dashboard',
        action: 'navigateDashboard',
        description: 'Navigate to main dashboard',
        category: 'navigation',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },
      {
        id: 'show-bookings',
        trigger: 'show bookings',
        action: 'navigateBookings',
        description: 'Navigate to bookings page',
        category: 'navigation',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },
      {
        id: 'search-bookings',
        trigger: 'search bookings',
        action: 'searchBookings',
        description: 'Search recent bookings',
        category: 'booking',
        language: 'en-US',
        enabled: true,
        confidence: 0.8
      },
      {
        id: 'open-reports',
        trigger: 'open reports',
        action: 'openReports',
        description: 'Navigate to reports page',
        category: 'navigation',
        language: 'en-US',
        enabled: true,
        confidence: 0.9
      },
      {
        id: 'request-maintenance',
        trigger: 'request maintenance',
        action: 'requestMaintenance',
        description: 'Create a maintenance request for a room',
        category: 'housekeeping',
        language: 'en-US',
        enabled: true,
        confidence: 0.8
      }
    ];

    setVoiceCommands(commands);
  };

  const processVoiceCommand = async (transcript: string, confidence: number) => {
    const command = transcript.toLowerCase().trim();

    // Find matching command
    const matchedCommand = voiceCommands.find(cmd =>
      cmd.enabled &&
      command.includes(cmd.trigger.toLowerCase()) &&
      confidence >= cmd.confidence
    );

    if (matchedCommand) {
      const response = await executeVoiceCommand(matchedCommand, command);

      // Log conversation
      const logEntry: ConversationLog = {
        id: `conv-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userInput: transcript,
        systemResponse: response.message,
        action: matchedCommand.action,
        success: response.success,
        language: voiceSettings.language
      };

      setConversationLog(prev => [logEntry, ...prev.slice(0, 49)]); // Keep last 50 entries

      // Speak response if auto-response enabled
      if (voiceSettings.autoResponse && synthesis) {
        speakResponse(response.message);
      }

      if (response.success) {
        toast.success(`Voice command executed: ${matchedCommand.description}`);
      } else {
        toast.error(`Voice command failed: ${response.message}`);
      }
    } else {
      const fallbackMessage = getLocalizedMessage('command_not_recognized', voiceSettings.language);

      if (voiceSettings.autoResponse && synthesis) {
        speakResponse(fallbackMessage);
      }

      toast.warning(fallbackMessage);
    }
  };

  /**
   * Helper: find a room document by its roomNumber for the current property.
   * The /rooms endpoint does not support a roomNumber filter, so we fetch a
   * page of up to 200 rooms and match client-side.  For properties with more
   * rooms a dedicated search endpoint would be better, but this covers the
   * vast majority of hotels.
   */
  const findRoomByNumber = async (roomNumber: string) => {
    const res = await api.get('/rooms', {
      params: { hotelId: selectedPropertyId, page: 1, limit: 200 },
    });
    const rooms = res.data?.data?.rooms ?? res.data?.rooms ?? res.data?.data ?? [];
    return (rooms as Array<{ _id: string; roomNumber: string; status: string; type: string; floor?: number }>)
      .find((r) => String(r.roomNumber) === String(roomNumber)) ?? null;
  };

  const executeVoiceCommand = async (command: VoiceCommand, fullTranscript: string): Promise<{success: boolean, message: string}> => {
    try {
      switch (command.action) {
        // ----- Room commands -----
        case 'checkRoomStatus': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number' };

          const room = await findRoomByNumber(roomNumber);
          if (!room) return { success: false, message: `Room ${roomNumber} was not found` };

          return {
            success: true,
            message: `Room ${roomNumber} is currently ${room.status}${room.type ? ` (${room.type})` : ''}`
          };
        }

        case 'setRoomClean': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number' };

          const room = await findRoomByNumber(roomNumber);
          if (!room) return { success: false, message: `Room ${roomNumber} was not found` };

          await api.put(`/tape-chart/rooms/${room._id}/status`, {
            status: 'vacant',
            changeReason: 'Marked clean via voice command',
            notes: 'Voice command: set room clean',
          });

          return { success: true, message: `Room ${roomNumber} has been marked as clean` };
        }

        case 'setRoomDirty': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number' };

          const room = await findRoomByNumber(roomNumber);
          if (!room) return { success: false, message: `Room ${roomNumber} was not found` };

          await api.put(`/tape-chart/rooms/${room._id}/status`, {
            status: 'dirty',
            changeReason: 'Marked dirty via voice command',
            notes: 'Voice command: set room dirty',
          });

          return { success: true, message: `Room ${roomNumber} has been marked as dirty` };
        }

        // ----- Guest commands -----
        case 'checkGuestInfo': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number' };

          const res = await api.get(`/guest-lookup/room/${roomNumber}`, {
            params: { hotelId: selectedPropertyId },
          });

          const data = res.data?.data;
          if (!data?.guest) return { success: false, message: `No guest found for room ${roomNumber}` };

          const guest = data.guest;
          const booking = data.booking;
          const checkOut = booking?.checkOut ? new Date(booking.checkOut).toLocaleDateString() : 'N/A';

          return {
            success: true,
            message: `Guest in room ${roomNumber}: ${guest.name}. Booking #${booking?.bookingNumber ?? 'N/A'}, status: ${booking?.status ?? 'N/A'}, check-out: ${checkOut}`
          };
        }

        case 'checkInGuest': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number for check-in' };

          // Find the booking associated with this room
          const lookupRes = await api.get(`/guest-lookup/room/${roomNumber}`, {
            params: { hotelId: selectedPropertyId },
          });

          const bookingData = lookupRes.data?.data?.booking;
          if (!bookingData?.id) return { success: false, message: `No active booking found for room ${roomNumber}` };

          await api.patch(`/bookings/${bookingData.id}/check-in`, {});

          return {
            success: true,
            message: `Guest in room ${roomNumber} (Booking #${bookingData.bookingNumber}) has been checked in`
          };
        }

        case 'checkOutGuest': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number for check-out' };

          const lookupRes = await api.get(`/guest-lookup/room/${roomNumber}`, {
            params: { hotelId: selectedPropertyId },
          });

          const bookingData = lookupRes.data?.data?.booking;
          if (!bookingData?.id) return { success: false, message: `No active booking found for room ${roomNumber}` };

          await api.patch(`/bookings/${bookingData.id}/check-out`, {});

          return {
            success: true,
            message: `Guest in room ${roomNumber} (Booking #${bookingData.bookingNumber}) has been checked out`
          };
        }

        // ----- Booking commands -----
        case 'createBooking': {
          // Creating a booking requires many fields; navigate to the booking creation page instead
          window.location.href = '/admin/bookings/new';
          return {
            success: true,
            message: 'Navigating to create a new booking'
          };
        }

        case 'cancelBooking': {
          // Extract a booking number from the transcript (e.g., "cancel booking 12345")
          const bookingMatch = fullTranscript.match(/booking\s+(?:#?\s*)?(\w+)/i);
          if (!bookingMatch) return { success: false, message: 'Please specify a booking number to cancel' };
          const searchTerm = bookingMatch[1];

          // Search for the booking first
          const searchRes = await api.get('/bookings', {
            params: { hotelId: selectedPropertyId, page: 1, limit: 5 },
          });
          const bookings = searchRes.data?.data?.bookings ?? searchRes.data?.bookings ?? [];
          const found = (bookings as Array<{ _id: string; bookingNumber: string; status: string }>)
            .find((b) => String(b.bookingNumber).includes(searchTerm));

          if (!found) return { success: false, message: `Booking ${searchTerm} not found` };

          await api.patch(`/bookings/${found._id}`, { status: 'cancelled' });

          return {
            success: true,
            message: `Booking #${found.bookingNumber} has been cancelled`
          };
        }

        case 'searchBookings': {
          const searchQuery = fullTranscript.replace(/search\s+bookings?\s*/i, '').trim();
          const searchRes = await api.get('/bookings', {
            params: {
              hotelId: selectedPropertyId,
              page: 1,
              limit: 5,
            },
          });
          const bookings = searchRes.data?.data?.bookings ?? searchRes.data?.bookings ?? [];
          if (!bookings.length) return { success: true, message: 'No bookings found' };

          const summary = (bookings as Array<{ bookingNumber: string; status: string; userId?: { name?: string } }>)
            .slice(0, 3)
            .map((b) => `#${b.bookingNumber} (${b.status})${b.userId?.name ? ` - ${b.userId.name}` : ''}`)
            .join('; ');

          return {
            success: true,
            message: `Found ${bookings.length} booking(s): ${summary}`
          };
        }

        // ----- Navigation commands -----
        case 'navigateDashboard': {
          window.location.href = '/admin';
          return {
            success: true,
            message: 'Navigating to dashboard'
          };
        }

        case 'navigateBookings': {
          window.location.href = '/admin/bookings';
          return {
            success: true,
            message: 'Navigating to bookings page'
          };
        }

        case 'openReports': {
          window.location.href = '/admin/reports';
          return {
            success: true,
            message: 'Navigating to reports page'
          };
        }

        // ----- Housekeeping / Maintenance commands -----
        case 'requestMaintenance': {
          const roomNumber = extractRoomNumber(fullTranscript);
          if (!roomNumber) return { success: false, message: 'Please specify a room number for the maintenance request' };

          const room = await findRoomByNumber(roomNumber);
          if (!room) return { success: false, message: `Room ${roomNumber} was not found` };

          await api.post('/housekeeping', {
            title: `Maintenance request for Room ${roomNumber}`,
            roomId: room._id,
            taskType: 'maintenance',
            priority: 'medium',
            description: `Maintenance requested via voice command: "${fullTranscript}"`,
          });

          return {
            success: true,
            message: `Maintenance request created for room ${roomNumber}`
          };
        }

        default:
          return { success: false, message: 'Command not implemented' };
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'An error occurred while processing the command';
      const axiosMsg = (error as { response?: { data?: { message?: string; error?: { message?: string } } } })
        ?.response?.data?.message
        ?? (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message;
      return { success: false, message: axiosMsg || errMsg };
    }
  };

  const extractRoomNumber = (transcript: string): string | null => {
    const roomMatch = transcript.match(/room\s+(\d+)/i) || transcript.match(/(\d+)/);
    return roomMatch ? roomMatch[1] : null;
  };

  const speakResponse = (text: string) => {
    if (!synthesis) return;

    // Cancel any ongoing speech
    synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceSettings.language;
    utterance.rate = voiceSettings.speechRate;
    utterance.volume = voiceSettings.volume;

    // Try to set voice gender
    const voices = synthesis.getVoices();
    const preferredVoice = voices.find(voice =>
      voice.lang.startsWith(voiceSettings.language.split('-')[0]) &&
      voice.name.toLowerCase().includes(voiceSettings.voiceGender)
    ) || voices.find(voice => voice.lang.startsWith(voiceSettings.language.split('-')[0]));

    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    synthesis.speak(utterance);
  };

  const getLocalizedMessage = (key: string, language: string): string => {
    const messages: {[key: string]: {[lang: string]: string}} = {
      command_not_recognized: {
        'en-US': "I didn't understand that command. Please try again.",
        'es-ES': 'No entendí ese comando. Por favor, inténtalo de nuevo.',
        'fr-FR': "Je n'ai pas compris cette commande. Veuillez réessayer.",
        'de-DE': 'Ich habe diesen Befehl nicht verstanden. Bitte versuchen Sie es erneut.',
        'hi-IN': 'मुझे वह कमांड समझ नहीं आया। कृपया फिर से कोशिश करें।'
      }
    };

    return messages[key]?.[language] || messages[key]?.['en-US'] || "Command not recognized";
  };

  const startListening = () => {
    if (recognition && !isListening) {
      recognition.lang = voiceSettings.language;
      recognition.start();
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  const toggleVoiceCommand = (commandId: string) => {
    setVoiceCommands(prev => prev.map(cmd =>
      cmd.id === commandId ? { ...cmd, enabled: !cmd.enabled } : cmd
    ));
  };

  const testVoiceCommand = (command: VoiceCommand) => {
    const testTranscript = `${command.trigger} 101`;
    processVoiceCommand(testTranscript, 1.0);
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      room: 'bg-blue-100 text-blue-800',
      guest: 'bg-green-100 text-green-800',
      booking: 'bg-purple-100 text-purple-800',
      housekeeping: 'bg-orange-100 text-orange-800',
      navigation: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Mic className="h-4 w-4" />
          Voice Interface
          <Badge className="bg-purple-100 text-purple-800">Phase 3</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Voice & Conversational Interface
            <Badge className="bg-purple-100 text-purple-800">
              Innovation Leadership
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Advanced voice commands and multilingual conversational interface for hands-free hotel operations
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="voice-control" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="voice-control">Voice Control</TabsTrigger>
            <TabsTrigger value="commands">Commands</TabsTrigger>
            <TabsTrigger value="conversation">Conversation Log</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="voice-control" className="space-y-4">
            {/* Voice Control Interface */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Voice Control Center
                  <div className="flex items-center gap-2">
                    <Badge className={isListening ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}>
                      {isListening ? 'Listening...' : 'Ready'}
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Main Control */}
                <div className="text-center space-y-4">
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-100 border-4 border-red-300 animate-pulse'
                      : 'bg-blue-100 border-4 border-blue-300'
                  }`}>
                    {isListening ? (
                      <MicOff className="h-16 w-16 text-red-600" />
                    ) : (
                      <Mic className="h-16 w-16 text-blue-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {isListening ? 'Listening...' : 'Click to Start'}
                    </div>
                    <div className="text-sm text-gray-600">
                      Say "{voiceSettings.wakeWord}" followed by your command
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center">
                    <Button
                      size="lg"
                      onClick={isListening ? stopListening : startListening}
                      className="gap-2"
                    >
                      {isListening ? (
                        <>
                          <MicOff className="h-4 w-4" />
                          Stop Listening
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          Start Listening
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => speakResponse('Voice interface is ready for commands')}
                      className="gap-2"
                    >
                      <Volume2 className="h-4 w-4" />
                      Test Voice
                    </Button>
                  </div>
                </div>

                {/* Current Command Display */}
                {currentCommand && (
                  <Card className="bg-blue-50">
                    <CardContent className="p-4">
                      <div className="text-sm font-medium text-blue-800 mb-1">Current Command:</div>
                      <div className="text-lg">{currentCommand}</div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-1"
                    onClick={() => processVoiceCommand('check room status 205', 1.0)}
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-xs">Check Room</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-1"
                    onClick={() => processVoiceCommand('set room clean 101', 1.0)}
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span className="text-xs">Clean Room</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-1"
                    onClick={() => processVoiceCommand('check guest information 305', 1.0)}
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">Guest Info</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="h-16 flex-col gap-1"
                    onClick={() => processVoiceCommand('show dashboard', 1.0)}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="text-xs">Dashboard</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commands" className="space-y-4">
            {/* Voice Commands Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Voice Commands Library
                  <Badge className="bg-green-100 text-green-800">
                    {voiceCommands.filter(cmd => cmd.enabled).length} Active
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {voiceCommands.map((command) => (
                    <div key={command.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={command.enabled}
                            onCheckedChange={() => toggleVoiceCommand(command.id)}
                          />
                          <Badge className={getCategoryColor(command.category)}>
                            {command.category}
                          </Badge>
                        </div>

                        <div>
                          <div className="font-medium">"{command.trigger}"</div>
                          <div className="text-sm text-gray-600">{command.description}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            Confidence: {(command.confidence * 100).toFixed(0)}% • Language: {command.language}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testVoiceCommand(command)}
                          className="gap-1"
                        >
                          <Play className="h-3 w-3" />
                          Test
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conversation" className="space-y-4">
            {/* Conversation History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Conversation Log
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConversationLog([])}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Clear Log
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {conversationLog.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No conversations yet. Start using voice commands to see the log.
                    </div>
                  ) : (
                    conversationLog.map((log) => (
                      <div key={log.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="text-sm text-gray-600">
                            {new Date(log.timestamp).toLocaleString()}
                          </div>
                          <Badge className={log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {log.success ? 'Success' : 'Failed'}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <span className="text-sm font-medium text-blue-600">User: </span>
                            <span className="text-sm">"{log.userInput}"</span>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-green-600">System: </span>
                            <span className="text-sm">{log.systemResponse}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Action: {log.action} • Language: {log.language}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Voice Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Voice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Language Selection */}
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={voiceSettings.language}
                      onValueChange={(value) => setVoiceSettings(prev => ({ ...prev, language: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {supportedLanguages.map((lang) => (
                          <SelectItem key={lang.code} value={lang.code}>
                            <span className="flex items-center gap-2">
                              <span>{lang.flag}</span>
                              <span>{lang.name}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Wake Word */}
                  <div className="space-y-2">
                    <Label>Wake Word</Label>
                    <Input
                      value={voiceSettings.wakeWord}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, wakeWord: e.target.value }))}
                      placeholder="Hotel Assistant"
                    />
                  </div>

                  {/* Voice Gender */}
                  <div className="space-y-2">
                    <Label>Voice Gender</Label>
                    <Select
                      value={voiceSettings.voiceGender}
                      onValueChange={(value) => setVoiceSettings(prev => ({ ...prev, voiceGender: value as string }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Speech Rate */}
                  <div className="space-y-2">
                    <Label>Speech Rate: {voiceSettings.speechRate.toFixed(1)}x</Label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceSettings.speechRate}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, speechRate: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Auto Response Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Voice Response</Label>
                    <div className="text-sm text-gray-600">
                      Automatically speak system responses
                    </div>
                  </div>
                  <Switch
                    checked={voiceSettings.autoResponse}
                    onCheckedChange={(checked) => setVoiceSettings(prev => ({ ...prev, autoResponse: checked }))}
                  />
                </div>

                {/* Test Settings */}
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => speakResponse(`Voice settings configured for ${supportedLanguages.find(l => l.code === voiceSettings.language)?.name}`)}
                    className="gap-2"
                  >
                    <Volume2 className="h-4 w-4" />
                    Test Voice Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(VoiceInterface, { level: 'component' });