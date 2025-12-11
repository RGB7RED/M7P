import MapView from '../components/MapView';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';
import { TelegramBackToRoot } from '../components/TelegramBackToRoot';
import { loadMapPoints } from './mapPoints';

export default async function MapsPage() {
  const points = await loadMapPoints();

  return (
    <SectionLayout>
      <TelegramBackToRoot />
      <SectionHeaderCard
        title="Карты"
        subtitle="Объявления на карте. В будущем здесь появятся точки со знакомствами, товарами, жильём и работой."
      />

      <MapView points={points} />
    </SectionLayout>
  );
}
