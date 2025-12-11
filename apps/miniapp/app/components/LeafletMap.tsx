'use client';

import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

export type LeafletMapProps = {
  height?: number;
};

type MapPoint = {
  id: string;
  listingType: 'dating' | 'market' | 'housing' | 'job' | string;
  listingId?: string | null;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
};

const MAP_CENTER: [number, number] = [59.9386, 30.3141];
const DEFAULT_ZOOM = 10;

const listingTypeConfig: Record<
  MapPoint['listingType'],
  { color: string; label: string }
> = {
  dating: { color: '#e91e63', label: 'Знакомства' },
  market: { color: '#16a34a', label: 'Маркет' },
  housing: { color: '#2563eb', label: 'Жильё' },
  job: { color: '#7c3aed', label: 'Работа' },
};

function createIcon(color: string) {
  return L.divIcon({
    className: 'map-point-icon',
    html: `<span class="map-point-pin" style="background:${color}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -28],
  });
}

export function LeafletMap({ height = 400 }: LeafletMapProps) {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const response = await fetch('/api/maps/points');
        if (!response.ok) {
          throw new Error('Failed to load points');
        }
        const data: MapPoint[] = await response.json();
        setPoints(data);
      } catch (error) {
        console.error(error);
      }
    };

    fetchPoints();
  }, []);

  const icons = useMemo(() => {
    return Object.fromEntries(
      Object.entries(listingTypeConfig).map(([key, config]) => [key, createIcon(config.color)])
    );
  }, []);

  return (
    <div className="map-card">
      <div style={{ height, width: '100%' }}>
        {isClient ? (
          <MapContainer
            center={MAP_CENTER}
            zoom={DEFAULT_ZOOM}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {points.map((p) => {
              const config = listingTypeConfig[p.listingType] ?? {
                color: '#111827',
                label: 'Другое',
              };
              const icon = icons[p.listingType] ?? createIcon(config.color);

              return (
                <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
                  <Popup>
                    <strong>{p.title}</strong>
                    {p.description ? <div>{p.description}</div> : null}
                    <div>Тип: {config.label}</div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        ) : (
          <div className="map-placeholder" style={{ height: '100%', width: '100%' }}>
            Загрузка карты...
          </div>
        )}
      </div>
    </div>
  );
}

export default LeafletMap;
