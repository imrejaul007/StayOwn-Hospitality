import compression from 'compression';

/**
 * Compression Middleware
 *
 * Configures response compression for the API to reduce bandwidth usage
 * and improve response times.
 */

// Configure compression middleware
const compressionMiddleware = compression({
  // Only compress responses larger than 1KB
  threshold: 1024,

  // Compression level (0-9, higher = more compression but slower)
  // Level 6 provides good balance between speed and compression ratio
  level: 6,

  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress responses with 'x-no-compression' header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress if response is already compressed
    const contentEncoding = res.getHeader('Content-Encoding');
    if (contentEncoding) {
      return false;
    }

    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('Content-Type');
    if (contentType) {
      const noCompressTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/x-rar',
        'application/x-7z',
        'application/pdf'
      ];

      if (noCompressTypes.some(type => contentType.includes(type))) {
        return false;
      }
    }

    // Compress everything else
    return compression.filter(req, res);
  }
});

export default compressionMiddleware;
