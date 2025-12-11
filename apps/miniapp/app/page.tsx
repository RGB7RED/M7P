import Link from 'next/link';

import { getCurrentUser } from '../lib/currentUser';
import { isModeratorUser } from '../lib/moderators';

type HubSection = {
  href: string;
  title: string;
  description: string;
  locked?: boolean;
};

function buildSections(isModerator: boolean): HubSection[] {
  return [
    {
      href: '/profile',
      title: 'Профиль',
      description: 'Основные данные аккаунта внутри M7 платформы.',
    },
    {
      href: '/rules',
      title: 'Правила и инструкция',
      description: 'Как пользоваться платформой, публиковать объявления и общаться безопасно.',
    },
    {
      href: '/dating',
      title: 'Знакомства',
      description: 'Анкета, лента, быстрые мэтчи и настройки приватности.',
    },
    {
      href: '/market',
      title: 'Маркет',
      description: 'Товары и услуги с фильтрами по городу, категории и цене.',
    },
    {
      href: '/housing',
      title: 'Жильё',
      description: 'Аренда, поиск соседей и совместная съёмка жилья.',
    },
    {
      href: '/jobs',
      title: 'Работа',
      description: 'Вакансии и резюме с фильтрами по городу и формату.',
    },
    {
      href: '/maps',
      title: 'Карты',
      description: 'В будущем — объявления и люди на карте города.',
    },
    {
      href: '/moderation/dating',
      title: 'Модерация',
      description: isModerator
        ? 'Отчёты о нарушениях и модерация объявлений.'
        : 'Доступно модераторам — нужен Telegram-логин из списка',
      locked: !isModerator,
    },
  ];
}

function HubListItem({ section }: { section: HubSection }) {
  const { title, description, href, locked } = section;

  return (
    <li>
      <Link href={href} className="hub-item">
        <div className="hub-item-text">
          <div className="hub-item-title-row">
            <span className="hub-item-title">{title}</span>
            {locked ? <span className="hub-item-badge">Только модераторы</span> : null}
          </div>
          <p className="hub-item-subtitle">{description}</p>
        </div>
        <span className="hub-item-arrow" aria-hidden>
          ›
        </span>
      </Link>
    </li>
  );
}

export default async function HomePage() {
  const currentUser = await getCurrentUser();
  const isModerator = isModeratorUser(currentUser);
  const sections = buildSections(isModerator);

  return (
    <div className="hub-layout">
      <section className="hub-cover">
        <p className="hub-cover-kicker">Главный экран</p>
        <h1 className="hub-cover-title">M7 платформа</h1>
        <p className="hub-cover-subtitle">
          Честные знакомства, маркет, жильё и работа внутри Telegram Mini App. Сейчас идёт внутренняя разработка MVP.
        </p>
      </section>

      <section className="hub-list-block">
        <h2 className="hub-section-title">Разделы</h2>
        <ul className="hub-list" aria-label="Разделы платформы">
          {sections.map((section) => (
            <HubListItem key={section.href} section={section} />
          ))}
        </ul>
      </section>
    </div>
  );
}
