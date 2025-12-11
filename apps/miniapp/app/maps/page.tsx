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

      <div className="map-card">
        <iframe
          src="https://yandex.ru/map-widget/v1/?um=constructor%3A0226188669e64f9b8b14b21c07d290506c0a203448b40eba49f326390e6c6e02&source=constructor"
          className="map-frame"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          frameBorder={0}
        />
      </div>
    </SectionLayout>
  );
}
