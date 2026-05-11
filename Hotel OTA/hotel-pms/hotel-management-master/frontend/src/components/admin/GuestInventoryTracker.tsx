import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Search, Star, Crown, IndianRupee, Gift, TrendingUp, Users, Package } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface GuestAnalytics {
  guestId: string;
  guestName: string;
  guestEmail: string;
  isVIP: boolean;
  totalConsumptions: number;
  totalCost: number;
  totalRevenue: number;
  profitMargin: number;
  complimentaryValue: number;
  uniqueItemCount: number;
  avgConsumptionValue: number;
}

interface GuestRecommendation {
  item: {
    _id: string;
    name: string;
    category: string;
    description: string;
    imageUrl?: string;
  };
  score: number;
  pricing: {
    basePrice: number;
    finalPrice: number;
    vipDiscount: number;
    isComplimentary: boolean;
    savings: number;
  };
  preference?: {
    usageCount: number;
    averageRating: number;
    lastUsed: string;
    notes?: string;
  };
  availability: {
    currentStock: number;
    available: boolean;
  };
  vipBenefits?: {
    discountApplied: boolean;
    complimentaryUpgrade: boolean;
  };
}

interface DashboardData {
  guestAnalytics: GuestAnalytics[];
  summary: {
    totalGuests: number;
    totalRevenue: number;
    totalCost: number;
    totalComplimentaryValue: number;
    avgRevenuePerGuest: number;
    vipPercentage: number;
    vipGuests: number;
  };
}

interface GuestInventoryTrackerProps {
  hotelId?: string;
}

