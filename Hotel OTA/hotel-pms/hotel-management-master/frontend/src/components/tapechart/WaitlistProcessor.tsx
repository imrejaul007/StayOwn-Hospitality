import React, { useState, useEffect } from 'react';
import { waitlistService, WaitlistEntry, WaitlistAnalytics, MatchResult as ServiceMatchResult } from '../../services/waitlistService';
import { formatCurrency } from '@/utils/currencyUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withErrorBoundary } from '../ErrorBoundary';
import {
  BarChart3,
  UserCheckIcon,
  ClockIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  SettingsIcon,
  StarIcon,
  CalendarIcon,
  CreditCardIcon,
  RefreshCwIcon
} from 'lucide-react';

// Using MatchResult from service as ServiceMatchResult
interface MatchResult extends ServiceMatchResult {
  waitlistEntryId: string; // Map _id to waitlistEntryId for compatibility
}

interface WaitlistSettings {
  autoProcessing: boolean;
  processInterval: number; // minutes
  minimumMatchScore: number;
  autoConfirmThreshold: number;
  maxContactAttempts: number;
  contactDelayHours: number;
  prioritizeVIP: boolean;
  considerAlternativeRoomTypes: boolean;
}

// Using WaitlistAnalytics from service, with local extension
interface WaitlistStats {
  totalWaiting: number;
  processedToday: number;
  successfulMatches: number;
  conversionRate: number;
  averageWaitTime: number;
  priorityQueue: number;
}

