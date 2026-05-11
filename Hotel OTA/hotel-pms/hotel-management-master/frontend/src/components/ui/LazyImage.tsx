import React, { useState } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export default function LazyImage({ src, alt, fallback, className, ...props }: LazyImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`relative ${!loaded ? 'bg-gray-200 animate-pulse' : ''}`}>
      <img
        src={error && fallback ? fallback : src}
        alt={alt || ''}
        loading="lazy"
        decoding="async"
        className={`${className || ''} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        {...props}
      />
    </div>
  );
}
