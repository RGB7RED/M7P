import LeafletMap from '../components/LeafletMap';
import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';
import { TelegramBackToRoot } from '../components/TelegramBackToRoot';

export default function MapsPage() {
  return (
    <SectionLayout>
      <TelegramBackToRoot />
      <SectionHeaderCard
        title="Карты"
        subtitle="Объявления на карте. В будущем здесь появятся точки со знакомствами, товарами, жильём и работой."
      />

      <LeafletMap height={400} />
    </SectionLayout>
  );
}
