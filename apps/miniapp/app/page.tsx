import Link from 'next/link';

const sections = [
  {
    href: '/dating',
    title: 'Знакомства',
    description:
      'Свайпы и матчи в стиле Tinder: быстрый поиск людей для общения, отношений или деловых контактов.',
  },
  {
    href: '/market',
    title: 'Маркет',
    description: 'Объявления о товарах и услугах с фильтрами по категориям, цене и географии.',
  },
  {
    href: '/housing',
    title: 'Жильё',
    description: 'Поиск и размещение аренды: районы, сроки, цена, важные условия и фото.',
  },
  {
    href: '/jobs',
    title: 'Работа',
    description: 'Вакансии и резюме с фильтрами по городу, формату, опыту и доходу.',
  },
];

export default function HomePage() {
  return (
    <>
      <div className="card">
        <h1 className="hero-title">М7 — маркетплейс внутри Telegram Mini App</h1>
        <p className="hero-text">
          Все ключевые сценарии — знакомства, товары и услуги, аренда жилья и поиск работы — собраны в одном приложении.
          Авторизация строится вокруг Telegram @username и одноразовых кодов, которые отправляет бот.
        </p>
      </div>

      <div className="card">
        <h2>Что внутри</h2>
        <p className="hero-text">
          Минимум переключений: четыре раздела с единым UX, нативная работа внутри Telegram и быстрые уведомления через бота.
        </p>
      </div>

      <ul className="section-list">
        {sections.map((section) => (
          <li key={section.href}>
            <Link href={section.href}>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <p className="footer-note">
        Бот отвечает за выдачу кодов, уведомления и быстрый возврат в Mini App. Дальнейшая логика подключится на следующих этапах.
      </p>
    </>
  );
}
