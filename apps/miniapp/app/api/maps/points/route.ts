import { NextResponse } from 'next/server';
import type { MapPoint as PrismaMapPoint } from '@prisma/client';

import { prisma } from '../../../../lib/prisma';

type ListingType = 'dating' | 'market' | 'housing' | 'job';

type MapPointResponse = {
  id: string;
  listingType: ListingType;
  listingId?: string | null;
  title: string;
  description?: string | null;
  latitude: number;
  longitude: number;
};

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('[api/maps/points][GET] DATABASE_URL is not set');
      return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 500 });
    }

    const points = await prisma.mapPoint.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    const payload: MapPointResponse[] = points.map((p: PrismaMapPoint) => ({
      id: p.id,
      listingType: p.listingType as ListingType,
      listingId: p.listingId,
      title: p.title,
      description: p.description,
      latitude: p.latitude,
      longitude: p.longitude,
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api/maps/points][GET]', error);
    const message =
      error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
