const SUPPORTED_API_VERSIONS = ['v1', 'v2'];
const ROUTED_COMPATIBILITY_VERSION = 'v1';

const getPathSegments = (urlPath = '/') => urlPath.split('/').filter(Boolean);

export const apiVersioning = (req, res, next) => {
  const segments = getPathSegments(req.url);
  const versionSegment = segments[0];

  if (!versionSegment) {
    req.apiVersion = ROUTED_COMPATIBILITY_VERSION;
    req.requestedApiVersion = ROUTED_COMPATIBILITY_VERSION;
    req.url = `/${ROUTED_COMPATIBILITY_VERSION}${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    return next();
  }

  if (!/^v\d+$/.test(versionSegment)) {
    req.apiVersion = ROUTED_COMPATIBILITY_VERSION;
    req.requestedApiVersion = ROUTED_COMPATIBILITY_VERSION;
    req.url = `/${ROUTED_COMPATIBILITY_VERSION}${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
    return next();
  }

  req.requestedApiVersion = versionSegment;

  if (!SUPPORTED_API_VERSIONS.includes(versionSegment)) {
    return res.status(400).json({
      status: 'error',
      message: `Unsupported API version "${versionSegment}"`,
      supportedVersions: SUPPORTED_API_VERSIONS
    });
  }

  if (versionSegment === 'v2') {
    req.apiVersion = ROUTED_COMPATIBILITY_VERSION;
    req.url = req.url.replace(/^\/v2(\/|$)/, `/${ROUTED_COMPATIBILITY_VERSION}$1`);
    res.setHeader('x-api-version-status', 'compatibility-mode');
    res.setHeader('x-api-version-requested', 'v2');
    res.setHeader('x-api-version-routed-to', ROUTED_COMPATIBILITY_VERSION);
  } else {
    req.apiVersion = versionSegment;
    res.setHeader('x-api-version-status', 'stable');
    res.setHeader('x-api-version-requested', versionSegment);
  }

  if (versionSegment === 'v1') {
    const sunsetDate = process.env.API_V1_SUNSET_DATE || '2027-12-31';
    res.setHeader('x-api-deprecation-notice', 'v1-will-be-deprecated');
    res.setHeader('x-api-sunset-date', sunsetDate);
  }

  return next();
};

export const getApiVersionInfo = () => ({
  supportedVersions: SUPPORTED_API_VERSIONS,
  compatibilityRouteTarget: ROUTED_COMPATIBILITY_VERSION
});
