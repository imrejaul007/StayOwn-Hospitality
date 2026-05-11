import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/utils/toast';
import {
  Home, CheckCircle, Clock, Camera, Mic, MapPin, Wifi, WifiOff,
  AlertTriangle, RefreshCw, Upload, Download, Settings, User,
  Bed, Trash2, Zap, Droplets, Wind, Thermometer, Volume2,
  VolumeX, Battery, Signal, CloudOff, Cloud, Sync, CheckSquare,
  Calendar, BarChart3, Timer, Award, Target, TrendingUp, Eye,
  Edit, Save, X, Plus, Minus, RotateCcw, ScanLine, QrCode
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { withErrorBoundary } from '../ErrorBoundary';

interface HousekeepingTask {
  id: string;
  roomNumber: string;
  roomType: string;
  taskType: 'cleaning' | 'maintenance' | 'inspection' | 'deep_clean';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'requires_attention';
  assignedAt: Date;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration: number; // in minutes
  actualDuration?: number;
  description: string;
  checklist: ChecklistItem[];
  notes?: string;
  photos?: TaskPhoto[];
  voiceNotes?: VoiceNote[];
  isOfflineSync: boolean;
  location?: GeolocationCoordinates;
}

interface ChecklistItem {
  id: string;
  description: string;
  category: 'bathroom' | 'bedroom' | 'general' | 'amenities';
  completed: boolean;
  requiresPhoto?: boolean;
  requiresNote?: boolean;
  notes?: string;
  photoUrl?: string;
}

interface TaskPhoto {
  id: string;
  url: string;
  localUrl?: string;
  type: 'before' | 'during' | 'after' | 'issue' | 'completion';
  timestamp: Date;
  description?: string;
  isUploaded: boolean;
}

interface VoiceNote {
  id: string;
  url: string;
  localUrl?: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isUploaded: boolean;
}

interface OfflineData {
  tasks: HousekeepingTask[];
  photos: File[];
  voiceNotes: File[];
  lastSyncTime: Date;
}

const EnhancedMobileHousekeeping: React.FC = () => {
  // State management
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [currentTask, setCurrentTask] = useState<HousekeepingTask | null>(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
  // Offline/Online state
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueue, setOfflineQueue] = useState<OfflineData>({
    tasks: [],
    photos: [],
    voiceNotes: [],
    lastSyncTime: new Date()
  });
  
  // Voice and camera
  const [isRecording, setIsRecording] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Location
  const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  
  // Performance tracking
  const [dailyStats, setDailyStats] = useState({
    tasksCompleted: 0,
    totalTasks: 0,
    averageTime: 0,
    efficiency: 0,
    qualityScore: 0
  });
  
  // Timer
  const [taskTimer, setTaskTimer] = useState<{
    isRunning: boolean;
    startTime: Date | null;
    elapsed: number;
  }>({
    isRunning: false,
    startTime: null,
    elapsed: 0
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    initializeApp();
    setupEventListeners();
    
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    // Timer effect
    let interval: NodeJS.Timeout;
    if (taskTimer.isRunning && taskTimer.startTime) {
      interval = setInterval(() => {
        setTaskTimer(prev => ({
          ...prev,
          elapsed: Math.floor((Date.now() - prev.startTime!.getTime()) / 1000)
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [taskTimer.isRunning, taskTimer.startTime]);

  const initializeApp = async () => {
    try {
      // Load offline data from localStorage
      const savedOfflineData = localStorage.getItem('housekeeping_offline_data');
      if (savedOfflineData) {
        setOfflineQueue(JSON.parse(savedOfflineData));
      }
      
      // Get current location if permission granted
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation(position.coords);
            setLocationEnabled(true);
          },
          () => setLocationEnabled(false),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
      
      // Load tasks (from cache if offline, from server if online)
      await loadTasks();
      await loadDailyStats();
    } catch (error) {
      toast.error('Failed to initialize app');
    } finally {
      setLoading(false);
    }
  };

  const setupEventListeners = () => {
    // Online/offline detection
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Prevent zoom on double tap (mobile)
    document.addEventListener('touchstart', (e) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    }, { passive: false });
    
    // Visibility change for sync
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && isOnline) {
        syncOfflineData();
      }
    });
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  const handleOnline = () => {
    setIsOnline(true);
    toast.success('Connection restored - syncing data...');
    syncOfflineData();
  };

  const handleOffline = () => {
    setIsOnline(false);
    toast.error('Connection lost - working offline');
  };

  const loadTasks = async () => {
    try {
      if (isOnline) {
        // Fetch from server
        const { data } = await api.get('/housekeeping/my-tasks');
        setTasks(data.tasks);

        // Cache for offline use
        localStorage.setItem('housekeeping_tasks_cache', JSON.stringify(data.tasks));
      } else {
        // Load from cache
        const cachedTasks = localStorage.getItem('housekeeping_tasks_cache');
        if (cachedTasks) {
          setTasks(JSON.parse(cachedTasks));
        }
      }
    } catch (error) {
      // Load from cache on error
      const cachedTasks = localStorage.getItem('housekeeping_tasks_cache');
      if (cachedTasks) {
        setTasks(JSON.parse(cachedTasks));
      }
    }
  };

  const loadDailyStats = async () => {
    // Calculate daily stats from tasks
    const today = startOfDay(new Date());
    const todayTasks = tasks.filter(task => 
      new Date(task.assignedAt) >= today
    );
    
    const completedTasks = todayTasks.filter(task => task.status === 'completed');
    const totalTime = completedTasks.reduce((sum, task) => 
      sum + (task.actualDuration || 0), 0
    );
    
    setDailyStats({
      tasksCompleted: completedTasks.length,
      totalTasks: todayTasks.length,
      averageTime: completedTasks.length > 0 ? Math.round(totalTime / completedTasks.length) : 0,
      efficiency: todayTasks.length > 0 ? Math.round((completedTasks.length / todayTasks.length) * 100) : 0,
      qualityScore: 95 // Would be calculated from inspection results
    });
  };

  const startTask = async (task: HousekeepingTask) => {
    try {
      const updatedTask = {
        ...task,
        status: 'in_progress' as const,
        startedAt: new Date(),
        location: currentLocation || undefined
      };
      
      setCurrentTask(updatedTask);
      setTaskTimer({
        isRunning: true,
        startTime: new Date(),
        elapsed: 0
      });
      
      // Update in state
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      
      // Save to offline queue if offline
      if (!isOnline) {
        const newOfflineQueue = {
          ...offlineQueue,
          tasks: [...offlineQueue.tasks.filter(t => t.id !== task.id), updatedTask]
        };
        setOfflineQueue(newOfflineQueue);
        localStorage.setItem('housekeeping_offline_data', JSON.stringify(newOfflineQueue));
      } else {
        // Update server
        await api.post(`/housekeeping/tasks/${task.id}/start`, { location: currentLocation });
      }
      
      toast.success(`Started task for Room ${task.roomNumber}`);
    } catch (error) {
      toast.error('Failed to start task');
    }
  };

  const completeTask = async (task: HousekeepingTask) => {
    try {
      const duration = taskTimer.startTime 
        ? Math.floor((Date.now() - taskTimer.startTime.getTime()) / 60000) // in minutes
        : task.estimatedDuration;
      
      const updatedTask = {
        ...task,
        status: 'completed' as const,
        completedAt: new Date(),
        actualDuration: duration
      };
      
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
      setCurrentTask(null);
      setTaskTimer({ isRunning: false, startTime: null, elapsed: 0 });
      
      // Save to offline queue if offline
      if (!isOnline) {
        const newOfflineQueue = {
          ...offlineQueue,
          tasks: [...offlineQueue.tasks.filter(t => t.id !== task.id), updatedTask]
        };
        setOfflineQueue(newOfflineQueue);
        localStorage.setItem('housekeeping_offline_data', JSON.stringify(newOfflineQueue));
      } else {
        // Update server
        await api.post(`/housekeeping/tasks/${task.id}/complete`, {
          duration,
          checklist: task.checklist,
          notes: task.notes
        });
      }
      
      await loadDailyStats();
      toast.success(`Completed task for Room ${task.roomNumber}!`);
    } catch (error) {
      toast.error('Failed to complete task');
    }
  };

  const updateChecklistItem = (taskId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId
        ? {
            ...task,
            checklist: task.checklist.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            )
          }
        : task
    ));
    
    if (currentTask && currentTask.id === taskId) {
      setCurrentTask(prev => prev ? {
        ...prev,
        checklist: prev.checklist.map(item =>
          item.id === itemId ? { ...item, ...updates } : item
        )
      } : null);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline || syncing) return;
    
    try {
      setSyncing(true);
      
      // Sync tasks
      for (const task of offlineQueue.tasks) {
        await api.post(`/housekeeping/tasks/${task.id}/sync`, task);
      }

      // Sync photos
      for (const photo of offlineQueue.photos) {
        const formData = new FormData();
        formData.append('photo', photo);
        formData.append('taskId', photo.name.split('_')[0]); // Assuming filename format: taskId_timestamp.jpg

        await api.post('/housekeeping/photos/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      // Sync voice notes
      for (const voiceNote of offlineQueue.voiceNotes) {
        const formData = new FormData();
        formData.append('voice', voiceNote);
        formData.append('taskId', voiceNote.name.split('_')[0]);

        await api.post('/housekeeping/voice-notes/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      // Clear offline queue
      const clearedQueue = {
        tasks: [],
        photos: [],
        voiceNotes: [],
        lastSyncTime: new Date()
      };
      
      setOfflineQueue(clearedQueue);
      localStorage.setItem('housekeeping_offline_data', JSON.stringify(clearedQueue));
      
      toast.success('All data synced successfully!');
    } catch (error) {
      toast.error('Failed to sync some data');
    } finally {
      setSyncing(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (error) {
      toast.error('Failed to access camera');
    }
  };

  const capturePhoto = async (type: TaskPhoto['type'], description?: string) => {
    if (!currentTask || !videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      const photo: TaskPhoto = {
        id: Date.now().toString(),
        url: URL.createObjectURL(blob),
        localUrl: URL.createObjectURL(blob),
        type,
        timestamp: new Date(),
        description,
        isUploaded: false
      };
      
      // Update task
      const updatedTask = {
        ...currentTask,
        photos: [...(currentTask.photos || []), photo]
      };
      
      setCurrentTask(updatedTask);
      setTasks(prev => prev.map(t => t.id === currentTask.id ? updatedTask : t));
      
      // Save to offline queue if offline
      if (!isOnline) {
        const fileName = `${currentTask.id}_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        const newOfflineQueue = {
          ...offlineQueue,
          photos: [...offlineQueue.photos, file]
        };
        setOfflineQueue(newOfflineQueue);
        localStorage.setItem('housekeeping_offline_data', JSON.stringify(newOfflineQueue));
      }
      
      toast.success('Photo captured!');
      setShowCamera(false);
      
      // Stop camera stream
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }, 'image/jpeg', 0.9);
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const voiceNote: VoiceNote = {
          id: Date.now().toString(),
          url: URL.createObjectURL(blob),
          localUrl: URL.createObjectURL(blob),
          duration: recordingTime,
          timestamp: new Date(),
          isUploaded: false
        };
        
        if (currentTask) {
          const updatedTask = {
            ...currentTask,
            voiceNotes: [...(currentTask.voiceNotes || []), voiceNote]
          };
          setCurrentTask(updatedTask);
          setTasks(prev => prev.map(t => t.id === currentTask.id ? updatedTask : t));
          
          // Save to offline queue if offline
          if (!isOnline) {
            const fileName = `${currentTask.id}_${Date.now()}.wav`;
            const file = new File([blob], fileName, { type: 'audio/wav' });
            
            const newOfflineQueue = {
              ...offlineQueue,
              voiceNotes: [...offlineQueue.voiceNotes, file]
            };
            setOfflineQueue(newOfflineQueue);
            localStorage.setItem('housekeeping_offline_data', JSON.stringify(newOfflineQueue));
          }
        }
        
        stream.getTracks().forEach(track => track.stop());
        toast.success('Voice note saved!');
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        clearInterval(timer);
      }, 60000); // Max 1 minute recording
      
    } catch (error) {
      toast.error('Failed to start voice recording');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingTime(0);
    }
  };

  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'in_progress': return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'requires_attention': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Status Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-600" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-600" />
          )}
          <span className="text-sm font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {syncing && (
            <>
              <Sync className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-xs text-blue-600">Syncing...</span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {locationEnabled && (
            <MapPin className="w-4 h-4 text-green-600" />
          )}
          <Battery className="w-4 h-4 text-gray-600" />
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="current">Current</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            {/* Daily Overview */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {dailyStats.tasksCompleted}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {dailyStats.totalTasks - dailyStats.tasksCompleted}
                    </div>
                    <div className="text-sm text-gray-600">Remaining</div>
                  </div>
                </div>
                <Progress 
                  value={dailyStats.efficiency} 
                  className="mt-3" 
                />
                <div className="text-center text-sm text-gray-600 mt-1">
                  {dailyStats.efficiency}% Complete
                </div>
              </CardContent>
            </Card>

            {/* Task List */}
            <div className="space-y-3">
              {tasks.filter(task => task.status !== 'completed').map(task => (
                <Card key={task.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn(
                            'w-3 h-3 rounded-full',
                            getTaskPriorityColor(task.priority)
                          )} />
                          <span className="font-semibold">Room {task.roomNumber}</span>
                          <Badge variant="outline" className="text-xs">
                            {task.roomType}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">
                          {task.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {task.estimatedDuration}min
                          </div>
                          <div className="flex items-center gap-1">
                            {getTaskStatusIcon(task.status)}
                            {task.status.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        size="sm"
                        onClick={() => startTask(task)}
                        disabled={task.status === 'in_progress'}
                        className="ml-4"
                      >
                        {task.status === 'in_progress' ? 'In Progress' : 'Start'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="current">
            {currentTask ? (
              <div className="space-y-4">
                {/* Current Task Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Room {currentTask.roomNumber}</CardTitle>
                      <div className="text-2xl font-mono font-bold text-blue-600">
                        {formatTime(taskTimer.elapsed)}
                      </div>
                    </div>
                    <CardDescription>{currentTask.description}</CardDescription>
                  </CardHeader>
                </Card>

                {/* Checklist */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Checklist</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {currentTask.checklist.map(item => (
                      <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg">
                        <Switch
                          checked={item.completed}
                          onCheckedChange={(checked) => 
                            updateChecklistItem(currentTask.id, item.id, { completed: checked })
                          }
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className={cn(
                            'font-medium',
                            item.completed ? 'line-through text-gray-500' : ''
                          )}>
                            {item.description}
                          </div>
                          <div className="text-sm text-gray-600 capitalize">
                            {item.category.replace('_', ' ')}
                          </div>
                          
                          {item.requiresPhoto && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startCamera()}
                              className="mt-2 mr-2"
                            >
                              <Camera className="w-4 h-4 mr-1" />
                              Photo
                            </Button>
                          )}
                          
                          {item.requiresNote && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="mt-2">
                                  <Edit className="w-4 h-4 mr-1" />
                                  Note
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Add Note</DialogTitle>
                                </DialogHeader>
                                <Textarea
                                  value={item.notes || ''}
                                  onChange={(e) => 
                                    updateChecklistItem(currentTask.id, item.id, { notes: e.target.value })
                                  }
                                  placeholder="Enter your note..."
                                  rows={4}
                                />
                                <Button onClick={() => toast.success('Note saved!')}>
                                  Save Note
                                </Button>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => startCamera()}
                    className="h-12"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Take Photo
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={cn('h-12', isRecording ? 'bg-red-50 border-red-300' : '')}
                  >
                    {isRecording ? (
                      <>
                        <VolumeX className="w-5 h-5 mr-2" />
                        Stop ({recordingTime}s)
                      </>
                    ) : (
                      <>
                        <Mic className="w-5 h-5 mr-2" />
                        Voice Note
                      </>
                    )}
                  </Button>
                </div>

                {/* Photos and Voice Notes */}
                {(currentTask.photos?.length > 0 || currentTask.voiceNotes?.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Media</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {currentTask.photos?.map(photo => (
                        <div key={photo.id} className="flex items-center gap-3 p-2 border rounded mb-2">
                          <img 
                            src={photo.localUrl || photo.url} 
                            alt="Task photo" 
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div>
                            <div className="font-medium capitalize">{photo.type} Photo</div>
                            <div className="text-sm text-gray-600">
                              {format(photo.timestamp, 'HH:mm')}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {currentTask.voiceNotes?.map(note => (
                        <div key={note.id} className="flex items-center gap-3 p-2 border rounded mb-2">
                          <div className="w-16 h-16 bg-blue-100 rounded flex items-center justify-center">
                            <Mic className="w-8 h-8 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">Voice Note</div>
                            <div className="text-sm text-gray-600">
                              {note.duration}s • {format(note.timestamp, 'HH:mm')}
                            </div>
                            <audio controls className="mt-1" style={{ height: '30px', width: '150px' }}>
                              <source src={note.localUrl || note.url} type="audio/wav" />
                            </audio>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={currentTask.notes || ''}
                      onChange={(e) => setCurrentTask({ ...currentTask, notes: e.target.value })}
                      placeholder="Add any additional notes about this task..."
                      rows={4}
                    />
                  </CardContent>
                </Card>

                {/* Complete Button */}
                <Button
                  onClick={() => completeTask(currentTask)}
                  className="w-full h-12 text-lg"
                  disabled={currentTask.checklist.some(item => !item.completed)}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Complete Task
                </Button>
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Active Task</h3>
                  <p className="text-gray-600">Start a task from the Tasks tab to begin working.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stats">
            <div className="space-y-4">
              {/* Today's Performance */}
              <Card>
                <CardHeader>
                  <CardTitle>Today's Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <Award className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{dailyStats.efficiency}%</div>
                      <div className="text-sm text-gray-600">Efficiency</div>
                    </div>
                    
                    <div className="text-center p-4 border rounded-lg">
                      <Target className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{dailyStats.qualityScore}%</div>
                      <div className="text-sm text-gray-600">Quality Score</div>
                    </div>
                    
                    <div className="text-center p-4 border rounded-lg">
                      <Timer className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{dailyStats.averageTime}m</div>
                      <div className="text-sm text-gray-600">Avg Time</div>
                    </div>
                    
                    <div className="text-center p-4 border rounded-lg">
                      <TrendingUp className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                      <div className="text-2xl font-bold">{dailyStats.tasksCompleted}</div>
                      <div className="text-sm text-gray-600">Completed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Offline Data Status */}
              {offlineQueue.tasks.length > 0 || offlineQueue.photos.length > 0 || offlineQueue.voiceNotes.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CloudOff className="w-5 h-5 text-orange-500" />
                      Offline Data
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {offlineQueue.tasks.length > 0 && (
                        <div className="flex justify-between">
                          <span>Tasks to sync:</span>
                          <span className="font-semibold">{offlineQueue.tasks.length}</span>
                        </div>
                      )}
                      {offlineQueue.photos.length > 0 && (
                        <div className="flex justify-between">
                          <span>Photos to upload:</span>
                          <span className="font-semibold">{offlineQueue.photos.length}</span>
                        </div>
                      )}
                      {offlineQueue.voiceNotes.length > 0 && (
                        <div className="flex justify-between">
                          <span>Voice notes to upload:</span>
                          <span className="font-semibold">{offlineQueue.voiceNotes.length}</span>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      onClick={syncOfflineData}
                      disabled={!isOnline || syncing}
                      className="w-full mt-4"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Cloud className="w-4 h-4 mr-2" />
                          Sync Now
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Cloud className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All Data Synced</h3>
                    <p className="text-gray-600">All your work has been synchronized with the server.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Camera Modal */}
      <Dialog open={showCamera} onOpenChange={setShowCamera}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Capture Photo</DialogTitle>
          </DialogHeader>
          
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
              style={{ maxHeight: '400px' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
              <Button
                size="lg"
                onClick={() => capturePhoto('completion')}
                className="rounded-full w-16 h-16 bg-white text-black hover:bg-gray-100"
              >
                <Camera className="w-8 h-8" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default withErrorBoundary(EnhancedMobileHousekeeping, { level: 'component' });