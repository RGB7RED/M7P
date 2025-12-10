import { notFound } from 'next/navigation';

import { getCurrentUser } from '../../../lib/currentUser';
import { isModeratorUser } from '../../../lib/moderators';
import { ModerationDatingClient } from './ModerationDatingClient';

export const dynamic = 'force-dynamic';

export default async function ModerationDatingPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser || !isModeratorUser(currentUser)) {
    return notFound();
  }

  return <ModerationDatingClient />;
}
