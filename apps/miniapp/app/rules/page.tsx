export default function RulesPage() {
  return (
    <section className="card" aria-labelledby="rules-title">
      <h1 className="card-title" id="rules-title">
        Правила и инструкция
      </h1>
      <p className="card-subtitle">
        Раздел с правилами публикации, рекомендациями по безопасности и ответами на частые вопросы.
      </p>

      <ul className="card-list">
        <li>Как публиковать объявления</li>
        <li>Как общаться безопасно</li>
        <li>Что запрещено на платформе</li>
        <li>Поддержка и обратная связь</li>
      </ul>
    </section>
  );
}
