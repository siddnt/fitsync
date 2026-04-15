import crypto from 'node:crypto';
import { recordHttpCacheEvent } from '../services/observability.service.js';

const toUtcString = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toUTCString();
};

export const buildWeakEtag = (scope, version) =>
  `W/"${crypto.createHash('sha1').update(`${scope}:${version}`).digest('hex')}"`;

export const applyPublicCacheHeaders = (
  req,
  res,
  {
    scope,
    version,
    lastModified,
    maxAgeSeconds = 60,
    staleWhileRevalidateSeconds = 120,
  },
) => {
  res.set(
    'Cache-Control',
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`,
  );
  res.vary('Accept-Encoding');

  if (scope && version) {
    res.set('ETag', buildWeakEtag(scope, version));
  }

  const lastModifiedHeader = toUtcString(lastModified);
  if (lastModifiedHeader) {
    res.set('Last-Modified', lastModifiedHeader);
  }

  recordHttpCacheEvent({ fresh: true });

  if (req.fresh) {
    recordHttpCacheEvent({ notModified: true });
    res.status(304).end();
    return true;
  }

  return false;
};
