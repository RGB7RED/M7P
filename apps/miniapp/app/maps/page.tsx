import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';
import { TelegramBackToRoot } from '../components/TelegramBackToRoot';

export default function MapsPage() {
  return (
    <SectionLayout>
      <TelegramBackToRoot />
      <SectionHeaderCard
        title="Карты"
        subtitle="Раздел в разработке: здесь будут отображаться объявления и люди на карте города."
      />

      <section className="card">
        <h2 className="card-title">В разработке</h2>
        <p className="card-subtitle">
          В будущем здесь появятся карты с объявлениями по знакомствам, маркету, жилью и работе.
        </p>
        <p className="card-footnote">
          Сейчас раздел находится в разработке и доступен только для внутреннего тестирования.
        </p>
      </section>
    </SectionLayout>
  );
}
