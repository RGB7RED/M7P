'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

import type { MapPoint } from '../maps/mapPoints';

const INITIAL_CENTER: [number, number] = [30.3, 59.94];
const INITIAL_ZOOM = 9;

type MapViewProps = {
  points: MapPoint[];
};

function buildPopupElement(point: MapPoint, onOpenListing?: (point: MapPoint) => void) {
  const container = document.createElement('div');
  container.className = 'm7-map-popup';

  const title = document.createElement('div');
  title.className = 'm7-map-popup-title';
  title.textContent = point.title;
  container.appendChild(title);

  if (point.subtitle) {
    const subtitle = document.createElement('div');
    subtitle.className = 'm7-map-popup-subtitle';
    subtitle.textContent = point.subtitle;
    container.appendChild(subtitle);
  }

  if (onOpenListing) {
    const button = document.createElement('button');
    button.className = 'm7-map-popup-button';
    button.textContent = 'Открыть объявление';
    button.addEventListener('click', () => onOpenListing(point));
    container.appendChild(button);
  }

  return container;
}

function buildListingUrl(point: MapPoint) {
  switch (point.type) {
    case 'dating':
      return `/dating?openId=${encodeURIComponent(point.id)}`;
    case 'market':
      return `/market?openId=${encodeURIComponent(point.id)}`;
    case 'housing':
      return `/housing?openId=${encodeURIComponent(point.id)}`;
    case 'job':
      return `/jobs?openId=${encodeURIComponent(point.id)}`;
    default:
      return '/';
  }
}

export function MapView({ points }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!containerRef.current) return undefined;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
          },
        ],
      },
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const handleOpenListing = (point: MapPoint) => {
      const url = buildListingUrl(point);
      window.location.href = url;
    };

    points.forEach((point) => {
      const el = document.createElement('div');
      el.className = `m7-map-marker m7-map-marker-${point.type}`;

      const popupElement = buildPopupElement(point, handleOpenListing);
      const popup = new maplibregl.Popup({ closeButton: true }).setDOMContent(popupElement);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.lng, point.lat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });
  }, [points]);

  return <div ref={containerRef} className="m7-map-container" />;
}

export default MapView;
