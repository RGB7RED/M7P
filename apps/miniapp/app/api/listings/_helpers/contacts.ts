import { getServiceSupabaseClient } from '../../../../lib/supabaseConfig';

export type ListingSection = 'market' | 'housing' | 'jobs';

export interface ListingOwnerContact {
  ownerUserId: string;
  telegramUsername: string | null;
}

export interface ListingContactPurchaseInput {
  buyerUserId: string;
  section: ListingSection;
  listingId: string;
}

export interface ListingContactPurchaseResult {
  alreadyPurchased: boolean;
  purchaseId: string;
  priceCents: number;
  currency: string;
}

const TABLES: Record<ListingSection, string> = {
  market: 'market_listings',
  housing: 'housing_listings',
  jobs: 'job_listings',
};

export async function getListingOwnerContact(
  section: ListingSection,
  listingId: string,
): Promise<ListingOwnerContact | null> {
  const supabase = getServiceSupabaseClient();
  const table = TABLES[section];

  const { data: listing, error: listingError } = await supabase
    .from(table)
    .select('user_id')
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) {
    console.error('[listings][contact] fetch listing error', listingError);
    throw new Error('LISTING_LOOKUP_ERROR');
  }

  if (!listing?.user_id) {
    return null;
  }

  const { data: owner, error: ownerError } = await supabase
    .from('users')
    .select('id, telegram_username')
    .eq('id', listing.user_id)
    .maybeSingle();

  if (ownerError) {
    console.error('[listings][contact] fetch owner error', ownerError);
    throw new Error('OWNER_LOOKUP_ERROR');
  }

  if (!owner?.id) {
    return null;
  }

  return {
    ownerUserId: owner.id,
    telegramUsername: owner.telegram_username ?? null,
  };
}

export async function getOrCreateListingContactPurchase({
  buyerUserId,
  section,
  listingId,
}: ListingContactPurchaseInput): Promise<ListingContactPurchaseResult> {
  const supabase = getServiceSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from('listing_contact_purchases')
    .select('id, price_cents, currency')
    .eq('buyer_user_id', buyerUserId)
    .eq('section', section)
    .eq('listing_id', listingId)
    .maybeSingle();

  if (fetchError) {
    console.error('[listings][contact] lookup purchase error', fetchError);
    throw new Error('PURCHASE_LOOKUP_ERROR');
  }

  if (existing) {
    return {
      alreadyPurchased: true,
      purchaseId: existing.id,
      priceCents: existing.price_cents ?? 5000,
      currency: existing.currency ?? 'RUB',
    };
  }

  const { data: created, error: createError } = await supabase
    .from('listing_contact_purchases')
    .insert({
      buyer_user_id: buyerUserId,
      section,
      listing_id: listingId,
      price_cents: 5000,
      currency: 'RUB',
    })
    .select('id, price_cents, currency')
    .single();

  if (createError) {
    console.error('[listings][contact] create purchase error', createError);
    throw new Error('PURCHASE_CREATE_ERROR');
  }

  return {
    alreadyPurchased: false,
    purchaseId: created.id,
    priceCents: created.price_cents ?? 5000,
    currency: created.currency ?? 'RUB',
  };
}
