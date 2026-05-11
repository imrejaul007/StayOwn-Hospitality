import React, { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { LoadingSpinner } from './LoadingSpinner';

interface PageWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ children, fallback }) => {
  return (
    <ErrorBoundary
      level="page"
      fallback={
        fallback || (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-red-600 mb-2">
                Something went wrong
              </h2>
              <p className="text-gray-600">
                Please refresh the page or contact support.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      }
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};

export default PageWrapper;
