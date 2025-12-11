import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';

export default function ProfilePage() {
  return (
    <SectionLayout>
      <SectionHeaderCard
        title="Профиль"
        subtitle="Экран с базовыми данными, которые будут использоваться в разделах платформы и в новых мини-сервисах."
      />

      <section className="card">
        <h2 className="card-title">Настройки появятся скоро</h2>
        <p className="card-subtitle">
          Здесь позже появятся настройки основного профиля и привязка данных к разделам платформы.
        </p>
      </section>
    </SectionLayout>
  );
}
