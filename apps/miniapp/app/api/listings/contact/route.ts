import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/currentUser';
import { getListingOwnerContact, getOrCreateListingContactPurchase, ListingSection } from '../_helpers/contacts';

export const dynamic = 'force-dynamic';

function isSection(value: unknown): value is ListingSection {
  return value === 'market' || value === 'housing' || value === 'jobs';
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as { section?: unknown; listingId?: unknown };
    const section = body.section;
    const listingIdRaw = body.listingId;

    if (!isSection(section) || !listingIdRaw || typeof listingIdRaw !== 'string') {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const listingId = listingIdRaw.trim();
    if (!listingId) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const ownerContact = await getListingOwnerContact(section, listingId);
    if (!ownerContact) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (ownerContact.ownerUserId === currentUser.userId) {
      return NextResponse.json({ error: 'cannot_purchase_own_listing' }, { status: 400 });
    }

    const purchase = await getOrCreateListingContactPurchase({
      buyerUserId: currentUser.userId,
      section,
      listingId,
    });

    return NextResponse.json({
      ok: true,
      alreadyPurchased: purchase.alreadyPurchased,
      priceCents: purchase.priceCents,
      currency: purchase.currency,
      contact: {
        telegramUsername: ownerContact.telegramUsername,
      },
    });
  } catch (error) {
    console.error('[listings/contact][POST] unexpected error', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
