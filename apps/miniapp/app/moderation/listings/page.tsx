import { notFound } from 'next/navigation';

import { getCurrentUser } from '../../../lib/currentUser';
import { isModeratorUser } from '../../../lib/moderators';
import { ModerationListingsClient } from './ModerationListingsClient';

export const dynamic = 'force-dynamic';

export default async function ModerationListingsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isModeratorUser(currentUser)) {
    return notFound();
  }

  return <ModerationListingsClient />;
}
