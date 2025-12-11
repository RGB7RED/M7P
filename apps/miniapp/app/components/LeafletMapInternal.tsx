'use client';

import { useEffect, useMemo, useState } from 'react';

type ListingType = 'dating' | 'market' | 'housing' | 'job';

type MapPoint = {
  id: string;
  listingType: ListingType;
  listingId?: string | null;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
};

type LeafletMapProps = {
  height?: number;
};

const DEFAULT_CENTER: [number, number] = [59.9386, 30.3141];

const typeMeta: Record<ListingType, { color: string; label: string }> = {
  dating: { color: '#ec4899', label: 'Знакомства' },
  market: { color: '#22c55e', label: 'Маркет' },
  housing: { color: '#3b82f6', label: 'Жильё' },
  job: { color: '#8b5cf6', label: 'Работа' },
};

function createIcon(L: typeof import('leaflet'), color: string) {
  return L.divIcon({
    className: 'map-marker-icon',
    html: `
      <span
        style="
          display: inline-block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${color};
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.9), 0 6px 12px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(0, 0, 0, 0.08);
        "
      ></span>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 18],
    popupAnchor: [0, -14],
  });
}

export function LeafletMap({ height = 400 }: LeafletMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [leafletLibs, setLeafletLibs] = useState<{
    L: typeof import('leaflet');
    components: typeof import('react-leaflet');
  } | null>(null);

  const icons = useMemo(() => {
    if (!leafletLibs) return null;

    return Object.fromEntries(
      Object.entries(typeMeta).map(([type, meta]) => [type, createIcon(leafletLibs.L, meta.color)])
    ) as Record<ListingType, import('leaflet').DivIcon>;
  }, [leafletLibs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    Promise.all([import('leaflet'), import('react-leaflet')])
      .then(([leaflet, reactLeaflet]) => {
        if (!isMounted) return;
        setLeafletLibs({
          L: leaflet.default ?? leaflet,
          components: reactLeaflet,
        });
      })
      .catch((error) => {
        console.error('[LeafletMap] failed to load Leaflet libs', error);
      });

    fetch('/api/maps/points')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Не удалось загрузить точки');
        }
        const data = (await res.json()) as MapPoint[];
        if (isMounted) {
          setPoints(data);
        }
      })
      .catch((error) => {
        console.error('[LeafletMap] failed to load points', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!leafletLibs || !icons) {
    return <div className="map-card" style={{ height, width: '100%' }} />;
  }

  const { MapContainer, Marker, Popup, TileLayer } = leafletLibs.components;

  return (
    <div className="map-card">
      <div style={{ height, width: '100%' }}>
        <MapContainer
          center={DEFAULT_CENTER}
          zoom={10}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />

          {points.map((point) => {
            const meta = typeMeta[point.listingType];
            const icon = icons[point.listingType];

            return (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={icon}
              >
                <Popup>
                  <div style={{ minWidth: 200 }}>
                    <strong>{point.title}</strong>
                    {point.description && <div style={{ marginTop: 6 }}>{point.description}</div>}
                    <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                      Тип: <span style={{ color: meta.color }}>{meta.label}</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}

export type { LeafletMapProps };
