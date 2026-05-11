import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { ArrowUpIcon, StarIcon, CreditCardIcon, TrendingUpIcon, CheckIcon, XIcon, RefreshCwIcon, Home, DollarSignIcon, TrophyIcon, SettingsIcon } from 'lucide-react';
import { ReservationWorkflowEngine } from '@/utils/ReservationWorkflowEngine';
import upgradeService, { UpgradeSuggestion, UpgradeAnalytics } from '@/services/upgradeService';
import { toast } from '@/utils/toast';
import { formatCurrency } from '@/utils/currencyUtils';

// Use the UpgradeSuggestion interface from the service
type RoomUpgrade = UpgradeSuggestion;

interface UpgradeRule {
  id: string;
  name: string;
  priority: number;
  conditions: {
    guestTier?: string[];
    roomOccupancy?: number;
    daysUntilCheckIn?: number;
    priceThreshold?: number;
  };
  action: {
    type: 'auto_upgrade' | 'suggest_upgrade' | 'offer_upgrade';
    targetRoomTypes: string[];
    maxPriceIncrease: number;
  };
}

// Use the UpgradeAnalytics interface from the service
type UpgradeStats = UpgradeAnalytics;

export const UpgradeProcessor: React.FC = () => {
  const [upgrades, setUpgrades] = useState<RoomUpgrade[]>([]);
  const [rules, setRules] = useState<UpgradeRule[]>([]);
  const [stats, setStats] = useState<UpgradeStats>({
    totalSuggestions: 0,
    acceptedUpgrades: 0,
    rejectedUpgrades: 0,
    totalRevenue: 0,
    averageIncrease: 0,
    conversionRate: 0,
    byTier: {
      vip: { acceptance: 0, count: 0 },
      corporate: { acceptance: 0, count: 0 },
      regular: { acceptance: 0, count: 0 }
    }
  });
  const [selectedUpgrade, setSelectedUpgrade] = useState<RoomUpgrade | null>(null);
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    initializeUpgradeEngine();
    loadUpgradeRules();
    generateUpgradeSuggestions();
  }, []);

  const initializeUpgradeEngine = () => {
    // Initialize default upgrade rules
    const defaultRules: UpgradeRule[] = [
      {
        id: 'vip-auto-upgrade',
        name: 'VIP Auto Upgrade',
        priority: 1,
        conditions: {
          guestTier: ['diamond', 'svip'],
          roomOccupancy: 70
        },
        action: {
          type: 'auto_upgrade',
          targetRoomTypes: ['suite', 'presidential'],
          maxPriceIncrease: 500
        }
      },
      {
        id: 'early-booking-upgrade',
        name: 'Early Booking Reward',
        priority: 2,
        conditions: {
          daysUntilCheckIn: 14,
          roomOccupancy: 60
        },
        action: {
          type: 'offer_upgrade',
          targetRoomTypes: ['deluxe', 'premium'],
          maxPriceIncrease: 200
        }
      },
      {
        id: 'corporate-upgrade',
        name: 'Corporate Account Upgrade',
        priority: 3,
        conditions: {
          guestTier: ['corporate'],
          priceThreshold: 300
        },
        action: {
          type: 'suggest_upgrade',
          targetRoomTypes: ['business', 'executive'],
          maxPriceIncrease: 150
        }
      }
    ];

    setRules(defaultRules);
  };

  const loadUpgradeRules = async () => {
    try {
      const analytics = await upgradeService.getUpgradeAnalytics();
      setStats(analytics);
    } catch (error) {
      toast.error('Failed to load upgrade statistics');
    }
  };

  const generateUpgradeSuggestions = async () => {
    setProcessing(true);
    try {
      const result = await upgradeService.refreshSuggestions();
      setUpgrades(result.suggestions);
      toast.success(`Found ${result.total} upgrade opportunities`);
    } catch (error) {
      toast.error('Failed to load upgrade suggestions');
      setUpgrades([]);
    } finally {
      setProcessing(false);
    }
  };

  const processUpgrade = async (upgradeId: string, action: 'approve' | 'reject') => {
    const upgrade = upgrades.find(u => u.id === upgradeId);
    if (!upgrade) return;

    try {
      await upgradeService.processUpgrade(upgradeId, action, {
        reason: action === 'approve' ? 'Upgrade approved by staff' : 'Not suitable for upgrade'
      });

      // Create workflow for approved upgrades
      if (action === 'approve') {
        const workflowEngine = ReservationWorkflowEngine.getInstance();
        await workflowEngine.createWorkflow({
          type: 'room_upgrade',
          guestId: upgrade.reservationId,
          upgradeDetails: upgrade,
          priority: 'high'
        });

        // Update local stats
        setStats(prev => ({
          ...prev,
          acceptedUpgrades: prev.acceptedUpgrades + 1,
          totalRevenue: prev.totalRevenue + upgrade.priceIncrease,
          conversionRate: Math.round(((prev.acceptedUpgrades + 1) / prev.totalSuggestions) * 100)
        }));

        toast.success(`Upgrade approved for ${upgrade.guestName || 'guest'}`);
      } else {
        toast.info(`Upgrade rejected for ${upgrade.guestName || 'guest'}`);
      }

      // Remove processed upgrade from list
      setUpgrades(prev => prev.filter(u => u.id !== upgradeId));

    } catch (error) {
      toast.error('Failed to process upgrade');
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 90) return 'text-green-600 bg-green-100';
    if (confidence >= 75) return 'text-blue-600 bg-blue-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getRoomTypeIcon = (roomType: string) => {
    switch (roomType.toLowerCase()) {
      case 'suite':
      case 'presidential':
        return <StarIcon className="h-4 w-4" />;
      case 'premium':
      case 'deluxe':
        return <TrendingUpIcon className="h-4 w-4" />;
      default:
        return <ArrowUpIcon className="h-4 w-4" />;
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 text-blue-700 hover:text-blue-800 transition-all duration-200 shadow-sm hover:shadow-md rounded-lg"
        >
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-blue-600" />
            <span className="font-medium">Upgrade Processor</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-white rounded-xl shadow-2xl border-0 p-0 overflow-hidden flex flex-col">
        <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Home className="h-8 w-8 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white mb-1">
                  Automated Upgrade Processor
                </DialogTitle>
                <p className="text-blue-100 text-sm">Intelligently process room upgrades and maximize revenue opportunities</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium">
                ACTIVE
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <Tabs defaultValue="suggestions" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-gray-50 border border-gray-200 rounded-lg p-1 mb-6">
              <TabsTrigger
                value="suggestions"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                <Home className="h-4 w-4 mr-2" />
                Upgrade Suggestions
              </TabsTrigger>
              <TabsTrigger
                value="rules"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                <SettingsIcon className="h-4 w-4 mr-2" />
                Upgrade Rules
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all duration-200 rounded-md"
              >
                <TrophyIcon className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
            </TabsList>

          <TabsContent value="suggestions" className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-3">
                <Button
                  onClick={generateUpgradeSuggestions}
                  disabled={processing}
                  size="sm"
                  className="gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <RefreshCwIcon className={`h-4 w-4 ${processing ? 'animate-spin' : ''}`} />
                  {processing ? 'Analyzing...' : 'Refresh Suggestions'}
                </Button>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as unknown)}
                  className="px-4 py-2 border border-blue-200 rounded-lg bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Suggestions</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-white/60 backdrop-blur-sm px-4 py-2 rounded-lg shadow-sm">
                <Home className="h-4 w-4 text-blue-500" />
                {upgrades.length} suggestions found
              </div>
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {upgrades.map((upgrade) => (
                  <Card key={upgrade.id} className="border-l-4 border-l-blue-500 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {getRoomTypeIcon(upgrade.toRoomType)}
                          <div>
                            <div className="font-semibold">
                              {upgrade.fromRoomType} → {upgrade.toRoomType}
                            </div>
                            <div className="text-sm text-gray-600">
                              Room {upgrade.fromRoomNumber} → {upgrade.toRoomNumber}
                            </div>
                          </div>
                        </div>
                        <Badge className={`${getConfidenceColor(upgrade.confidence)} shadow-sm px-3 py-1 font-semibold`}>
                          <TrophyIcon className="h-3 w-3 mr-1" />
                          {Math.round(upgrade.confidence)}% confidence
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium mb-1">Reason</div>
                          <div className="text-sm text-gray-600">{upgrade.reason}</div>
                        </div>
                        <div>
                          <div className="text-sm font-medium mb-1">Price Increase</div>
                          <div className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent flex items-center gap-1">
                            <DollarSignIcon className="h-5 w-5 text-green-600" />
                            +{formatCurrency(upgrade.priceIncrease)}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="text-sm font-medium mb-2">Benefits</div>
                        <div className="flex flex-wrap gap-2">
                          {upgrade.benefits.map((benefit, index) => (
                            <Badge key={`upgrade-benefits-${index}-${benefit}`} variant="secondary">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {upgrade.guestProfile && (
                        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                          <div className="text-sm font-semibold mb-2 text-blue-700">Guest Profile</div>
                          <div className="text-xs space-y-1">
                            <div><strong>Tier:</strong> {upgrade.guestProfile.tier.toUpperCase()}</div>
                            <div><strong>Preferences:</strong> {upgrade.guestProfile.preferences.join(', ')}</div>
                            <div><strong>History:</strong> {upgrade.guestProfile.history.join(', ')}</div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button
                          size="sm"
                          onClick={() => processUpgrade(upgrade.id, 'approve')}
                          className="gap-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md hover:shadow-lg transition-all duration-300"
                        >
                          <CheckIcon className="h-4 w-4" />
                          Approve Upgrade
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processUpgrade(upgrade.id, 'reject')}
                          className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-300"
                        >
                          <XIcon className="h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedUpgrade(upgrade)}
                          className="text-blue-600 hover:bg-blue-50 transition-all duration-300"
                        >
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {upgrades.length === 0 && !processing && (
                  <div className="text-center py-8 text-gray-500">
                    No upgrade suggestions available. Click refresh to analyze current reservations.
                  </div>
                )}

                {processing && (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <div className="mt-2 text-gray-600">Analyzing reservations for upgrade opportunities...</div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      {rule.name}
                      <Badge variant="outline">Priority {rule.priority}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium mb-2">Conditions</div>
                        <div className="space-y-1 text-sm">
                          {rule.conditions.guestTier && (
                            <div>Guest Tier: {rule.conditions.guestTier.join(', ')}</div>
                          )}
                          {rule.conditions.roomOccupancy && (
                            <div>Occupancy: ≤{rule.conditions.roomOccupancy}%</div>
                          )}
                          {rule.conditions.daysUntilCheckIn && (
                            <div>Advance Booking: ≥{rule.conditions.daysUntilCheckIn} days</div>
                          )}
                          {rule.conditions.priceThreshold && (
                            <div>Min Rate: {formatCurrency(rule.conditions.priceThreshold)}</div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium mb-2">Action</div>
                        <div className="space-y-1 text-sm">
                          <div>Type: {rule.action.type.replace('_', ' ').toUpperCase()}</div>
                          <div>Target Rooms: {rule.action.targetRoomTypes.join(', ')}</div>
                          <div>Max Increase: {formatCurrency(rule.action.maxPriceIncrease)}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Total Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{stats.totalSuggestions}</div>
                  <div className="text-xs text-blue-500 mt-1">Active opportunities</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                    <CheckIcon className="h-4 w-4" />
                    Accepted Upgrades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{stats.acceptedUpgrades}</div>
                  <div className="text-xs text-green-500 mt-1">Confirmed bookings</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                    <DollarSignIcon className="h-4 w-4" />
                    Revenue Generated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">{formatCurrency(stats?.totalRevenue || 0)}</div>
                  <div className="text-xs text-purple-500 mt-1">Additional income</div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                    <TrophyIcon className="h-4 w-4" />
                    Conversion Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-orange-600">{stats.conversionRate}%</div>
                  <Progress value={stats.conversionRate} className="mt-3 h-2" />
                  <div className="text-xs text-orange-500 mt-1">Success rate</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Upgrade Performance Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">VIP Guests</span>
                      <span className="text-sm">85% acceptance</span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Corporate Accounts</span>
                      <span className="text-sm">72% acceptance</span>
                    </div>
                    <Progress value={72} className="h-2" />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Regular Guests</span>
                      <span className="text-sm">45% acceptance</span>
                    </div>
                    <Progress value={45} className="h-2" />
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