import { SectionHeaderCard } from '../components/SectionHeaderCard';
import { SectionLayout } from '../components/SectionLayout';
import { TelegramBackToRoot } from '../components/TelegramBackToRoot';

export default function RulesPage() {
  return (
    <SectionLayout>
      <TelegramBackToRoot />
      <SectionHeaderCard
        title="Правила и инструкция"
        subtitle="Базовые правила использования платформы, подсказки по публикации объявлений и рекомендации по безопасности."
      />

      <section className="card" aria-labelledby="rules-title">
        <h2 className="card-title" id="rules-title">
          Что важно знать
        </h2>
        <p className="card-subtitle">Раздел с правилами публикации, рекомендациями по безопасности и ответами на частые вопросы.</p>

        <ul className="card-list">
          <li>Как публиковать объявления</li>
          <li>Как общаться безопасно</li>
          <li>Что запрещено на платформе</li>
          <li>Поддержка и обратная связь</li>
        </ul>
      </section>
    </SectionLayout>
  );
}
