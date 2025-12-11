import Link from 'next/link';

import { getCurrentUser } from '../lib/currentUser';
import { isModeratorUser } from '../lib/moderators';

type HubSection = {
  href: string;
  title: string;
  description: string;
  icon?: string;
  locked?: boolean;
};

function buildSections(isModerator: boolean): HubSection[] {
  return [
    {
      href: '/profile',
      title: 'Профиль',
      description: 'Телеграм-профиль, анкета, настройки',
      icon: '👤',
    },
    {
      href: '/rules',
      title: 'Правила и инструкция',
      description: 'Как работает платформа и правила сервиса',
      icon: '📜',
    },
    {
      href: '/dating',
      title: 'Знакомства',
      description: 'Анкета, лента, матчи, настройки приватности',
      icon: '💌',
    },
    {
      href: '/market',
      title: 'Маркет',
      description: 'Товары и услуги, объявления, поиск по фильтрам',
      icon: '🛍️',
    },
    {
      href: '/housing',
      title: 'Жильё',
      description: 'Аренда жилья, соседи, объявления по городам',
      icon: '🏡',
    },
    {
      href: '/jobs',
      title: 'Работа',
      description: 'Вакансии и резюме, поиск работы и сотрудников',
      icon: '💼',
    },
    {
      href: '/maps',
      title: 'Карты',
      description: 'Объявления на карте (знакомства, маркет, жильё, работа)',
      icon: '🗺️',
    },
    {
      href: '/moderation/dating',
      title: 'Модерация',
      description: isModerator
        ? 'Панель модератора по жалобам и объявлениям'
        : 'Доступно модераторам — нужен Telegram-логин из списка',
      icon: '🛡️',
      locked: !isModerator,
    },
  ];
}

function HubListItem({ section }: { section: HubSection }) {
  const { icon, title, description, href, locked } = section;

  return (
    <li>
      <Link href={href} className="hub-item">
        <div className="hub-item-icon" aria-hidden>
          {icon ?? title.charAt(0)}
        </div>
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
        <h1 className="hub-cover-title">M7 Платформа</h1>
        <p className="hub-cover-subtitle">
          Платформа знакомств, товаров и услуг, жилья и работы внутри Telegram. Сейчас идёт внутренняя разработка MVP.
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
