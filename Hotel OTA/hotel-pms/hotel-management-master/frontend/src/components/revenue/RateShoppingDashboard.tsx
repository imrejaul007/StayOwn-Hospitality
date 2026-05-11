import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  RefreshCw,
  Building,
  Target,
  Activity,
  Download,
} from 'lucide-react';
import { formatCurrency } from '@/utils/currencyUtils';
import { api } from '@/services/api';
import revenueManagementService from '@/services/revenueManagementService';
import { toast } from 'react-hot-toast';

interface Competitor {
  id: string;
  name: string;
  location: string;
  starRating: number;
  marketSegment: string;
  lastUpdated: Date;
}

interface RateComparison {
  roomType: string;
  ourRate: number;
  competitorRates: { name: string; rate: number; availability: number }[];
  marketAverage: number;
  position: 'leader' | 'competitive' | 'follower';
  recommendation: string;
}

const RateShoppingDashboard: React.FC = () => {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [rateComparisons, setRateComparisons] = useState<RateComparison[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [marketPosition, setMarketPosition] = useState<'leader' | 'competitive' | 'follower'>('competitive');
  const [priceGap, setPriceGap] = useState(0);

  const [newCompetitor, setNewCompetitor] = useState({
    name: '',
    location: '',
    starRating: 3,
    marketSegment: 'midscale',
    url: ''
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    fetchCompetitorRates();
  }, [selectedDate, selectedRoomType]);

  const fetchCompetitorRates = async () => {
    setIsLoading(true);
    try {
      // Fetch our hotel's current rates in parallel with competitor rates
      const [rates, roomTypesRes] = await Promise.all([
        revenueManagementService.getCompetitorRates({ date: selectedDate }),
        api.get('/revenue-management/room-types').catch(() => ({ data: { data: [] } }))
      ]);

      // Build a map of our room type rates from real data
      const ourRoomTypeRates: Record<string, number> = {};
      let avgOurRate = 0;
      if (roomTypesRes.data?.data?.length > 0) {
        const roomTypes = roomTypesRes.data.data;
        roomTypes.forEach((rt: { roomType: string; currentRate: number }) => {
          ourRoomTypeRates[rt.roomType?.toLowerCase()] = rt.currentRate;
        });
        avgOurRate = roomTypes.reduce((sum: number, rt: { currentRate: number }) => sum + rt.currentRate, 0) / roomTypes.length;
      }
      if (rates && rates.length > 0) {
        // Use real competitor data from database
        const realCompetitors = rates.map((rate: Record<string, unknown>, index: number) => ({
          id: rate._id || `comp-${index}`,
          name: rate.competitorName,
          location: rate.location || 'Unknown location',
          starRating: rate.starRating || 3,
          marketSegment: rate.marketSegment || 'midscale',
          lastUpdated: new Date(rate.lastUpdated || Date.now())
        }));
        setCompetitors(realCompetitors);

        // Set real rate comparison data using actual hotel rates
        const realRateComparisons = rates.map((rate: Record<string, unknown>) => {
          const roomTypeName = (rate.roomType as string) || 'Standard Room';
          const matchedOurRate = ourRoomTypeRates[roomTypeName.toLowerCase()] || avgOurRate || 0;

          return {
            roomType: roomTypeName,
            ourRate: matchedOurRate,
            competitorRates: rate.rates?.map((r: { rate: number; availability?: number; competitorName?: string }) => ({
              name: r.competitorName || rate.competitorName,
              rate: r.rate,
              availability: r.availability ?? 0
            })) || [],
            marketAverage: rate.rates?.length > 0
              ? rate.rates.reduce((sum: number, r: { rate: number }) => sum + r.rate, 0) / rate.rates.length
              : 0,
            position: 'competitive' as const,
            recommendation: 'Monitor rates based on current market data'
          };
        });
        setRateComparisons(realRateComparisons);

        // Calculate market statistics from real data
        if (realRateComparisons.length > 0) {
          // Collect all competitor rates from all competitors
          const allCompetitorRates = [];
          realRateComparisons.forEach(comp => {
            comp.competitorRates.forEach(cr => {
              allCompetitorRates.push(cr.rate);
            });
          });

          if (allCompetitorRates.length > 0) {
            // Calculate market average from competitor rates
            const marketAvg = allCompetitorRates.reduce((sum, rate) => sum + rate, 0) / allCompetitorRates.length;

            // Our average rate (should be consistent, but taking first one)
            const ourRate = realRateComparisons[0].ourRate;

            // Calculate price gap (positive means we're more expensive, negative means cheaper)
            const gap = ourRate - marketAvg;


            setPriceGap(gap);

            // Determine market position from the computed gap
            if (gap > 500) {
              setMarketPosition('leader');
            } else if (gap < -500) {
              setMarketPosition('follower');
            } else {
              setMarketPosition('competitive');
            }
          }
        }
      } else {
        // If no data found, show message but don't clear the state immediately
        toast('No competitor data available for selected date');
        setMarketPosition('competitive');
        setPriceGap(0);
      }

    } catch (error) {
      toast.error('Failed to fetch competitor rates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCompetitor = async () => {
    try {
      await revenueManagementService.addCompetitorRate({
        competitorName: newCompetitor.name,
        url: newCompetitor.url,
        roomType: 'Standard',
        checkInDate: new Date(),
        checkOutDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        rates: []
      });

      toast.success('Competitor added successfully');
      setShowAddDialog(false);
      setNewCompetitor({
        name: '',
        location: '',
        starRating: 3,
        marketSegment: 'midscale',
        url: ''
      });
      fetchCompetitorRates();
    } catch (error) {
      toast.error('Failed to add competitor');
    }
  };

  const refreshRates = async () => {
    try {
      await fetchCompetitorRates();
      if (!isMountedRef.current) return;
      toast.success('Rates refreshed successfully');
    } catch (error) {
      toast.error('Failed to refresh rates');
    }
  };

  const getRateChangeIcon = (ourRate: number, marketAverage: number) => {
    const diff = ourRate - marketAverage;
    if (diff > 100) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (diff < -100) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-600" />;
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'leader': return 'bg-green-100 text-green-800';
      case 'competitive': return 'bg-blue-100 text-blue-800';
      case 'follower': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportData = () => {
    if (rateComparisons.length === 0) {
      toast.error('No data to export');
      return;
    }
    const data = rateComparisons.map(comp => ({
      'Room Type': comp.roomType,
      'Our Rate': comp.ourRate,
      'Market Average': comp.marketAverage,
      'Position': comp.position,
      ...comp.competitorRates.reduce((acc, rate) => ({
        ...acc,
        [rate.name]: rate.rate
      }), {})
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-shopping-${selectedDate}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Rate Shopping & Competitor Analysis</h2>
          <p className="text-gray-600">Monitor competitor rates and optimize pricing strategy</p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>

          <Button variant="outline" onClick={refreshRates} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Competitor
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Competitor</DialogTitle>
                <DialogDescription>
                  Add a new competitor hotel to monitor their rates
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Hotel Name</Label>
                  <Input
                    id="name"
                    value={newCompetitor.name}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, name: e.target.value })}
                    placeholder="e.g., Grand Plaza Hotel"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newCompetitor.location}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, location: e.target.value })}
                    placeholder="e.g., 2.5 km away"
                  />
                </div>

                <div>
                  <Label htmlFor="starRating">Star Rating</Label>
                  <Select
                    value={newCompetitor.starRating.toString()}
                    onValueChange={(value) => setNewCompetitor({ ...newCompetitor, starRating: parseInt(value) })}
                  >
                    <SelectTrigger id="starRating">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Stars</SelectItem>
                      <SelectItem value="3">3 Stars</SelectItem>
                      <SelectItem value="4">4 Stars</SelectItem>
                      <SelectItem value="5">5 Stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="url">Website URL (optional)</Label>
                  <Input
                    id="url"
                    value={newCompetitor.url}
                    onChange={(e) => setNewCompetitor({ ...newCompetitor, url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCompetitor}>
                    Add Competitor
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="flex-1">
              <Label htmlFor="roomType">Room Type</Label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger id="roomType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Room Types</SelectItem>
                  <SelectItem value="standard">Standard Room</SelectItem>
                  <SelectItem value="deluxe">Deluxe Suite</SelectItem>
                  <SelectItem value="executive">Executive Room</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Position Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Market Position</p>
                <Badge className={`mt-1 ${getPositionColor(marketPosition)}`}>
                  {marketPosition.toUpperCase()}
                </Badge>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Price Gap</p>
                <p className="text-2xl font-bold">{formatCurrency(priceGap)}</p>
              </div>
              <Activity className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Competitors Tracked</p>
                <p className="text-2xl font-bold">{competitors.length}</p>
              </div>
              <Building className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Comparison by Room Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Our Rate</TableHead>
                  <TableHead>Market Avg</TableHead>
                  {competitors.map(comp => (
                    <TableHead key={comp.id}>{comp.name}</TableHead>
                  ))}
                  <TableHead>Position</TableHead>
                  <TableHead>Recommendation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rateComparisons
                  .filter(comp => selectedRoomType === 'all' || comp.roomType.toLowerCase().includes(selectedRoomType))
                  .map((comparison, index) => (
                    <TableRow key={`comparison-${index}`}>
                      <TableCell className="font-medium">{comparison.roomType}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {formatCurrency(comparison.ourRate)}
                          {getRateChangeIcon(comparison.ourRate, comparison.marketAverage)}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(comparison.marketAverage)}</TableCell>
                      {comparison.competitorRates.map((rate, idx) => (
                        <TableCell key={idx}>
                          <div>
                            <p>{formatCurrency(rate.rate)}</p>
                            <p className="text-xs text-gray-500">{rate.availability} avail</p>
                          </div>
                        </TableCell>
                      ))}
                      <TableCell>
                        <Badge className={getPositionColor(comparison.position)}>
                          {comparison.position}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{comparison.recommendation}</p>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Competitor Details */}
      <Card>
        <CardHeader>
          <CardTitle>Competitor Hotels</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map(competitor => (
              <div key={competitor.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-medium">{competitor.name}</h4>
                    <p className="text-sm text-gray-500">{competitor.location}</p>
                  </div>
                  <Badge variant="outline">
                    {'★'.repeat(competitor.starRating)}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <p>Segment: {competitor.marketSegment}</p>
                  <p className="text-gray-500">
                    Last updated: {new Date(competitor.lastUpdated).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RateShoppingDashboard;