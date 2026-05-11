import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  MetricCard,
  ChartCard,
  DataTable,
  FilterBar,
  ExportButton,
  BarChart,
  DonutChart,
  LineChart,
  AreaChart,
  ProgressBar,
} from '../../../components/dashboard';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useGuestSatisfaction } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { formatPercentage, formatRelativeTime } from '../../../utils/dashboardUtils';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

function GuestSatisfaction() {
  const { selectedPropertyId, properties } = useProperty();

  const [filters, setFilters] = useState({
    hotelId: '',
    period: 'month',
    rating: '',
    category: '',
  });

  const activeHotelId = filters.hotelId || selectedPropertyId || '';

  const satisfactionQuery = useGuestSatisfaction(
    activeHotelId,
    filters.period,
    filters.rating ? parseInt(filters.rating) : undefined
  );

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const data = satisfactionQuery.data?.data;

  const getSentimentColor = (sentiment: 'positive' | 'neutral' | 'negative') => {
    switch (sentiment) {
      case 'positive': return '#10b981';
      case 'negative': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return '#10b981';
    if (rating >= 4.0) return '#3b82f6';
    if (rating >= 3.5) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Guest Satisfaction</h1>
          <p className="text-gray-600 mt-1">Review analytics and guest feedback insights</p>
        </div>
        <div className="flex items-center space-x-3">
          <ExportButton
            endpoint="guest-satisfaction"
            params={{
              hotelId: activeHotelId,
              period: filters.period,
              rating: filters.rating,
            }}
            filename="guest-satisfaction"
          />
          <Button
            onClick={() => satisfactionQuery.refetch()}
            loading={satisfactionQuery.isLoading}
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={[
          {
            key: 'hotelId',
            label: 'Hotel',
            type: 'select',
            options: [
              { value: '', label: 'All Hotels' },
              ...properties.map((p) => ({ value: p._id, label: p.name })),
            ],
          },
          {
            key: 'period',
            label: 'Period',
            type: 'select',
            options: [
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'quarter', label: 'This Quarter' },
              { value: 'year', label: 'This Year' },
            ],
          },
          {
            key: 'rating',
            label: 'Rating Filter',
            type: 'select',
            options: [
              { value: '', label: 'All Ratings' },
              { value: '5', label: '5 Stars' },
              { value: '4', label: '4 Stars' },
              { value: '3', label: '3 Stars' },
              { value: '2', label: '2 Stars' },
              { value: '1', label: '1 Star' },
            ],
          },
          {
            key: 'category',
            label: 'Category',
            type: 'select',
            options: [
              { value: '', label: 'All Categories' },
              { value: 'cleanliness', label: 'Cleanliness' },
              { value: 'service', label: 'Service' },
              { value: 'location', label: 'Location' },
              { value: 'value', label: 'Value' },
            ],
          },
        ]}
        values={filters}
        onChange={handleFilterChange}
      />

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Average Rating"
          value={data?.overview?.averageRating || 0}
          suffix="/5"
          trend={{
            value: data?.overview?.ratingTrend || 0,
            direction: (data?.overview?.ratingTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs last period'
          }}
          color="yellow"
          loading={satisfactionQuery.isLoading}
        />

        <MetricCard
          title="Total Reviews"
          value={data?.overview?.totalReviews || 0}
          trend={{
            value: data?.overview?.newReviews || 0,
            direction: (data?.overview?.newReviews || 0) > 0 ? 'up' : 'neutral',
            label: 'new reviews'
          }}
          color="blue"
          loading={satisfactionQuery.isLoading}
        />

        <MetricCard
          title="Positive Sentiment"
          value={data?.sentiment?.positive || 0}
          type="percentage"
          trend={{
            value: data?.sentiment?.positiveTrend || 0,
            direction: (data?.sentiment?.positiveTrend || 0) >= 0 ? 'up' : 'down',
            label: 'sentiment score'
          }}
          color="green"
          loading={satisfactionQuery.isLoading}
        />

        <MetricCard
          title="Response Rate"
          value={data?.overview?.responseRate || 0}
          type="percentage"
          trend={{
            value: data?.overview?.responseRateTrend || 0,
            direction: (data?.overview?.responseRateTrend || 0) >= 0 ? 'up' : 'down',
            label: 'guest response'
          }}
          color="purple"
          loading={satisfactionQuery.isLoading}
        />
      </div>

      {/* Rating Distribution and Sentiment Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <ChartCard
          title="Rating Distribution"
          subtitle="Breakdown of guest ratings"
          loading={satisfactionQuery.isLoading}
          height="400px"
        >
          <BarChart
            data={(() => {
              const dist = data?.overview?.ratingDistribution;
              if (!dist) return [];
              // Backend returns { excellent, good, average, poor } object or an array
              if (Array.isArray(dist)) {
                return dist.map((item: { rating: number; count: number; percentage: number }) => ({
                  rating: `${item.rating} Star${item.rating !== 1 ? 's' : ''}`,
                  count: item.count,
                  percentage: item.percentage,
                }));
              }
              // Convert object format { excellent, good, average, poor } to chart array
              const labelMap: Record<string, { label: string; stars: number }> = {
                excellent: { label: '5 Stars', stars: 5 },
                good: { label: '4 Stars', stars: 4 },
                average: { label: '3 Stars', stars: 3 },
                poor: { label: '1-2 Stars', stars: 1 },
              };
              const total = Object.values(dist as Record<string, number>).reduce((s: number, v: unknown) => s + (Number(v) || 0), 0);
              return Object.entries(dist as Record<string, number>)
                .filter(([key]) => labelMap[key])
                .map(([key, count]) => ({
                  rating: labelMap[key].label,
                  count: Number(count) || 0,
                  percentage: total > 0 ? Math.round(((Number(count) || 0) / total) * 100) : 0,
                }))
                .sort((a, b) => {
                  const order = ['5 Stars', '4 Stars', '3 Stars', '1-2 Stars'];
                  return order.indexOf(a.rating) - order.indexOf(b.rating);
                });
            })()}
            xDataKey="rating"
            bars={[
              {
                dataKey: 'count',
                name: 'Reviews',
                color: '#3b82f6',
              }
            ]}
            height={350}
            layout="horizontal"
          />
        </ChartCard>

        {/* Sentiment Analysis */}
        <ChartCard
          title="Sentiment Analysis"
          subtitle="Guest feedback sentiment distribution"
          loading={satisfactionQuery.isLoading}
          height="400px"
        >
          <DonutChart
            data={[
              { name: 'Positive', value: data?.sentiment?.positive || 0, color: '#10b981' },
              { name: 'Neutral', value: data?.sentiment?.neutral || 0, color: '#6b7280' },
              { name: 'Negative', value: data?.sentiment?.negative || 0, color: '#ef4444' },
            ]}
            height={350}
            centerContent={
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {(data?.sentiment?.positive || 0).toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500">Positive</div>
              </div>
            }
          />
        </ChartCard>
      </div>

      {/* Category Ratings */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {satisfactionQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {data?.categories?.map((category) => (
                <div key={category.category}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium text-gray-900 capitalize">
                        {category.category}
                      </span>
                      <Badge variant="secondary">
                        {category.totalReviews} reviews
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold" style={{ color: getRatingColor(category.averageRating ?? 0) }}>
                        {(category.averageRating ?? 0).toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-500">/5</span>
                      <div className={cn(
                        'text-sm font-medium',
                        (category.trend ?? 0) > 0 ? 'text-green-600' : (category.trend ?? 0) < 0 ? 'text-red-600' : 'text-gray-600'
                      )}>
                        {(category.trend ?? 0) > 0 ? '↗' : (category.trend ?? 0) < 0 ? '↘' : '→'} {Math.abs(category.trend ?? 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <ProgressBar
                    value={((category.averageRating ?? 0) / 5) * 100}
                    color={
                      (category.averageRating ?? 0) >= 4.5 ? 'green' :
                      (category.averageRating ?? 0) >= 4.0 ? 'blue' :
                      (category.averageRating ?? 0) >= 3.5 ? 'yellow' :
                      'red'
                    }
                    showPercentage={false}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rating Trends */}
      <ChartCard
        title="Rating Trends Over Time"
        subtitle="Average rating progression"
        loading={satisfactionQuery.isLoading}
        height="400px"
      >
        <LineChart
          data={data?.trends || []}
          xDataKey="date"
          lines={[
            {
              dataKey: 'averageRating',
              name: 'Average Rating',
              color: '#f59e0b',
            },
            {
              dataKey: 'totalReviews',
              name: 'Review Count',
              color: '#3b82f6',
            }
          ]}
          height={350}
        />
      </ChartCard>

      {/* Word Cloud Sentiment */}
      <Card>
        <CardHeader>
          <CardTitle>Common Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {satisfactionQuery.isLoading ? (
            <div className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data?.sentiment?.commonWords?.slice(0, 20).map((word, index) => (
                <span
                  key={`word-${index}`}
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-medium',
                    word.sentiment === 'positive' && 'bg-green-100 text-green-800',
                    word.sentiment === 'negative' && 'bg-red-100 text-red-800',
                    word.sentiment === 'neutral' && 'bg-gray-100 text-gray-800'
                  )}
                  style={{
                    fontSize: `${Math.max(12, Math.min(18, word.count / 2 + 12))}px`
                  }}
                >
                  {word.word} ({word.count})
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reviews */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Recent Reviews</span>
            <Badge variant="secondary">
              {data?.recentReviews?.length || 0} reviews
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {satisfactionQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {data?.recentReviews?.map((review) => (
                <div key={review._id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{review.userId.name}</h4>
                      <p className="text-sm text-gray-600">{review.title}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg
                            key={i}
                            className={cn(
                              'w-4 h-4',
                              i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                            )}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        {formatRelativeTime(review.reviewDate)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 mb-3">{review.content}</p>

                  {/* Category Ratings */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {Object.entries(review.categories).map(([category, rating]) => (
                      <div key={category} className="flex justify-between items-center">
                        <span className="capitalize text-gray-600">{category}:</span>
                        <div className="flex items-center space-x-1">
                          <span className="font-medium">{rating}</span>
                          <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Reviews Table */}
      <DataTable
        title="All Reviews"
        data={data?.recentReviews || []}
        columns={[
          {
            key: 'userId',
            header: 'Guest',
            render: (_, row) => row.userId.name,
            width: '150px',
          },
          {
            key: 'rating',
            header: 'Rating',
            render: (value) => (
              <div className="flex items-center space-x-1">
                <span className="font-medium">{value}</span>
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            ),
            width: '100px',
            align: 'center' as const,
          },
          {
            key: 'title',
            header: 'Title',
            width: '200px',
          },
          {
            key: 'content',
            header: 'Review',
            render: (value) => (
              <span className="line-clamp-2" title={value}>
                {value.length > 100 ? `${value.substring(0, 100)}...` : value}
              </span>
            ),
          },
          {
            key: 'reviewDate',
            header: 'Date',
            render: (value) => formatRelativeTime(value),
            width: '120px',
          },
          {
            key: 'categories',
            header: 'Categories',
            render: (value) => (
              <div className="space-y-1">
                {Object.entries(value).map(([category, rating]) => (
                  <div key={category} className="flex justify-between text-xs">
                    <span className="capitalize">{category}:</span>
                    <span>{rating}/5</span>
                  </div>
                ))}
              </div>
            ),
            width: '150px',
          },
        ]}
        loading={satisfactionQuery.isLoading}
        searchable={true}
        pagination={true}
        pageSize={10}
        actions={
          <ExportButton
            endpoint="guest-satisfaction"
            params={{
              hotelId: activeHotelId,
              period: filters.period,
              detailed: 'true',
            }}
            formats={['csv', 'excel']}
            size="sm"
          />
        }
      />
    </div>
  );
}

export default withErrorBoundary(GuestSatisfaction);
