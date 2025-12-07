export const DATING_PURPOSES = {
  romantic: {
    label: 'Романтика / общение',
    description: 'Поиск отношений, свиданий или лёгкого общения.',
  },
  friends: {
    label: 'Дружба',
    description: 'Найти единомышленников для общения и совместных активностей.',
  },
  co_rent: {
    label: 'Снимать жильё вместе',
    description: 'Ищу соседа или пару для совместной аренды.',
  },
  rent_tenant: {
    label: 'Ищу жильё как арендатор',
    description: 'Найти квартиру или комнату в аренду.',
  },
  rent_landlord: {
    label: 'Сдаю жильё',
    description: 'Предлагаю квартиру или комнату в аренду.',
  },
  market_seller: {
    label: 'Продаю / оказываю услуги',
    description: 'Предлагаю товары или услуги участникам М7.',
  },
  market_buyer: {
    label: 'Покупаю / ищу услуги',
    description: 'Нужны товары или услуги, готов обсудить условия.',
  },
  job_employer: {
    label: 'Ищу сотрудников',
    description: 'Найти специалистов в команду или на проект.',
  },
  job_seeker: {
    label: 'Ищу работу',
    description: 'Открыт к предложениям о работе или проектам.',
  },
  job_buddy: {
    label: 'Ищу напарника',
    description: 'Нужен партнёр для стартапа, pet-проекта или коллаборации.',
  },
} as const;

export type DatingPurpose = keyof typeof DATING_PURPOSES;

export type DatingPurposeMeta = (typeof DATING_PURPOSES)[DatingPurpose];

export const DATING_PURPOSE_ENTRIES = Object.entries(DATING_PURPOSES) as [
  DatingPurpose,
  DatingPurposeMeta,
][];

export const DATING_PURPOSE_VALUES = Object.keys(DATING_PURPOSES) as DatingPurpose[];

export function isDatingPurpose(value: unknown): value is DatingPurpose {
  return typeof value === 'string' && DATING_PURPOSE_VALUES.includes(value as DatingPurpose);
}
