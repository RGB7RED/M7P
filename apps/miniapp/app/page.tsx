import Link from 'next/link';

import { getCurrentUser } from '../lib/currentUser';
import { isModeratorUser } from '../lib/moderators';

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

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isModerator = isModeratorUser(currentUser);

  return (
    <>
      <div className="card">
        <h1 className="card-title">M7 платформа</h1>
        <p className="card-subtitle">
          Все ключевые сценарии — знакомства, товары и услуги, аренда жилья и поиск работы — собраны в одном приложении.
          Авторизация строится вокруг Telegram @username и одноразовых кодов, которые отправляет бот.
        </p>
      </div>

      <div className="card">
        <h2 className="card-title">Что внутри</h2>
        <p className="card-subtitle">
          Минимум переключений: четыре раздела с единым UX, нативная работа внутри Telegram и быстрые уведомления через бота.
        </p>
      </div>

      <ul className="section-list">
        {sections.map((section) => (
          <li key={section.href}>
            <Link href={section.href} className="card">
              <h3 className="card-title" style={{ fontSize: 18 }}>
                {section.title}
              </h3>
              <p className="card-subtitle">{section.description}</p>
            </Link>
          </li>
        ))}
      </ul>

      {isModerator ? (
        <div className="card">
          <h2 className="card-title">Модерация</h2>
          <p className="card-subtitle">
            Раздел только для модераторов. Чтобы увидеть блок локально, добавьте свой Telegram username в
            переменную окружения MODERATOR_USERNAMES.
          </p>
          <div className="action-buttons">
            <Link className="btn-primary" href="/moderation/dating">
              Жалобы по знакомствам
            </Link>
            <Link className="btn-primary" href="/moderation/listings">
              Модерация объявлений
            </Link>
          </div>
        </div>
      ) : null}

      <p className="footer-note">
        Бот отвечает за выдачу кодов, уведомления и быстрый возврат в Mini App. Дальнейшая логика подключится на следующих этапах.
      </p>
    </>
  );
}
