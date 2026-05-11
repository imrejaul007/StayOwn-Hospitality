export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-4 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
      <div className="h-3 bg-gray-200 rounded w-1/4 mb-4" />
      <div className="flex gap-2">
        <div className="h-8 bg-gray-200 rounded-xl flex-1" />
        <div className="h-8 bg-gray-200 rounded-xl flex-1" />
      </div>
    </div>
  );
}
