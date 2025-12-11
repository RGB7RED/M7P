'use client';

import { useEffect, useState } from 'react';

import MapView from '../components/MapView';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';
import { MapListingDTO } from './types';

export default function MapsPage() {
  const [points, setPoints] = useState<MapListingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const response = await fetch('/api/maps/listings');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!isMounted) return;

        if (Array.isArray(data)) {
          setPoints(data);
        } else if (Array.isArray(data?.data)) {
          setPoints(data.data);
        } else {
          setPoints([]);
        }
        setError(null);
      } catch (err) {
        console.error('[maps] failed to load listings', err);
        if (isMounted) {
          setError('Не удалось загрузить объявления для карты. Попробуйте позже.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <SectionLayout>
      <SectionHeaderCard
        title="Карты"
        subtitle="Объявления на карте. В будущем здесь появятся точки со знакомствами, товарами, жильём и работой."
      />

      {error ? (
        <div className="hint error" role="alert">
          {error}
        </div>
      ) : null}
      {loading ? <p className="subtitle">Загрузка карты...</p> : null}
      {!loading && !error && !points.length ? <p className="subtitle">Пока нет объявлений с координатами.</p> : null}

      <MapView points={points} />
    </SectionLayout>
  );
}
