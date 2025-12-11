'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import maplibregl from 'maplibre-gl';

import type { MapListingDTO } from '../maps/types';

const INITIAL_CENTER: [number, number] = [30.3, 59.94];
const INITIAL_ZOOM = 9;

type MapViewProps = {
  points: MapListingDTO[];
};

function buildPopupElement(point: MapListingDTO, onOpenListing?: (point: MapListingDTO) => void) {
  const container = document.createElement('div');
  container.className = 'm7-map-popup';

  const title = document.createElement('div');
  title.className = 'm7-map-popup-title';
  title.textContent = point.title;
  container.appendChild(title);

  if (point.city) {
    const subtitle = document.createElement('div');
    subtitle.className = 'm7-map-popup-subtitle';
    subtitle.textContent = point.city;
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

export function MapView({ points }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const router = useRouter();

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

    const handleOpenListing = (point: MapListingDTO) => {
      if (point.href) {
        router.push(point.href);
      }
    };

    points.forEach((point) => {
      const el = document.createElement('div');
      el.className = `m7-map-marker m7-map-marker-${point.type}`;

      const popupElement = buildPopupElement(point, handleOpenListing);
      const popup = new maplibregl.Popup({ closeButton: true }).setDOMContent(popupElement);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([point.mapLng, point.mapLat])
        .setPopup(popup)
        .addTo(mapRef.current!);

      markersRef.current.push(marker);
    });

    if (!points.length) {
      mapRef.current.setCenter(INITIAL_CENTER);
      mapRef.current.setZoom(INITIAL_ZOOM);
      return;
    }

    if (points.length === 1) {
      mapRef.current.flyTo({ center: [points[0].mapLng, points[0].mapLat], zoom: 12 });
      return;
    }

    const bounds = points.reduce((acc, point) => {
      acc.extend([point.mapLng, point.mapLat]);
      return acc;
    }, new maplibregl.LngLatBounds([points[0].mapLng, points[0].mapLat], [points[0].mapLng, points[0].mapLat]));

    mapRef.current.fitBounds(bounds, { padding: 32, maxZoom: 13, duration: 500 });
  }, [points]);

  return <div ref={containerRef} className="m7-map-container" />;
}

export default MapView;
