import { memo, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { formatNumber } from '../../../utils/format.js';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const GeoDensityMap = ({ points, totals, topLocations }) => {
  const markers = useMemo(() => {
    if (!Array.isArray(points)) {
      return [];
    }
    return points
      .filter((point) => typeof point.longitude === 'number' && typeof point.latitude === 'number')
      .slice(0, 30);
  }, [points]);

  const maxGyms = useMemo(() => {
    if (!markers.length) {
      return 1;
    }
    return markers.reduce((max, point) => Math.max(max, Number(point.gyms) || 0), 1);
  }, [markers]);

  return (
    <div className="geo-map">
      <div className="geo-map__meta">
        <div>
          <p className="geo-map__label">Live gyms in India</p>
          <p className="geo-map__value">{formatNumber(totals.totalGyms ?? 0)}</p>
        </div>
        <div>
          <p className="geo-map__label">Monthly impressions</p>
          <p className="geo-map__value">{formatNumber(totals.totalImpressions ?? 0)}</p>
        </div>
      </div>

      <div className="geo-map__visual">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [78.9629, 22.5937], scale: 1200 }}
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies
                .filter((geo) => geo.properties.NAME === 'India')
                .map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill="rgba(80, 199, 236, 0.12)"
                    stroke="rgba(80, 199, 236, 0.45)"
                    strokeWidth={0.5}
                  />
                ))
            }
          </Geographies>
          {markers.map((point) => {
            const size = 6 + ((Number(point.gyms) || 0) / maxGyms) * 12;
            return (
              <Marker key={`${point.city}-${point.latitude}-${point.longitude}`} coordinates={[point.longitude, point.latitude]}>
                <circle
                  r={size / 2}
                  fill="rgba(20, 158, 132, 0.85)"
                  stroke="rgba(12, 108, 96, 0.9)"
                  strokeWidth={0.6}
                />
                <text
                  textAnchor="middle"
                  y={size + 10}
                  style={{ fill: '#e9ecef', fontSize: '0.62rem', pointerEvents: 'none' }}
                >
                  {point.city}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>
      </div>

      <div className="geo-map__legend">
        <p className="geo-map__legend-title">Gym density</p>
        <div className="geo-map__legend-scale">
          <div className="geo-map__legend-item">
            <div className="geo-map__legend-dot geo-map__legend-dot--small" />
            <span>Few gyms</span>
          </div>
          <div className="geo-map__legend-item">
            <div className="geo-map__legend-dot geo-map__legend-dot--medium" />
            <span>Moderate</span>
          </div>
          <div className="geo-map__legend-item">
            <div className="geo-map__legend-dot geo-map__legend-dot--large" />
            <span>High density</span>
          </div>
        </div>
      </div>

      {Array.isArray(topLocations) && topLocations.length ? (
        <div className="geo-map__list">
          {topLocations.slice(0, 6).map((location) => (
            <div key={`${location.city}-${location.state}`} className="geo-map__list-item">
              <div>
                <strong>{location.city}</strong>
                <p>{location.state}</p>
              </div>
              <div>
                <p>{formatNumber(location.gyms ?? 0)} gyms</p>
                <p className="geo-map__muted">{formatNumber(location.impressions ?? 0)} impressions</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

GeoDensityMap.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      city: PropTypes.string,
      state: PropTypes.string,
      latitude: PropTypes.number,
      longitude: PropTypes.number,
      gyms: PropTypes.number,
      impressions: PropTypes.number,
      memberships: PropTypes.number,
    }),
  ),
  totals: PropTypes.shape({
    totalGyms: PropTypes.number,
    totalImpressions: PropTypes.number,
  }),
  topLocations: PropTypes.arrayOf(
    PropTypes.shape({
      city: PropTypes.string,
      state: PropTypes.string,
      gyms: PropTypes.number,
      impressions: PropTypes.number,
    }),
  ),
};

GeoDensityMap.defaultProps = {
  points: [],
  totals: { totalGyms: 0, totalImpressions: 0 },
  topLocations: [],
};

export default memo(GeoDensityMap);