export const WaitlistProcessor: React.FC = () => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [settings, setSettings] = useState<WaitlistSettings>({
    autoProcessing: true,
    processInterval: 15,
    minimumMatchScore: 75,
    autoConfirmThreshold: 90,
    maxContactAttempts: 3,
    contactDelayHours: 2,
    prioritizeVIP: true,
    considerAlternativeRoomTypes: true
  });
  const [stats, setStats] = useState<WaitlistStats>({
    totalWaiting: 0,
    processedToday: 0,
    successfulMatches: 0,
    conversionRate: 0,
    averageWaitTime: 0,
    priorityQueue: 0
  });
  const [processing, setProcessing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('waiting');

  useEffect(() => {
    loadWaitlistData();
    loadWaitlistStats();
    if (settings.autoProcessing) {
      const interval = setInterval(processWaitlist, settings.processInterval * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [settings.autoProcessing, settings.processInterval]);

  const loadWaitlistData = async () => {
    try {
      // Load real waitlist data from backend
      const response = await waitlistService.getActiveWaitlist({
        status: filterStatus === 'all' ? undefined : filterStatus,
        limit: 50
      });

      if (response.status === 'success') {
        setWaitlist(response.data.waitlist);

        // Extract matches from waitlist entries that have match results
        const allMatches: MatchResult[] = [];
        response.data.waitlist.forEach((entry: WaitlistEntry) => {
          if (entry.matchResults && entry.matchResults.length > 0) {
            entry.matchResults.forEach(match => {
              allMatches.push({
                ...match,
                waitlistEntryId: entry._id,
                _id: match._id
              });
            });
          }
        });
        setMatches(allMatches);
      }
    } catch (error) {
      // Fallback to empty arrays on error
      setWaitlist([]);
      setMatches([]);
    }
  };

  const loadWaitlistStats = async () => {
    try {
      const analytics = await waitlistService.getWaitlistAnalytics('month');

      const totalStats = analytics.totalStats[0] || {};
      const periodStats = analytics.periodStats[0] || {};

      const calculatedStats: WaitlistStats = {
        totalWaiting: totalStats.totalWaiting || 0,
        processedToday: periodStats.processedToday || 0,
        successfulMatches: periodStats.successfulMatches || 0,
        conversionRate: totalStats.totalWaiting > 0
          ? Math.round((periodStats.successfulMatches / totalStats.totalWaiting) * 100)
          : 0,
        averageWaitTime: totalStats.averageWaitTime || 0,
        priorityQueue: totalStats.priorityQueue || 0
      };

      setStats(calculatedStats);
    } catch (error) {
      // Fallback to zero stats on error
      setStats({
        totalWaiting: 0,
        processedToday: 0,
        successfulMatches: 0,
        conversionRate: 0,
        averageWaitTime: 0,
        priorityQueue: 0
      });
    }
  };

  const processWaitlist = async () => {
    setProcessing(true);

    try {
      // Process waitlist matches using backend service
      const response = await waitlistService.processWaitlistMatches(true);

      if (response.status === 'success') {
        // Reload data to show new matches
        await loadWaitlistData();
        await loadWaitlistStats();
      }
    } catch {
      // Error handled silently
    } finally {
      setProcessing(false);
    }
  };

  const getTierColor = (tier: string): string => {
    return waitlistService.getTierColor(tier);
  };

  const getUrgencyColor = (urgency: string): string => {
    return waitlistService.getUrgencyColor(urgency);
  };

  const getStatusColor = (status: string): string => {
    return waitlistService.getStatusColor(status);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <ClockIcon className="h-4 w-4" />;
      case 'matched':
        return <TrendingUpIcon className="h-4 w-4" />;
      case 'contacted':
        return <UserCheckIcon className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircleIcon className="h-4 w-4" />;
      case 'declined':
        return <XCircleIcon className="h-4 w-4" />;
      case 'expired':
        return <AlertCircleIcon className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  const confirmMatch = async (waitlistId: string, matchId: string) => {
    try {
      await waitlistService.handleMatchAction(waitlistId, matchId, 'confirm', 'Match confirmed from waitlist processor');
      // Reload data to reflect changes
      await loadWaitlistData();
      await loadWaitlistStats();
    } catch {
      // Error handled silently
    }
  };

  const declineMatch = async (waitlistId: string, matchId: string) => {
    try {
      await waitlistService.handleMatchAction(waitlistId, matchId, 'decline', 'Match declined from waitlist processor');
      // Reload data to reflect changes
      await loadWaitlistData();
      await loadWaitlistStats();
    } catch {
      // Error handled silently
    }
  };

  const contactGuest = async (entryId: string) => {
    try {
      await waitlistService.contactWaitlistGuest(entryId, 'email', 'Contacted via waitlist processor');
      // Reload data to reflect changes
      await loadWaitlistData();
      await loadWaitlistStats();
    } catch {
      // Error handled silently
    }
  };

  const filteredWaitlist = waitlist.filter(entry =>
    filterStatus === 'all' || entry.status === filterStatus
  );

  // Sort by priority: Use backend calculated priority, then by creation date
  const prioritizedWaitlist = [...filteredWaitlist].sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority; // Higher priority first
    }
    // If priority is the same, sort by creation date (oldest first)
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-2 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 hover:text-gray-800 transition-all duration-200 shadow-sm hover:shadow-md rounded-lg"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-gray-600" />
            <span className="font-medium">Waitlist Processor</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] bg-white rounded-xl shadow-2xl border-0 p-0 overflow-hidden flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  Automated Waitlist Processing
                </DialogTitle>
                <p className="text-purple-100 text-sm">Intelligently match guests with available rooms and optimize occupancy</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                {stats.totalWaiting} WAITING
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Tabs defaultValue="dashboard" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-50 border border-gray-200 rounded-lg p-1 mb-6">
              <TabsTrigger 
                value="dashboard"
                className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="waitlist"
                className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Waitlist Queue
              </TabsTrigger>
              <TabsTrigger 
                value="matches"
                className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Smart Matches
              </TabsTrigger>
              <TabsTrigger 
                value="settings"
                className="data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                Settings
              </TabsTrigger>
            </TabsList>

          <TabsContent value="dashboard" className="space-y-4">
            {/* Processing Status */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle>Processing Status</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={settings.autoProcessing ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {settings.autoProcessing ? <PlayIcon className="h-3 w-3 mr-1" /> : <PauseIcon className="h-3 w-3 mr-1" />}
                      {settings.autoProcessing ? 'Auto Processing ON' : 'Auto Processing OFF'}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={processWaitlist}
                      disabled={processing}
                      className="gap-2"
                    >
                      <RefreshCwIcon className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
                      {processing ? 'Processing...' : 'Process Now'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.totalWaiting}</div>
                    <div className="text-sm text-gray-600">Total Waiting</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.priorityQueue}</div>
                    <div className="text-sm text-gray-600">Priority Queue</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.processedToday}</div>
                    <div className="text-sm text-gray-600">Processed Today</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.successfulMatches}</div>
                    <div className="text-sm text-gray-600">Successful Matches</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{stats.conversionRate}%</div>
                    <div className="text-sm text-gray-600">Conversion Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{Math.round(stats.averageWaitTime)}h</div>
                    <div className="text-sm text-gray-600">Avg Wait Time</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Matches */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Smart Matches</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {matches.slice(0, 5).map((match) => {
                    const entry = waitlist.find(e => e._id === match.waitlistEntryId);
                    return (
                      <div key={match.waitlistEntryId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                          <div>
                            <div className="font-medium">{entry?.guestInfo.name}</div>
                            <div className="text-sm text-gray-600">
                              {match.roomType} - Room {match.roomNumber}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            {match.matchScore}% Match
                          </Badge>
                          <Badge className={getTierColor(entry?.guestInfo.tier || 'regular')}>
                            {entry?.guestInfo.tier?.toUpperCase()}
                          </Badge>
                          <div className="text-sm text-gray-500">
                            {match.recommendedAction.replace('_', ' ').toUpperCase()}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {matches.length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      No recent matches. Run processing to find new matches.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="waitlist" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
                <div className="text-sm text-gray-600">
                  {prioritizedWaitlist.length} entries (Priority sorted)
                </div>
              </div>
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {prioritizedWaitlist.map((entry, index) => (
                  <Card key={entry._id} className={`border-l-4 ${
                    entry.guestInfo.tier === 'diamond' ? 'border-l-purple-500' :
                    entry.guestInfo.tier === 'svip' ? 'border-l-yellow-500' :
                    entry.guestInfo.tier === 'vip' ? 'border-l-blue-500' :
                    entry.guestInfo.tier === 'corporate' ? 'border-l-green-500' :
                    'border-l-gray-400'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                            #{index + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-lg">{entry.guestInfo.name}</div>
                            <div className="text-sm text-gray-600 mb-1">
                              {entry.guestInfo.email} • {entry.guestInfo.phone}
                            </div>
                            <div className="text-sm text-gray-500">
                              {entry.partySize} {entry.partySize === 1 ? 'guest' : 'guests'} •
                              {new Date(entry.checkInDate).toLocaleDateString()} - {new Date(entry.checkOutDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <div className="flex gap-2">
                            <Badge className={getTierColor(entry.guestInfo.tier)}>
                              {entry.guestInfo.tier.toUpperCase()}
                            </Badge>
                            <Badge className={getUrgencyColor(entry.urgency)}>
                              {entry.urgency.toUpperCase()}
                            </Badge>
                            <Badge className={getStatusColor(entry.status)}>
                              {getStatusIcon(entry.status)}
                              {entry.status.toUpperCase()}
                            </Badge>
                          </div>
                          {entry.bestMatch?.matchScore && (
                            <Badge className="bg-green-100 text-green-800">
                              {entry.bestMatch.matchScore}% Match
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <div className="text-sm font-medium">Requested Room</div>
                          <div className="text-sm text-gray-600">{entry.requestedRoomType}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Max Budget</div>
                          <div className="text-sm text-gray-600">{formatCurrency(entry.maxPrice)}/night</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">Wait Time</div>
                          <div className="text-sm text-gray-600">
                            {waitlistService.formatWaitingTime(entry.waitingHours)}
                          </div>
                        </div>
                      </div>

                      {entry.preferences.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium mb-1">Preferences</div>
                          <div className="flex flex-wrap gap-2">
                            {entry.preferences.map((pref, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {pref}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {entry.specialRequests.length > 0 && (
                        <div className="mb-3">
                          <div className="text-sm font-medium mb-1">Special Requests</div>
                          <div className="flex flex-wrap gap-2">
                            {entry.specialRequests.map((req, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {req}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {entry.status === 'waiting' && (
                          <Button size="sm" onClick={() => processWaitlist()}>
                            Find Matches
                          </Button>
                        )}
                        {entry.status === 'matched' && (
                          <>
                            <Button size="sm" onClick={() => contactGuest(entry._id)}>
                              Contact Guest
                            </Button>
                            <Button size="sm" variant="outline">
                              View Match Details
                            </Button>
                          </>
                        )}
                        {entry.status === 'contacted' && (
                          <Button size="sm" variant="outline">
                            Follow Up
                          </Button>
                        )}
                        <Button size="sm" variant="ghost">
                          View Full Profile
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {prioritizedWaitlist.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No waitlist entries found matching the current filter.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Smart Match Results</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {matches.map((match) => {
                    const entry = waitlist.find(e => e._id === match.waitlistEntryId);
                    return (
                      <div key={match.waitlistEntryId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-semibold text-lg">{entry?.guestInfo.name}</div>
                            <div className="text-sm text-gray-600">
                              Matched with Room {match.roomNumber} ({match.roomType})
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-800 text-lg px-3 py-1">
                              {match.matchScore}% Match
                            </Badge>
                            <div className="text-sm text-gray-500 mt-1">
                              {match.recommendedAction.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-medium">Room Type</div>
                            <div className={match.typeMatch ? 'text-green-600' : 'text-red-600'}>
                              {match.typeMatch ? '✓ Match' : '✗ No Match'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Dates</div>
                            <div className={match.dateMatch ? 'text-green-600' : 'text-red-600'}>
                              {match.dateMatch ? '✓ Available' : '✗ Conflict'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Price</div>
                            <div className={match.priceMatch ? 'text-green-600' : 'text-red-600'}>
                              {match.priceMatch ? '✓ Within Budget' : '✗ Over Budget'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">Availability</div>
                            <div className={match.availabilityConfirmed ? 'text-green-600' : 'text-yellow-600'}>
                              {match.availabilityConfirmed ? '✓ Confirmed' : '? Pending'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-sm font-medium mb-2">Match Reasons</div>
                          <div className="flex flex-wrap gap-2">
                            {match.matchReasons.map((reason, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {match.recommendedAction === 'auto_confirm' && (
                            <Button
                              size="sm"
                              onClick={() => confirmMatch(match.waitlistEntryId, match._id)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Auto Confirm
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => contactGuest(match.waitlistEntryId)}
                          >
                            Contact Guest
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => declineMatch(match.waitlistEntryId, match._id)}
                          >
                            Decline Match
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedMatch(match)}
                          >
                            View Details
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {matches.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No matches found. Run waitlist processing to find potential matches.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Waitlist Processing Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Auto Processing</div>
                        <div className="text-sm text-gray-600">Automatically process waitlist at intervals</div>
                      </div>
                      <Switch
                        checked={settings.autoProcessing}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, autoProcessing: checked}))}
                      />
                    </div>

                    <div>
                      <div className="font-medium mb-2">Processing Interval (minutes)</div>
                      <Select
                        value={settings.processInterval.toString()}
                        onValueChange={(value) => setSettings(prev => ({...prev, processInterval: parseInt(value)}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="font-medium mb-2">Minimum Match Score</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>50%</span>
                          <span>{settings.minimumMatchScore}%</span>
                          <span>100%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="100"
                          value={settings.minimumMatchScore}
                          onChange={(e) => setSettings(prev => ({...prev, minimumMatchScore: parseInt(e.target.value)}))}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-2">Auto Confirm Threshold</div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>80%</span>
                          <span>{settings.autoConfirmThreshold}%</span>
                          <span>100%</span>
                        </div>
                        <input
                          type="range"
                          min="80"
                          max="100"
                          value={settings.autoConfirmThreshold}
                          onChange={(e) => setSettings(prev => ({...prev, autoConfirmThreshold: parseInt(e.target.value)}))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Prioritize VIP Guests</div>
                        <div className="text-sm text-gray-600">Process VIP guests first</div>
                      </div>
                      <Switch
                        checked={settings.prioritizeVIP}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, prioritizeVIP: checked}))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Consider Alternative Room Types</div>
                        <div className="text-sm text-gray-600">Match with similar room types</div>
                      </div>
                      <Switch
                        checked={settings.considerAlternativeRoomTypes}
                        onCheckedChange={(checked) => setSettings(prev => ({...prev, considerAlternativeRoomTypes: checked}))}
                      />
                    </div>

                    <div>
                      <div className="font-medium mb-2">Max Contact Attempts</div>
                      <Select
                        value={settings.maxContactAttempts.toString()}
                        onValueChange={(value) => setSettings(prev => ({...prev, maxContactAttempts: parseInt(value)}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 attempt</SelectItem>
                          <SelectItem value="2">2 attempts</SelectItem>
                          <SelectItem value="3">3 attempts</SelectItem>
                          <SelectItem value="5">5 attempts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="font-medium mb-2">Contact Delay (hours)</div>
                      <Select
                        value={settings.contactDelayHours.toString()}
                        onValueChange={(value) => setSettings(prev => ({...prev, contactDelayHours: parseInt(value)}))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hour</SelectItem>
                          <SelectItem value="2">2 hours</SelectItem>
                          <SelectItem value="4">4 hours</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(WaitlistProcessor, { level: 'component' });