const GuestInventoryTracker: React.FC<GuestInventoryTrackerProps> = ({ hotelId: propHotelId }) => {
  const { user } = useAuth();
  // Use prop hotelId (from property context) or fall back to user's hotelId
  const resolvedHotelId = (() => {
    if (propHotelId) return propHotelId;
    const raw = user?.hotelId;
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) return String((raw as { _id: string })._id);
    return String(raw);
  })();

  const [data, setData] = useState<DashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<GuestRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [vipOnly, setVipOnly] = useState(false);

  useEffect(() => {
    fetchGuestAnalytics();
  }, [dateRange, vipOnly]);

  useEffect(() => {
    if (selectedGuest) {
      fetchGuestRecommendations();
    }
  }, [selectedGuest]);

  const fetchGuestAnalytics = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        vipOnly: vipOnly.toString()
      });
      if (resolvedHotelId) params.append('hotelId', resolvedHotelId);

      const { data: result } = await api.get(`/inventory/consumption/guest/analytics?${params}`);

      if (result.success) {
        setData(result.data);
      }
    } catch {
      toast.error('Failed to load guest inventory data');
    } finally {
      setLoading(false);
    }
  };

  const fetchGuestRecommendations = async () => {
    if (!selectedGuest) return;

    try {
      // Fetch recommendations based on guest's current booking context
      const params = new URLSearchParams({ guestId: selectedGuest, serviceType: 'room_service' });
      if (resolvedHotelId) params.append('hotelId', resolvedHotelId);

      const { data: result } = await api.get(`/inventory/consumption/guest/recommendations?${params}`);

      if (result.success) {
        setRecommendations(result.data.recommendations || []);
      }
    } catch {
      toast.error('Failed to load guest recommendations');
    }
  };

  const filteredGuests = data?.guestAnalytics.filter(guest =>
    guest.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guest.guestEmail.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getVIPBadge = (isVIP: boolean) => {
    if (isVIP) {
      return (
        <Badge className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white">
          <Crown className="h-3 w-3 mr-1" />
          VIP
        </Badge>
      );
    }
    return null;
  };

  const getProfitColor = (margin: number) => {
    if (margin > 100) return 'text-green-600';
    if (margin > 50) return 'text-green-500';
    if (margin > 0) return 'text-blue-500';
    return 'text-red-500';
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No data available</p>
        <Button onClick={fetchGuestAnalytics} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Guest Inventory Tracker</h1>
        <div className="flex gap-4">
          <Input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="w-40"
          />
          <Input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="w-40"
          />
          <Button
            variant={vipOnly ? 'default' : 'outline'}
            onClick={() => setVipOnly(!vipOnly)}
          >
            <Crown className="h-4 w-4 mr-2" />
            VIP Only
          </Button>
          <Button onClick={fetchGuestAnalytics}>
            Update
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Guests</p>
                <p className="text-2xl font-bold">{data.summary.totalGuests}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.totalRevenue)}</p>
              </div>
              <IndianRupee className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">VIP Guests</p>
                <p className="text-2xl font-bold">
                  {data.summary.vipGuests} ({data.summary.vipPercentage}%)
                </p>
              </div>
              <Crown className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Revenue/Guest</p>
                <p className="text-2xl font-bold">{formatCurrency(data.summary.avgRevenuePerGuest)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics">Guest Analytics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="charts">Revenue Charts</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Guest Consumption Analytics</span>
                <div className="flex items-center space-x-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search guests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredGuests.map((guest) => (
                  <div key={guest.guestId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{guest.guestName}</h3>
                          {getVIPBadge(guest.isVIP)}
                        </div>
                        <p className="text-sm text-gray-600">{guest.guestEmail}</p>
                        <p className="text-xs text-gray-500">
                          {guest.totalConsumptions} items • {guest.uniqueItemCount} unique items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-sm font-medium">Revenue: {formatCurrency(guest.totalRevenue)}</p>
                        <p className="text-sm text-gray-600">Cost: {formatCurrency(guest.totalCost)}</p>
                        <p className={`text-sm font-medium ${getProfitColor(guest.profitMargin)}`}>
                          Profit: {guest.profitMargin.toFixed(1)}%
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">Complimentary</p>
                        <p className="text-sm font-medium text-green-600">
                          {formatCurrency(guest.complimentaryValue)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedGuest(guest.guestId)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          {selectedGuest ? (
            <Card>
              <CardHeader>
                <CardTitle>Personalized Recommendations</CardTitle>
                <p className="text-gray-600">
                  AI-powered recommendations based on guest preferences and history
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.map((rec, index) => (
                    <Card key={`recommendations-${index}`} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <h3 className="font-medium">{rec.item.name}</h3>
                            <Badge variant="outline">
                              Score: {rec.score.toFixed(1)}
                            </Badge>
                          </div>

                          <p className="text-sm text-gray-600">{rec.item.description}</p>

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Base Price:</span>
                              <span className={rec.pricing.vipDiscount > 0 ? 'line-through text-gray-400' : ''}>
                                {formatCurrency(rec.pricing.basePrice)}
                              </span>
                            </div>

                            {rec.pricing.vipDiscount > 0 && (
                              <div className="flex justify-between text-sm text-green-600">
                                <span>VIP Price:</span>
                                <span>{formatCurrency(rec.pricing.finalPrice)}</span>
                              </div>
                            )}

                            {rec.pricing.isComplimentary && (
                              <div className="flex items-center text-sm text-green-600">
                                <Gift className="h-4 w-4 mr-1" />
                                <span>Complimentary</span>
                              </div>
                            )}
                          </div>

                          {rec.preference && (
                            <div className="border-t pt-2 mt-2">
                              <p className="text-xs text-gray-500">Previous Experience:</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-3 w-3 ${
                                        i < rec.preference!.averageRating
                                          ? 'text-yellow-400 fill-current'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-600">
                                  Used {rec.preference.usageCount} times
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-sm text-gray-600">
                              Stock: {rec.availability.currentStock}
                            </span>
                            <Button
                              size="sm"
                              disabled={!rec.availability.available}
                              className="text-xs"
                            >
                              Recommend
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Guest</h3>
                <p className="text-gray-500">Choose a guest from the analytics tab to view personalized recommendations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="charts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'VIP Guests', value: data.summary.vipGuests },
                        { name: 'Regular Guests', value: data.summary.totalGuests - data.summary.vipGuests }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Guests by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={filteredGuests.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="guestName"
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="totalRevenue" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Guest Profitability Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredGuests.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="guestName"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="totalRevenue" fill="#8884d8" name="Revenue" />
                  <Bar dataKey="totalCost" fill="#82ca9d" name="Cost" />
                  <Bar dataKey="profitMargin" fill="#ffc658" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GuestInventoryTracker;